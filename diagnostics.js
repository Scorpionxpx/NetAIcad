// Bounded AI metadata across frames. Never store raw requests, responses or errors.
(() => {
  const prefix = 'netaiAiDiagV1:';
  const version = chrome.runtime.getManifest().version;
  const topFrame = window === window.top;
  function classify(value) {
    const text = String(value || '').toLowerCase();
    let category = 'unknown';
    if (/key.*not configured|missing.*key/.test(text)) category = 'missing-key';
    else if (/401|incorrect.*key|invalid.*key|authentication/.test(text)) category = 'authentication';
    else if (/insufficient_quota|quota|billing|credit/.test(text)) category = 'quota-or-billing';
    else if (/429|rate.limit|too many requests/.test(text)) category = 'rate-limit';
    else if (/403|permission|access denied/.test(text)) category = 'permission';
    else if (/404|model.*not found|model_not_found/.test(text)) category = 'model-access';
    else if (/400|reasoning|compatibility|unsupported|invalid.*model/.test(text)) category = 'request-configuration';
    else if (/timeout|timed out|delai|abort/.test(text)) category = 'timeout';
    else if (/format|answer count|matching count|option count|invalid.*response/.test(text)) category = 'answer-format';
    else if (/incomplete|no usable|no answer|empty/.test(text)) category = 'empty-or-incomplete';
    else if (/network|fetch|connection|receiving end|message channel/.test(text)) category = 'network-or-messaging';
    else if (/\b5\d\d\b/.test(text)) category = 'provider-server';
    const match = text.match(/(?:http|status|error)[ :]+([45]\d{2})\b/);
    return {category, ...(match ? {httpStatus:Number(match[1])} : {})};
  }
  async function records() {
    const all = await chrome.storage.local.get(null);
    return Object.entries(all).filter(([key]) => key.startsWith(prefix));
  }
  let writes = Promise.resolve();
  function persist(key, entry) {
    writes = writes.then(async () => {
      await chrome.storage.local.set({[key]:entry});
      const items = (await records()).sort((a,b) => a[1].time.localeCompare(b[1].time));
      const old = items.slice(0, Math.max(0, items.length - 100)).map(([name]) => name);
      if (old.length) await chrome.storage.local.remove(old);
    }).catch(() => console.warn('[NetAIcad diagnostics] Enregistrement IA impossible.'));
  }
  if (!globalThis.__netaiAiDiagnostics) {
    globalThis.__netaiAiDiagnostics = true;
    const original = chrome.runtime.sendMessage.bind(chrome.runtime);
    chrome.runtime.sendMessage = function(...args) {
      const request = args[0];
      if (!request || typeof request !== 'object' || request.action !== 'getAnswer') return original(...args);
      const id = crypto.randomUUID(), key = prefix + id, started = Date.now();
      const entry = {time:new Date(started).toISOString(), id, version, source:'ai', event:'ai:start', level:'info', frame:topFrame ? 'top' : 'iframe', type:request.isMatching ? 'matching' : 'mcq', requestedProvider:['gpt','gemini','chatgpt-web','gemini-web'].includes(request.modelType) ? request.modelType : 'unknown'};
      let completed = false;
      const config = Promise.all([chrome.storage.local.get(['quizProvider','openAiModel','openAiReasoning','mistralModel']), chrome.storage.sync.get(['openAiApiKey','geminiApiKey'])]).then(([local,sync]) => {
        const provider = request.modelType === 'gpt' ? (local.quizProvider || 'openai') : request.modelType;
        entry.provider = ['openai','mistral','gemini','chatgpt-web','gemini-web'].includes(provider) ? provider : 'unknown';
        const model = provider === 'openai' ? (local.openAiModel || 'gpt-4o-mini') : provider === 'mistral' ? (local.mistralModel || 'mistral-small-latest') : provider === 'gemini' ? 'gemini-2.5-flash' : '';
        entry.configuredModel = /^[a-zA-Z0-9._:-]{1,120}$/.test(model) ? model : 'not-recorded';
        if (provider === 'openai') entry.keyConfigured = Boolean(sync.openAiApiKey);
        if (provider === 'gemini') entry.keyConfigured = Boolean(sync.geminiApiKey);
        if (provider === 'openai') entry.reasoning = ['low','medium','high'].includes(local.openAiReasoning) ? local.openAiReasoning : 'default';
      }).catch(() => { entry.configurationReadFailed = true; });
      config.then(() => { if (!completed) persist(key,{...entry}); });
      const finish = (result,error) => {
        if (completed) return; completed = true;
        const durationMs = Date.now() - started;
        config.then(() => persist(key,{...entry,event:result?.success && !error ? 'ai:success' : 'ai:error',level:result?.success && !error ? 'info' : 'error',durationMs,...(result?.success && !error ? {} : classify(error?.message || result?.error))}));
      };
      const callback = typeof args[args.length - 1] === 'function' ? args[args.length - 1] : null;
      if (callback) args[args.length - 1] = function(result) {
        const error = chrome.runtime.lastError;
        finish(result,error); return callback(result);
      };
      try {
        const promise = original(...args);
        if (!callback && promise?.then) return promise.then(result => { finish(result); return result; },error => { finish(null,error); throw error; });
        return promise;
      } catch (error) { finish(null,error); throw error; }
    };
  }
  if (!topFrame) return;
  const entries = [];
  let output, visible = false, sequence = 0, refreshToken = 0;
  async function snapshot() {
    const ai = (await records()).map(([,entry]) => entry).sort((a,b) => a.time.localeCompare(b.time));
    return {version,exportedAt:new Date().toISOString(),entries:[...entries],aiEntries:ai};
  }
  async function render() {
    if (!visible || !output) return;
    const token = ++refreshToken;
    try { const data = await snapshot(); if (token === refreshToken) output.textContent = JSON.stringify({entries:data.entries.slice(-100),aiEntries:data.aiEntries},null,2); }
    catch (_) { output.textContent = 'Lecture du journal IA impossible.'; }
  }
  function log(level,event,data = {}) {
    entries.push({time:new Date().toISOString(),level,event,...data});
    if (entries.length > 1000) entries.shift(); render();
  }
  function category(error) {
    const text = String(error?.message || '').toLowerCase();
    if (/interrompu|stopped|cancel/.test(text)) return 'stopped';
    if (/video/.test(text)) return 'video';
    if (/defilement|scroll/.test(text)) return 'scroll';
    if (/inconnu|indicateur/.test(text)) return 'unknown-state';
    if (/progression|incomplete|completion/.test(text)) return 'completion';
    if (/iframe|integre/.test(text)) return 'embedded-content';
    if (/outline|module/.test(text)) return 'outline';
    return 'other';
  }
  function trace(name,handler) {
    return async function(...args) {
      const id = ++sequence, started = performance.now(); log('info',name + ':start',{id});
      try {
        const result = await handler.apply(this,args);
        const data = typeof result === 'boolean' ? {handled:result} : {};
        if (result && typeof result === 'object') {
          for (const key of ['reachedQuiz','stopped','notLoaded']) if (typeof result[key] === 'boolean') data[key] = result[key];
          if (Array.isArray(result.skipped)) data.skippedCount = result.skipped.length;
        }
        log('info',name + ':end',{id,durationMs:Math.round(performance.now()-started),...data}); return result;
      } catch (error) { log('error',name + ':error',{id,durationMs:Math.round(performance.now()-started),category:category(error)}); throw error; }
    };
  }
  startModuleWalk = trace('module',startModuleWalk);
  walkTopicSections = trace('topic',walkTopicSections);
  handleReadingSection = trace('reading',handleReadingSection);
  handleClickToRevealSection = trace('disclosure',handleClickToRevealSection);
  handleSelfCheckSection = trace('self-check',handleSelfCheckSection);
  smoothScrollIntoView = trace('scroll',smoothScrollIntoView);
  const originalOutline = getCurrentOutlineGroupTopics;
  getCurrentOutlineGroupTopics = function(...args) {
    try { const topics = originalOutline.apply(this,args); log('info','outline:read',{total:topics.length,completed:topics.filter(t => t.isCompleted).length,locked:topics.filter(t => t.isLocked).length}); return topics; }
    catch (error) { log('error','outline:error',{category:category(error)}); throw error; }
  };
  const originalStop = stopModuleWalk;
  stopModuleWalk = function(...args) { log('info','stop:requested'); return originalStop.apply(this,args); };
  chrome.storage.onChanged.addListener((changes,area) => { if (area === 'local' && Object.keys(changes).some(key => key.startsWith(prefix))) render(); });
  function mount() {
    if (!document.body || document.getElementById('netacad-local-diagnostics')) return;
    const host = document.createElement('div'); host.id = 'netacad-local-diagnostics';
    host.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;';
    const root = host.attachShadow({mode:'closed'});
    const style = document.createElement('style');
    style.textContent = 'button{padding:8px;margin:3px;cursor:pointer}section{background:#15202b;color:white;padding:10px;border:1px solid #aaa;border-radius:8px;width:min(600px,85vw);box-sizing:border-box}pre{max-height:45vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:12px monospace}p{font:13px sans-serif}';
    const toggle = document.createElement('button'); toggle.textContent = 'Logs NetAIcad';
    const panel = document.createElement('section'); panel.hidden = true;
    const note = document.createElement('p');
    note.textContent = 'Journal parcours + IA (toutes les pages NetAcad de cette extension). IA : 100 appels maximum, conserves localement jusqu a Vider. Fournisseur indique selon configuration, pas preuve du routage effectif. Aucun contenu de question, reponse, cle ou erreur brute. HTTP seulement si present dans l erreur recue. Un appel reste ai:start si son retour est perdu. Aucun appel API supplementaire.';
    const exportButton = document.createElement('button'); exportButton.textContent = 'Exporter JSON';
    const uiStatus = document.createElement('p'); uiStatus.setAttribute('role','status');
    exportButton.onclick = async () => {
      try {
        const data = await snapshot();
        const url = URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
        const link = document.createElement('a'); link.href = url; link.download = 'netai-diagnostics-' + Date.now() + '.json';
        root.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),10000);
        uiStatus.textContent = 'Export cree : ' + data.aiEntries.length + ' appels IA.';
      } catch (_) { uiStatus.textContent = 'Export impossible.'; }
    };
    const clear = document.createElement('button'); clear.textContent = 'Vider';
    clear.onclick = async () => {
      try { const keys = (await records()).map(([key]) => key); if (keys.length) await chrome.storage.local.remove(keys); entries.length = 0; uiStatus.textContent = 'Journal vide. Les appels en cours peuvent encore ajouter leur resultat.'; render(); }
      catch (_) { uiStatus.textContent = 'Effacement impossible.'; }
    };
    const refresh = document.createElement('button'); refresh.textContent = 'Actualiser'; refresh.onclick = render;
    output = document.createElement('pre');
    panel.append(note,exportButton,refresh,clear,uiStatus,output);
    toggle.onclick = () => { visible = !visible; panel.hidden = !visible; render(); };
    root.append(style,toggle,panel); document.body.append(host);
  }
  log('info','diagnostics:ready',{version});
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded',mount,{once:true});
})();

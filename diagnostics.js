// Local, bounded diagnostics. No network, console interception or raw payloads.
(() => {
  if (window !== window.top) return;
  const entries = [];
  const version = chrome.runtime.getManifest().version;
  let sequence = 0;
  let output;
  let visible = false;
  function render() {
    if (visible && output) output.textContent = JSON.stringify(entries.slice(-100), null, 2);
  }
  function log(level, event, data = {}) {
    entries.push({time: new Date().toISOString(), level, event, ...data});
    if (entries.length > 1000) entries.shift();
    render();
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
  function summary(result) {
    if (typeof result === 'boolean') return {handled: result};
    if (!result || typeof result !== 'object') return {};
    const data = {};
    for (const key of ['reachedQuiz', 'stopped', 'notLoaded']) {
      if (typeof result[key] === 'boolean') data[key] = result[key];
    }
    if (Array.isArray(result.skipped)) data.skippedCount = result.skipped.length;
    return data;
  }
  function trace(name, handler) {
    return async function(...args) {
      const id = ++sequence;
      const started = performance.now();
      log('info', name + ':start', {id});
      try {
        const result = await handler.apply(this, args);
        log('info', name + ':end', {id, durationMs: Math.round(performance.now() - started), ...summary(result)});
        return result;
      } catch (error) {
        log('error', name + ':error', {id, durationMs: Math.round(performance.now() - started), category: category(error)});
        throw error;
      }
    };
  }
  startModuleWalk = trace('module', startModuleWalk);
  walkTopicSections = trace('topic', walkTopicSections);
  handleReadingSection = trace('reading', handleReadingSection);
  handleClickToRevealSection = trace('disclosure', handleClickToRevealSection);
  handleSelfCheckSection = trace('self-check', handleSelfCheckSection);
  smoothScrollIntoView = trace('scroll', smoothScrollIntoView);
  const originalOutline = getCurrentOutlineGroupTopics;
  getCurrentOutlineGroupTopics = function(...args) {
    try {
      const topics = originalOutline.apply(this, args);
      log('info', 'outline:read', {total: topics.length, completed: topics.filter(t => t.isCompleted).length, locked: topics.filter(t => t.isLocked).length});
      return topics;
    } catch (error) { log('error', 'outline:error', {category: category(error)}); throw error; }
  };
  const originalStop = stopModuleWalk;
  stopModuleWalk = function(...args) { log('info', 'stop:requested'); return originalStop.apply(this, args); };
  function mount() {
    if (!document.body) return;
    const host = document.createElement('div');
    host.id = 'netacad-local-diagnostics';
    host.style.cssText = 'position:fixed;bottom:12px;left:12px;z-index:2147483647;';
    const root = host.attachShadow({mode: 'closed'});
    const style = document.createElement('style');
    style.textContent = 'button{padding:8px;margin:3px;cursor:pointer}section{background:#15202b;color:white;padding:10px;border:1px solid #aaa;border-radius:8px;width:min(600px,85vw)}pre{max-height:45vh;overflow:auto;white-space:pre-wrap;font:12px monospace}p{font:13px sans-serif}';
    root.append(style);
    const toggle = document.createElement('button');
    toggle.textContent = 'Logs NetAIcad';
    root.append(toggle);
    const panel = document.createElement('section');
    panel.hidden = true;
    const note = document.createElement('p');
    note.textContent = 'Journal local : 1000 entrees maximum, 100 affichees. Efface au rechargement. Parcours principal uniquement, sans contenu des questions ni erreurs API detaillees.';
    panel.append(note);
    const exportButton = document.createElement('button');
    exportButton.textContent = 'Exporter JSON';
    exportButton.onclick = () => {
      const url = URL.createObjectURL(new Blob([JSON.stringify({version, exportedAt: new Date().toISOString(), entries}, null, 2)], {type: 'application/json'}));
      const link = document.createElement('a');
      link.href = url; link.download = 'netai-diagnostics-' + Date.now() + '.json';
      root.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    const clear = document.createElement('button');
    clear.textContent = 'Vider';
    clear.onclick = () => { entries.length = 0; render(); };
    output = document.createElement('pre');
    panel.append(exportButton, clear, output);
    root.append(panel);
    toggle.onclick = () => { visible = !visible; panel.hidden = !visible; render(); };
    document.body.append(host);
  }
  log('info', 'diagnostics:ready', {version});
  if (document.body) mount(); else document.addEventListener('DOMContentLoaded', mount, {once: true});
})();

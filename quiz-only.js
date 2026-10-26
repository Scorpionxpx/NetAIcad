// Current-question assistance with a compact, explicitly expandable panel.
(() => {
  let host, button, status;
  let busy = false, pending = false;
  const visible = node => {
    if (!node?.isConnected || !node.getClientRects().length) return false;
    const style = node.ownerDocument.defaultView.getComputedStyle(node);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };
  function detected() { return findInShadowDOM('mcq-view, .matching__widget', document).some(visible); }
  function fingerprint(data) { return JSON.stringify(data?.isMatching ? {rows:data.rows} : {question:data?.question,options:data?.options?.map(o => o.text)}); }
  function failMessage(error) {
    const text = String(error?.message || '');
    if (/key not configured/i.test(text)) return 'Configure ta cle OpenAI dans les parametres de l extension.';
    if (/401|incorrect api key|invalid api key/i.test(text)) return 'Cle OpenAI refusee. Verifie-la dans les parametres.';
    if (/429|quota|rate limit/i.test(text)) return 'Quota ou limite OpenAI atteint.';
    if (/timeout/i.test(text)) return 'Delai OpenAI depasse. Aucun nouvel essai automatique.';
    return 'Impossible de traiter cette question. Verifie la configuration et le format du quiz.';
  }
  async function answer() {
    if (busy) return;
    if (moduleWalkState.running) { status.textContent = 'Arrete le parcours du module avant de continuer.'; return; }
    busy = true; sync();
    let timeout;
    try {
      const data = await extractQuestionData();
      if (!data) { status.textContent = 'Quiz detecte, mais question non reconnue. Aucun appel API effectue.'; return; }
      const before = fingerprint(data);
      let required = data.requiredAnswers;
      if (!data.isMatching && data.isMultipleAnswer) {
        const match = data.question.match(/(?:choisissez|selectionnez|s[eé]lectionner|choisir|identifiez)\s*(?:les\s+)?(deux|trois|quatre|cinq|[2-5])/i);
        const numbers = {deux:2,trois:3,quatre:4,cinq:5};
        if (match) required = numbers[match[1].toLowerCase()] || Number(match[1]);
      }
      const request = data.isMatching ? {action:'getAnswer',modelType:'gpt',isMatching:true,rows:data.rows} : {action:'getAnswer',modelType:'gpt',question:data.question,options:data.options.map(o => o.text),isMultipleAnswer:data.isMultipleAnswer,requiredAnswers:required};
      status.textContent = 'Analyse de la question avec la cle OpenAI configuree...';
      const response = await Promise.race([chrome.runtime.sendMessage(request),new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('timeout')),60000); })]);
      if (!response?.success) throw new Error(response?.error || 'request failed');
      const current = await extractQuestionData();
      if (!current || fingerprint(current) !== before) { status.textContent = 'La question a change : reponse ignoree. Clique a nouveau si necessaire.'; return; }
      if (data.isMatching) {
        const answers = response.rowAnswers;
        if (!Array.isArray(answers) || answers.length !== data.rows.length || !answers.every(a => Number.isInteger(a.index) && data.rows[a.index]?.options.includes(a.option))) throw new Error('invalid response');
        highlightMatchingAnswer(answers);
        status.textContent = 'Associations suggerees (a reporter puis verifier) : ' + answers.map(a => (a.index + 1) + ' : ' + a.option).join(' | ');
      } else {
        const indices = [...new Set(Array.isArray(response.answerIndex) ? response.answerIndex : [response.answerIndex])];
        if (indices.length !== (data.isMultipleAnswer ? required : 1) || !indices.every(i => Number.isInteger(i) && i >= 0 && i < data.options.length)) throw new Error('invalid response');
        highlightCorrectAnswer(indices);
        let selected = true;
        for (let i = 0; i < data.options.length; i++) {
          const option = data.options[i], input = option.element?.querySelector('input'), wanted = indices.includes(i);
          if (!input || !option.element?.isConnected) { selected = false; continue; }
          if (Boolean(input.checked) !== wanted && (wanted || input.type === 'checkbox')) {
            const clicked = await robustClick(option.element, () => Boolean(input.checked) === wanted);
            selected = clicked && selected;
          }
        }
        status.textContent = 'Suggestion : ' + indices.map(i => data.options[i].text).join(' | ') + (selected ? ' — Verifie puis clique sur Envoyer.' : ' — Selection automatique non confirmee : selectionne manuellement.');
      }
    } catch (error) { status.textContent = failMessage(error); }
    finally { clearTimeout(timeout); busy = false; sync(); }
  }
  function sync() {
    const shown = detected();
    if (!shown && !busy) { if (host && !host.hidden) host.hidden = true; return; }
    if (!host) {
      host = document.createElement('div'); host.id = 'netacad-quiz-only-control';
      host.style.cssText = 'position:fixed;right:12px;bottom:140px;z-index:2147483646;width:calc(100vw - 24px);max-width:360px;pointer-events:none;';
      const root = host.attachShadow({mode:'closed'});
      const style = document.createElement('style');
      style.textContent = ':host{box-sizing:border-box;min-width:0}*{box-sizing:border-box}details{width:100%;font:13px system-ui;color:#e9eff9;overflow-wrap:anywhere;pointer-events:none}summary{margin-left:auto;width:max-content;max-width:100%;padding:8px 12px;background:#15202b;border-radius:18px;cursor:pointer;pointer-events:auto;list-style:none}summary:focus-visible,button:focus-visible{outline:2px solid #8dc4ff;outline-offset:2px}section{margin-top:8px;width:100%;min-width:0;padding:12px;background:#15202b;border-radius:10px;pointer-events:auto}button{max-width:100%;padding:9px;white-space:normal;overflow-wrap:anywhere;cursor:pointer}p{margin:8px 0 0;max-height:min(180px,35vh);overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45}';
      const details = document.createElement('details');
      const summary = document.createElement('summary'); summary.textContent = 'Reponse au quiz';
      const panel = document.createElement('section');
      button = document.createElement('button'); button.type = 'button'; button.textContent = 'Repondre au quiz — OpenAI'; button.onclick = answer;
      status = document.createElement('p'); status.setAttribute('role','status');
      status.textContent = 'Question affichee uniquement. Cle OpenAI configuree. Envoi manuel.';
      panel.append(button,status); details.append(summary,panel); root.append(style,details); document.body.append(host);
    }
    if (!host.isConnected) document.body.append(host);
    if (host.hidden) host.hidden = false;
    if (button.disabled !== busy) button.disabled = busy;
  }
  function safeSync() { try { sync(); } catch (_) { console.warn('[NetAIcad manual] Detection indisponible ; nouvel essai au prochain controle.'); } }
  function schedule() { if (!pending) { pending = true; setTimeout(() => { pending = false; safeSync(); },300); } }
  function init() {
    new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true});
    setInterval(safeSync,1500); safeSync();
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded',init,{once:true});
})();

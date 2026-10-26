// Opt-in automation of the current quiz. No course navigation or retry clicks.
(() => {
  let running = false, stopped = false, host, start, stop, status;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el?.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  function check() { if (stopped || !running) throw new Error('Arret demande.'); }
  function record(event, number) { console.info('[NetAIcad auto]', {time: new Date().toISOString(), event, number}); }
  function signature(data) { return JSON.stringify(data.isMatching ? data.rows : [data.question, data.options.map(o => o.text)]); }
  function results() {
    return findInShadowDOM('button', document).some(b => visible(b) && /^(r[eé]essayer|r[eé]initialiser|retry|retake)$/i.test(b.textContent.trim()));
  }
  function submitButton() {
    const buttons = findInShadowDOM('button', document).filter(b => visible(b) && /^(envoyer|submit)$/i.test(b.textContent.trim()));
    return buttons.length === 1 ? buttons[0] : null;
  }
  async function poll(predicate, timeout = 12000) {
    const end = Date.now() + timeout;
    while (Date.now() < end) { check(); if (predicate()) return true; await sleep(200); }
    return false;
  }
  async function selectMcq(data, answerIndex, required) {
    const indices = Array.isArray(answerIndex) ? answerIndex : [answerIndex];
    if (indices.length !== (data.isMultipleAnswer ? required : 1) || new Set(indices).size !== indices.length || !indices.every(i => Number.isInteger(i) && i >= 0 && i < data.options.length)) throw new Error('Reponse IA non exploitable.');
    for (let i = 0; i < data.options.length; i++) {
      check();
      const option = data.options[i];
      const input = option.element?.querySelector('input');
      if (!input || !option.element.isConnected) throw new Error('Selection non verifiable.');
      const wanted = indices.includes(i);
      if (Boolean(input.checked) !== wanted && (wanted || input.type === 'checkbox')) {
        if (!await robustClick(option.element, () => Boolean(input.checked) === wanted)) throw new Error('Clic de reponse non confirme.');
      }
    }
    if (!data.options.every((option, i) => Boolean(option.element.querySelector('input')?.checked) === indices.includes(i))) throw new Error('Choix selectionnes differents de la reponse.');
  }
  async function selectMatching(data, answers) {
    if (!Array.isArray(answers) || answers.length !== data.rows.length || new Set(answers.map(a => a.index)).size !== data.rows.length) throw new Error('Associations IA invalides.');
    const widgets = findInShadowDOM('.matching__widget', document).filter(visible);
    if (widgets.length !== 1) throw new Error('Zone associations ambigue.');
    const rows = findInShadowDOM('matching-dropdown-view', widgets[0]);
    if (rows.length !== data.rows.length) throw new Error('Nombre de lignes modifie.');
    for (const answer of answers) {
      check();
      if (!Number.isInteger(answer.index) || !data.rows[answer.index]?.options.includes(answer.option)) throw new Error('Association hors liste.');
      const row = rows[answer.index];
      const button = findInShadowDOM('.dropdown__btn.js-dropdown-btn', row)[0];
      if (!button || !await robustClick(button, () => button.getAttribute('aria-expanded') === 'true')) throw new Error('Liste non ouverte.');
      let options = [];
      if (!await poll(() => { options = findInShadowDOM('.dropdown__item.js-dropdown-list-item', document).filter(visible); return options.length > 0; }, 2000)) throw new Error('Liste vide.');
      const matches = options.filter(o => (o.textContent || '').replace(/,\s*\d+\s*of\s*\d+.*$/i, '').trim() === answer.option);
      if (matches.length !== 1) throw new Error('Option association ambigue.');
      check();
      if (!await robustClick(matches[0], () => (button.textContent || '').includes(answer.option))) throw new Error('Association non confirmee.');
    }
  }
  async function run() {
    if (running || moduleWalkState.running) return;
    if (!confirm('Activer les reponses et envois automatiques pour ce quiz ? Les reponses peuvent etre fausses et les appels API peuvent etre factures.')) return;
    running = true; stopped = false; moduleWalkState.running = true;
    const manual = document.getElementById('netacad-quiz-only-control');
    const wasInert = manual?.inert; if (manual) manual.inert = true;
    const disabledHelpers = ['netacad-ai-helper-btn-gpt', 'netacad-ai-helper-btn-gemini', 'netacad-ai-helper-btn-webai'].map(id => document.getElementById(id)).filter(Boolean).map(el => ({el, disabled: el.disabled}));
    disabledHelpers.forEach(({el}) => { el.disabled = true; });
    const seen = new Set();
    update(); record('start', 0);
    try {
      for (let number = 1; number <= 100; number++) {
        check();
        if (results()) { status.textContent = 'Quiz termine. Aucun nouvel essai lance.'; return; }
        const data = await extractQuestionData();
        if (!data) throw new Error('Question non reconnue. Aucun appel supplementaire.');
        const before = signature(data);
        if (seen.has(before)) throw new Error('Question deja traitee dans cette session.');
        let required = data.requiredAnswers || 1;
        if (data.isMultipleAnswer) {
          const match = data.question.match(/(?:choisissez|s[eé]lectionnez|choisir|identifiez)\s*(?:les\s+)?(deux|trois|quatre|cinq|[2-5])/i);
          if (match) required = ({deux: 2, trois: 3, quatre: 4, cinq: 5})[match[1].toLowerCase()] || Number(match[1]);
        }
        const request = data.isMatching ? {action: 'getAnswer', modelType: 'gpt', isMatching: true, rows: data.rows} : {action: 'getAnswer', modelType: 'gpt', question: data.question, options: data.options.map(o => o.text), isMultipleAnswer: data.isMultipleAnswer, requiredAnswers: required};
        status.textContent = 'Question ' + number + ' : analyse IA...'; record('request', number);
        let timer;
        let response;
        try { response = await Promise.race([chrome.runtime.sendMessage(request), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Delai IA depasse. Aucun reessai automatique.')), 60000); })]); } finally { clearTimeout(timer); }
        check();
        if (!response?.success) throw new Error('Erreur IA : verifier fournisseur, modele, cle et quota.');
        const current = await extractQuestionData();
        if (!current || signature(current) !== before || results()) throw new Error('Page modifiee pendant la requete.');
        status.textContent = 'Question ' + number + ' : selection...';
        if (data.isMatching) await selectMatching(current, response.rowAnswers);
        else await selectMcq(current, response.answerIndex, required);
        check();
        let submit;
        if (!await poll(() => { submit = submitButton(); return submit && !submit.disabled; }, 3000)) throw new Error('Bouton Envoyer absent, ambigu ou desactive.');
        check();
        const latest = await extractQuestionData();
        if (!latest || signature(latest) !== before) throw new Error('Question modifiee avant envoi.');
        check(); seen.add(before);
        // One submission only. No trusted-click retry: ambiguous outcomes must stop.
        submit.click(); record('submit-once', number);
        status.textContent = 'Question ' + number + ' : attente de la suite...';
        const advanced = await poll(() => {
          if (results()) return true;
          const next = extractQuestionDataSync();
          return next && signature(next) !== before;
        });
        if (!advanced) throw new Error('Question suivante non detectee. Verifie l envoi ou avance manuellement, puis relance.');
        if (results()) { status.textContent = 'Quiz termine. Aucun nouvel essai lance.'; record('results', number); return; }
        await sleep(500);
      }
      throw new Error('Limite de securite de 100 questions atteinte.');
    } catch (error) {
      status.textContent = error.message; record(stopped ? 'stopped' : 'error', seen.size);
    } finally {
      running = false; moduleWalkState.running = false;
      if (manual?.isConnected) manual.inert = wasInert;
      disabledHelpers.forEach(({el, disabled}) => { if (el.isConnected) el.disabled = disabled; });
      update();
    }
  }
  function update() {
    const detected = !results() && findInShadowDOM('mcq-view, .matching__widget', document).some(visible);
    if (!host && !detected) return;
    if (!host) {
      host = document.createElement('div'); host.style.cssText = 'position:fixed;right:16px;top:12px;z-index:2147483647;';
      const root = host.attachShadow({mode: 'closed'});
      const style = document.createElement('style'); style.textContent = 'section{max-width:340px;padding:10px;background:#15202b;color:white;border-radius:8px;font:13px sans-serif}button{padding:8px;margin:3px;cursor:pointer}p{margin:6px 0}';
      const panel = document.createElement('section');
      start = document.createElement('button'); start.textContent = 'Demarrer le quiz automatique'; start.onclick = run;
      stop = document.createElement('button'); stop.textContent = 'Arreter';
      stop.onclick = () => { stopped = true; status.textContent = 'Arret demande. Une requete deja partie peut rester facturee. Aucun nouvel envoi apres son retour.'; };
      status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = 'Mode automatique desactive. Fournisseur configure dans la popup.';
      panel.append(start, stop, status); root.append(style, panel); document.body.append(host);
    }
    host.hidden = !detected && !running;
    start.disabled = running || moduleWalkState.running; stop.disabled = !running;
  }
  function init() { update(); setInterval(update, 1500); }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init, {once: true});
})();

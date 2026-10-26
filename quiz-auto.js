// Discreet automatic quiz launcher, always available unless hidden by settings.
(() => {
  let running = false, stopped = false, host, launcher, panel, start, stop, status, expanded = false;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el?.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const log = (event, number = 0) => console.info('[NetAIcad auto]', {event, number, time: new Date().toISOString()});
  function check() { if (stopped || !running) throw new Error('Arret demande.'); }
  function signature(data) { return JSON.stringify(data.isMatching ? data.rows : [data.question, data.options.map(o => o.text)]); }
  function buttons() { return [...new Set(findInShadowDOM('button', document))].filter(visible); }
  function submitButton() { const m = buttons().filter(b => /^(envoyer|submit)$/i.test(b.textContent.trim())); return m.length === 1 ? m[0] : null; }
  function results() { return !submitButton() && buttons().some(b => /^(r[eé]essayer|r[eé]initialiser|retry|retake)$/i.test(b.textContent.trim())); }
  async function poll(predicate, timeout = 12000) { const end = Date.now() + timeout; while (Date.now() < end) { check(); if (predicate()) return true; await sleep(200); } return false; }
  async function selectMcq(data, answerIndex, required) {
    const indices = Array.isArray(answerIndex) ? answerIndex : [answerIndex];
    if (indices.length !== (data.isMultipleAnswer ? required : 1) || new Set(indices).size !== indices.length || !indices.every(i => Number.isInteger(i) && i >= 0 && i < data.options.length)) throw new Error('Reponse IA non exploitable.');
    for (let i = 0; i < data.options.length; i++) {
      check(); const option = data.options[i], input = option.element?.querySelector('input');
      if (!input || !option.element.isConnected) throw new Error('Selection non verifiable.');
      const wanted = indices.includes(i);
      if (Boolean(input.checked) !== wanted && (wanted || input.type === 'checkbox')) {
        if (!await robustClick(option.element, () => Boolean(input.checked) === wanted)) throw new Error('Clic de reponse non confirme.');
      }
    }
    if (!data.options.every((o, i) => Boolean(o.element.querySelector('input')?.checked) === indices.includes(i))) throw new Error('Choix selectionnes differents de la reponse.');
  }
  async function selectMatching(data, answers) {
    if (!Array.isArray(answers) || answers.length !== data.rows.length || new Set(answers.map(a => a.index)).size !== data.rows.length) throw new Error('Associations IA invalides.');
    const widgets = [...new Set(findInShadowDOM('.matching__widget', document))].filter(visible);
    if (widgets.length !== 1) throw new Error('Zone associations ambigue.');
    const rows = [...new Set(findInShadowDOM('matching-dropdown-view', widgets[0]))];
    if (rows.length !== data.rows.length) throw new Error('Nombre de lignes modifie.');
    for (const answer of answers) {
      check();
      if (!Number.isInteger(answer.index) || !data.rows[answer.index]?.options.includes(answer.option)) throw new Error('Association hors liste.');
      const row = rows[answer.index], button = findInShadowDOM('.dropdown__btn.js-dropdown-btn', row)[0];
      if (!button || !await robustClick(button, () => button.getAttribute('aria-expanded') === 'true')) throw new Error('Liste non ouverte.');
      let options = [];
      if (!await poll(() => { options = [...new Set(findInShadowDOM('.dropdown__item.js-dropdown-list-item', document))].filter(visible); return options.length > 0; }, 2000)) throw new Error('Liste vide.');
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
    const helpers = ['netacad-ai-helper-btn-gpt', 'netacad-ai-helper-btn-gemini', 'netacad-ai-helper-btn-webai'].map(id => document.getElementById(id)).filter(Boolean).map(el => ({el, disabled: el.disabled}));
    helpers.forEach(({el}) => { el.disabled = true; });
    const seen = new Set(); update(); log('start');
    try {
      for (let number = 1; number <= 100; number++) {
        check();
        if (results()) { status.textContent = 'Quiz termine.'; return; }
        const data = await extractQuestionData();
        if (!data) throw new Error('Question non reconnue.');
        const before = signature(data);
        if (seen.has(before)) throw new Error('Question deja traitee.');
        let required = data.requiredAnswers || 1;
        if (data.isMultipleAnswer) {
          const match = data.question.match(/(?:choisissez|s[eé]lectionnez|choisir|identifiez)\s*(?:les\s+)?(deux|trois|quatre|cinq|[2-5])/i);
          if (match) required = ({deux: 2, trois: 3, quatre: 4, cinq: 5})[match[1].toLowerCase()] || Number(match[1]);
        }
        const request = data.isMatching ? {action: 'getAnswer', modelType: 'gpt', isMatching: true, rows: data.rows} : {action: 'getAnswer', modelType: 'gpt', question: data.question, options: data.options.map(o => o.text), isMultipleAnswer: data.isMultipleAnswer, requiredAnswers: required};
        status.textContent = 'Question ' + number + ' : analyse...'; log('request', number);
        let response, timer;
        try { response = await Promise.race([chrome.runtime.sendMessage(request), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Delai IA depasse.')), 60000); })]); } finally { clearTimeout(timer); }
        check();
        if (!response?.success) throw new Error('Erreur IA : verifier fournisseur, modele, cle et quota.');
        const current = await extractQuestionData();
        if (!current || signature(current) !== before || results()) throw new Error('Page modifiee pendant la requete.');
        status.textContent = 'Question ' + number + ' : selection...';
        if (data.isMatching) await selectMatching(current, response.rowAnswers); else await selectMcq(current, response.answerIndex, required);
        let submit;
        if (!await poll(() => { submit = submitButton(); return submit && !submit.disabled; }, 3000)) throw new Error('Bouton Envoyer absent ou desactive.');
        check();
        const latest = await extractQuestionData();
        if (!latest || signature(latest) !== before) throw new Error('Question modifiee avant envoi.');
        check(); seen.add(before); submit.click(); log('submit-once', number);
        status.textContent = 'Question ' + number + ' : attente...';
        const advanced = await poll(() => { if (results()) return true; const next = extractQuestionDataSync(); return next && signature(next) !== before; });
        if (!advanced) throw new Error('Question suivante non detectee.');
        if (results()) { status.textContent = 'Quiz termine.'; log('results', number); return; }
        await sleep(500);
      }
      throw new Error('Limite de 100 questions atteinte.');
    } catch (error) { status.textContent = error.message; log(stopped ? 'stopped' : 'error', seen.size); }
    finally {
      running = false; moduleWalkState.running = false;
      if (manual?.isConnected) manual.inert = wasInert;
      helpers.forEach(({el, disabled}) => { if (el.isConnected) el.disabled = disabled; });
      update();
    }
  }
  function mount() {
    if (!host) {
      host = document.createElement('div'); host.id = 'netacad-quiz-auto-control';
      host.style.cssText = 'position:fixed;right:16px;bottom:210px;z-index:2147483647;';
      const root = host.attachShadow({mode: 'closed'});
      const style = document.createElement('style');
      style.textContent = `button{font:13px system-ui;cursor:pointer;border:0}.launcher{width:34px;height:34px;border-radius:50%;background:rgba(21,32,43,.82);color:#dbe7f7;box-shadow:0 1px 5px rgba(0,0,0,.25);display:grid;place-items:center}.launcher:hover{background:rgba(21,32,43,.95)}.panel{display:none;margin-top:6px;max-width:300px;padding:10px;background:rgba(21,32,43,.94);color:#e9eff9;border:1px solid rgba(255,255,255,.12);border-radius:10px;backdrop-filter:blur(6px)}.open .panel{display:block}.panel button{padding:7px 10px;margin:3px 3px 3px 0;border-radius:6px;background:#2b6cb0;color:white}p{margin:6px 0 0;font-size:12px;color:#c8d5e8}`;
      launcher = document.createElement('button'); launcher.className = 'launcher'; launcher.type = 'button'; launcher.textContent = '•'; launcher.title = 'Quiz automatique'; launcher.setAttribute('aria-expanded', 'false');
      launcher.onclick = () => { expanded = !expanded; host.classList.toggle('open', expanded); launcher.setAttribute('aria-expanded', String(expanded)); };
      panel = document.createElement('div'); panel.className = 'panel';
      start = document.createElement('button'); start.type = 'button'; start.textContent = 'Demarrer'; start.onclick = run;
      stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Arreter'; stop.onclick = () => { stopped = true; status.textContent = 'Arret demande.'; };
      status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = 'Inactif.';
      panel.append(start, stop, status); root.append(style, launcher, panel); log('panel-created');
    }
    if (!host.isConnected) (document.getElementById('netacad-quiz-controls-dock') || document.body).append(host);
    // The launcher remains available on NetAcad pages. Its visibility is
    // controlled only by the dedicated Quiz automatique slider.
    host.hidden = false;
    host.style.removeProperty('display');
    host.style.removeProperty('visibility');
    host.style.removeProperty('opacity');
    host.style.removeProperty('pointer-events');
  }
  function update() {
    if (!document.body) return;
    mount();
    start.disabled = running || moduleWalkState.running; stop.disabled = !running;
    launcher.textContent = running ? '…' : '•';
    if (running && !expanded) { expanded = true; host.classList.add('open'); launcher.setAttribute('aria-expanded', 'true'); }
  }
  function safeUpdate() { try { update(); } catch (_) { console.warn('[NetAIcad auto] Mise a jour du lanceur impossible ; surveillance continue.'); } }
  setInterval(safeUpdate, 1000);
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; setTimeout(() => { queued = false; safeUpdate(); }, 150); } }).observe(document, {childList: true, subtree: true});
  log('script-ready'); safeUpdate();
})();

// Automatic quiz UI with bounded waits and answer-selection retries only.
(() => {
  if (globalThis.__netaiAutoMounted) return;
  globalThis.__netaiAutoMounted = true;
  let running = false, stopped = false, host, launcher, panel, start, stop, status, expanded = false;
  let lastQuizAt = 0;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const visible = el => el?.isConnected && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const log = (event, number = 0) => console.info('[NetAIcad auto]', {event, number, time: new Date().toISOString()});
  function check() { if (stopped || !running) throw new Error('Arret demande.'); }
  function signature(data) { return JSON.stringify(data.isMatching ? data.rows : [data.question, data.options.map(o => o.text)]); }
  function buttons() { return [...new Set(findInShadowDOM('button', document))].filter(visible); }
  function submitButton() { const m = buttons().filter(b => /^(envoyer|submit)$/i.test(b.textContent.trim())); return m.length === 1 ? m[0] : null; }
  function results() { return !submitButton() && buttons().some(b => /^(r[eé]essayer|r[eé]initialiser|retry|retake)$/i.test(b.textContent.trim())); }
  function transient(error) { return /^(Plusieurs questions occupent la zone visible|Question active ambigue|Consigne de la question visible introuvable|Options de la question visible incompletes|Code de la question non charge)/.test(String(error?.message || '')); }
  async function poll(predicate, timeout = 12000) { const end = Date.now() + timeout; while (Date.now() < end) { check(); if (predicate()) return true; await sleep(200); } return false; }
  async function selectMcq(data, answerIndex, required) {
    const indices = Array.isArray(answerIndex) ? answerIndex : [answerIndex];
    if (indices.length !== (data.isMultipleAnswer ? required : 1) || new Set(indices).size !== indices.length || !indices.every(i => Number.isInteger(i) && i >= 0 && i < data.options.length)) throw new Error('Reponse IA non exploitable.');
    const before = signature(data);
    for (let i = 0; i < data.options.length; i++) {
      check(); const option = data.options[i], input = option.element?.querySelector('input');
      if (!input || !option.element.isConnected) throw new Error('Selection non verifiable.');
      const wanted = indices.includes(i);
      if (Boolean(input.checked) !== wanted && (wanted || input.type === 'checkbox')) {
        await retryConfirmedAnswerClick({
          click:async () => { await robustClick(option.element, () => Boolean(input.checked) === wanted); },
          verify:() => Boolean(input.checked) === wanted,
          validate:async () => {
            check();
            if (!option.element.isConnected || option.element.querySelector('input') !== input) throw new Error('Controle de reponse remplace : relances annulees. Aucun envoi.');
            const current = await extractQuestionData();
            if (!current || signature(current) !== before || current.isMultipleAnswer !== data.isMultipleAnswer || current.requiredAnswers !== data.requiredAnswers || current.options[i]?.element !== option.element || results()) throw new Error('Question modifiee : relances du clic annulees. Aucun envoi.');
          },
          check,
          notify:attempt => { status.textContent = 'Selection : nouvelle tentative ' + attempt + '/3 du clic de reponse...'; log('answer-click-retry',attempt); },
          sleep
        });
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
    const seen = new Set(); safeUpdate(); log('start');
    try {
      for (let number = 1; number <= 100; number++) {
        check();
        if (results()) { status.textContent = 'Quiz termine.'; return; }
        const data = await waitForStableQuiz({read:extractQuestionData,key:value => signature(value) + JSON.stringify([value.isMultipleAnswer,value.requiredAnswers]),check,finished:results,notify:message => { status.textContent = message; },transient});
        if (!data) { status.textContent = 'Quiz termine.'; return; }
        const before = signature(data);
        if (seen.has(before)) throw new Error('Question deja traitee.');
        let required = data.requiredAnswers || 1;
        if (data.isMultipleAnswer) {
          const match = data.question.match(/(?:choisissez|s[eé]lectionnez|choisir|identifiez)\s*(?:les\s+)?(deux|trois|quatre|cinq|[2-5])/i);
          if (match) required = ({deux: 2, trois: 3, quatre: 4, cinq: 5})[match[1].toLowerCase()] || Number(match[1]);
        }
        const request = data.isMatching ? {action: 'getAnswer', modelType: 'gpt', isMatching: true, rows: data.rows} : {action: 'getAnswer', modelType: 'gpt', question: data.question, options: data.options.map(o => o.text), isMultipleAnswer: data.isMultipleAnswer, requiredAnswers: required};
        check();
        status.textContent = 'Question ' + number + ' : analyse...'; log('request', number);
        let response, timer;
        try { response = await Promise.race([chrome.runtime.sendMessage(request), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Delai IA depasse.')), 60000); })]); } finally { clearTimeout(timer); }
        check();
        if (!response?.success) throw new Error(formatAiError(response?.error, {questionNumber:number, expected:data.isMatching ? undefined : (data.isMultipleAnswer ? required : 1), optionCount:data.options?.length, question:data.question}));
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
        status.textContent = 'Question ' + number + ' : attente de la transition...';
        const advanced = await poll(() => {
          if (results()) return true;
          try { const next = extractQuestionDataSync(); return next && signature(next) !== before; }
          catch (error) { if (transient(error)) return false; throw error; }
        }, 15000);
        if (!advanced) throw new Error('Question suivante non detectee apres 15 s. Aucun nouvel envoi.');
        if (results()) { status.textContent = 'Quiz termine.'; log('results', number); return; }
      }
      throw new Error('Limite de 100 questions atteinte.');
    } catch (error) {
      status.textContent = error.message;
      expanded = true; host.classList.add('open'); launcher.setAttribute('aria-expanded', 'true');
      log(stopped ? 'stopped' : 'error', seen.size);
    }
    finally {
      running = false; moduleWalkState.running = false;
      if (manual?.isConnected) manual.inert = wasInert;
      helpers.forEach(({el, disabled}) => { if (el.isConnected) el.disabled = disabled; });
      safeUpdate();
    }
  }
  function mount() {
    if (!host) {
      host = document.createElement('div'); host.id = 'netacad-quiz-auto-control';
      host.style.cssText = 'position:fixed;right:12px;bottom:90px;z-index:2147483647;width:calc(100vw - 24px);max-width:360px;pointer-events:none;';
      const root = host.attachShadow({mode: 'closed'});
      const style = document.createElement('style');
      style.textContent = ':host{box-sizing:border-box;min-width:0}*{box-sizing:border-box}button{font:13px system-ui;cursor:pointer;border:0;pointer-events:auto}button:focus-visible{outline:2px solid #8dc4ff;outline-offset:2px}.launcher{margin-left:auto;width:34px;height:34px;border-radius:50%;background:#15202b;color:#dbe7f7;display:grid;place-items:center}.panel{display:none;margin-top:8px;width:100%;min-width:0;padding:12px;background:#15202b;color:#e9eff9;border-radius:10px;pointer-events:auto;overflow-wrap:anywhere}:host(.open) .panel{display:block}.panel button{max-width:100%;padding:8px;margin:3px;border-radius:6px;background:#2b6cb0;color:white}p{margin:6px 0 0;font:12px system-ui;max-height:35vh;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere}';
      launcher = document.createElement('button'); launcher.className = 'launcher'; launcher.type = 'button'; launcher.textContent = 'A'; launcher.title = 'Quiz automatique'; launcher.setAttribute('aria-label', 'Ouvrir ou fermer le panneau du quiz automatique'); launcher.setAttribute('aria-expanded', 'false'); launcher.setAttribute('aria-controls', 'auto-panel');
      launcher.onclick = () => { expanded = !expanded; host.classList.toggle('open', expanded); launcher.setAttribute('aria-expanded', String(expanded)); };
      panel = document.createElement('div'); panel.className = 'panel'; panel.id = 'auto-panel';
      start = document.createElement('button'); start.type = 'button'; start.textContent = 'Demarrer'; start.onclick = run;
      stop = document.createElement('button'); stop.type = 'button'; stop.textContent = 'Arreter'; stop.onclick = () => { stopped = true; status.textContent = 'Arret demande.'; };
      status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = 'Inactif.';
      panel.append(start, stop, status); root.append(style, launcher, panel); log('panel-created');
    }
    if (!host.isConnected) (document.getElementById('netacad-quiz-controls-dock') || document.body).append(host);
  }
  function update() {
    if (!document.body) return;
    const quiz = typeof findInShadowDOM === 'function' && findInShadowDOM('mcq-view, .matching__widget', document).some(visible);
    if (quiz) lastQuizAt = Date.now();
    if (!host && !quiz) return;
    mount();
    const absent = !quiz && !running && Date.now() - lastQuizAt > 3000;
    if (host.hidden !== absent) host.hidden = absent;
    start.disabled = running || moduleWalkState.running; stop.disabled = !running;
    launcher.textContent = running ? '...' : 'A';
    launcher.title = running ? 'Quiz automatique en cours : ouvrir pour arreter' : 'Quiz automatique';
  }
  function safeUpdate() { try { update(); } catch (_) { console.warn('[NetAIcad auto] Mise a jour du lanceur impossible ; surveillance continue.'); } }
  setInterval(safeUpdate, 1000);
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; setTimeout(() => { queued = false; safeUpdate(); }, 150); } }).observe(document, {childList: true, subtree: true});
  log('script-ready'); safeUpdate();
})();

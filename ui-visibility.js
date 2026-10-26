// Applies user visibility preferences to NetAIcad controls.
(() => {
  const ids = {log: 'netacad-local-diagnostics', quiz: 'netacad-quiz-only-control', auto: 'netacad-quiz-auto-control'};
  let prefs = {book: true, log: true, quiz: true, auto: true};
  function findBookControl() {
    return [...document.body.children].find(node => {
      if (!node?.shadowRoot) return false;
      const text = node.shadowRoot.textContent || '';
      return /livre|lire le module|parcours du module/i.test(text);
    });
  }
  function apply() {
    if (!document.body) return;
    for (const [key, id] of Object.entries(ids)) {
      const node = document.getElementById(id);
      if (node) node.style.setProperty('display', prefs[key] ? '' : 'none', 'important');
    }
    const book = findBookControl();
    if (book) book.style.setProperty('display', prefs.book ? '' : 'none', 'important');
  }
  async function load() {
    try { prefs = {book: true, log: true, quiz: true, auto: true, ...(await chrome.storage.local.get('uiVisibility')).uiVisibility}; }
    catch (_) { console.warn('[NetAIcad visibility] Preferences indisponibles ; affichage par defaut.'); }
    apply();
  }
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.uiVisibility) load(); });
  setInterval(apply, 1000);
  new MutationObserver(apply).observe(document, {childList: true, subtree: true});
  load();
})();

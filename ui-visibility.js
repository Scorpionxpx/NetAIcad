// Applies user visibility preferences to NetAIcad controls.
(() => {
  const ids = {log: 'netacad-local-diagnostics', quiz: 'netacad-quiz-only-control', auto: 'netacad-quiz-auto-control'};
  let prefs = {book: true, log: true, quiz: true, auto: true};
  const bookPattern = /\b(livre|lire|parcours|module)\b/i;
  const reserved = new Set(Object.values(ids));
  function controlText(node) {
    let text = '';
    if (node?.shadowRoot) text += node.shadowRoot.textContent || '';
    text += ' ' + (node?.textContent || '');
    return text;
  }
  function findBookControls() {
    if (!document.body) return [];
    return [...document.body.children].filter(node => {
      if (!node?.isConnected || reserved.has(node.id)) return false;
      if (!node.shadowRoot && !node.id?.startsWith('netacad')) return false;
      const text = controlText(node);
      if (/quiz|journal|logs? netaicad|diagnostic/i.test(text)) return false;
      return bookPattern.test(text);
    });
  }
  function setVisibility(node, show) {
    if (!node?.isConnected) return;
    node.style.setProperty('display', show ? '' : 'none', 'important');
    node.style.setProperty('visibility', show ? '' : 'hidden', 'important');
    node.style.setProperty('opacity', show ? '' : '0', 'important');
    node.style.setProperty('pointer-events', show ? '' : 'none', 'important');
  }
  function apply() {
    if (!document.body) return;
    for (const [key, id] of Object.entries(ids)) setVisibility(document.getElementById(id), prefs[key]);
    for (const book of findBookControls()) setVisibility(book, prefs.book);
  }
  async function load() {
    try { prefs = {book: true, log: true, quiz: true, auto: true, ...(await chrome.storage.local.get('uiVisibility')).uiVisibility}; }
    catch (_) { console.warn('[NetAIcad visibility] Preferences indisponibles ; affichage par defaut.'); }
    apply();
  }
  chrome.storage.onChanged.addListener((changes, area) => { if (area === 'local' && changes.uiVisibility) load(); });
  setInterval(apply, 800);
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; setTimeout(() => { queued = false; apply(); }, 120); } }).observe(document, {childList: true, subtree: true});
  load();
})();

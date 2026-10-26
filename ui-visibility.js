// Exact extension IDs only. CSS survives button recreation without changing inline styles.
(() => {
  const selectors = {
    book: '#netacad-ai-walker-btn',
    log: '#netacad-local-diagnostics',
    quiz: '#netacad-quiz-only-control',
    auto: '#netacad-quiz-auto-control'
  };
  const styleId = 'netacad-ui-visibility-rules';
  const observed = new WeakSet(), watchedFrames = new WeakSet();
  let prefs = {}, ready = false, queued = false, revision = 0;
  function rules() {
    return Object.entries(selectors).filter(([key]) => !ready || prefs[key] === false).map(([, selector]) => selector + '{display:none!important;}').join('\n');
  }
  function schedule() {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; apply(); }, 50);
  }
  function install(doc, css, seen) {
    if (!doc || seen.has(doc)) return;
    seen.add(doc);
    const parent = doc.head || doc.documentElement;
    if (!parent) return;
    let style = doc.getElementById(styleId);
    if (!style) {
      style = doc.createElement('style'); style.id = styleId;
      style.textContent = css; parent.appendChild(style);
    } else if (style.textContent !== css) style.textContent = css;
    if (!observed.has(doc)) {
      observed.add(doc);
      new MutationObserver(schedule).observe(doc, {childList:true,subtree:true});
    }
    // The top-frame walker inserts its button into the course iframe.
    // Apply there as well even if that frame has no content-script instance.
    for (const frame of doc.querySelectorAll('iframe')) {
      if (!watchedFrames.has(frame)) {
        watchedFrames.add(frame); frame.addEventListener('load', schedule);
      }
      try { install(frame.contentDocument, css, seen); } catch (_) { /* Other-origin frames use their own content script. */ }
    }
  }
  function apply() { install(document, rules(), new Set()); }
  async function load() {
    const current = ++revision;
    try {
      const saved = await chrome.storage.local.get('uiVisibility');
      if (current !== revision) return;
      prefs = saved.uiVisibility || {}; ready = true; apply();
    } catch (_) {
      if (current !== revision) return;
      ready = true; apply();
      console.warn('[NetAIcad visibility] Lecture des preferences impossible.');
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.uiVisibility) return;
    ++revision; prefs = changes.uiVisibility.newValue || {}; ready = true; apply();
  });
  apply(); load();
})();

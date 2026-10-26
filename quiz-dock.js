// Move existing hosts, preserving closed-shadow controls and listeners.
(() => {
  let dock;
  let pending = false;
  function arrange() {
    pending = false;
    if (!document.body) return;
    try {
      const manual = document.getElementById('netacad-quiz-only-control');
      const auto = document.getElementById('netacad-quiz-auto-control');
      if (!manual && !auto) return;
      if (!dock) {
        dock = document.createElement('div');
        dock.id = 'netacad-quiz-controls-dock';
        dock.style.cssText = 'position:fixed;right:16px;bottom:90px;z-index:2147483647;display:flex;flex-direction:column;align-items:flex-end;gap:8px;max-width:calc(100vw - 32px);max-height:calc(100vh - 110px);overflow:auto;';
        dock.setAttribute('role', 'region');
        dock.setAttribute('aria-label', 'Commandes du quiz NetAIcad');
      }
      if (!dock.isConnected) document.body.append(dock);
      for (const panel of [manual, auto]) {
        if (!panel) continue;
        if (panel.parentElement !== dock) dock.append(panel);
        for (const [name, value] of Object.entries({position: 'static', top: 'auto', right: 'auto', bottom: 'auto', left: 'auto', 'max-width': '100%'})) {
          if (panel.style.getPropertyValue(name) !== value || panel.style.getPropertyPriority(name) !== 'important') panel.style.setProperty(name, value, 'important');
        }
      }
      if (manual && auto && dock.firstElementChild !== manual) dock.insertBefore(manual, auto);
    } catch (_) { console.warn('[NetAIcad quiz dock] Placement failed; next check will retry.'); }
  }
  function schedule() {
    if (pending) return; pending = true; setTimeout(arrange, 100);
  }
  new MutationObserver(schedule).observe(document, {childList: true, subtree: true});
  setInterval(arrange, 1500);
  arrange();
})();

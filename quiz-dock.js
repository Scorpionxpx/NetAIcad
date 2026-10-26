// Own placement only; never change visibility preferences.
(() => {
  let dock, pending = false;
  function arrange() {
    pending = false;
    if (!document.body) return;
    const controls = ['netacad-quiz-only-control', 'netacad-quiz-auto-control'].map(id => document.getElementById(id)).filter(Boolean);
    if (!controls.length) return;
    if (!dock) {
      dock = document.createElement('div');
      dock.id = 'netacad-quiz-controls-dock';
      dock.setAttribute('role', 'region');
      dock.setAttribute('aria-label', 'Commandes du quiz NetAIcad');
      dock.style.cssText = 'position:fixed;right:12px;bottom:90px;z-index:2147483647;display:flex;flex-direction:column;align-items:flex-end;gap:10px;width:calc(100vw - 24px);max-width:360px;max-height:calc(100vh - 110px);overflow:auto;box-sizing:border-box;pointer-events:none;';
    }
    if (!dock.isConnected) document.body.append(dock);
    for (const control of controls) {
      if (control.parentElement !== dock) dock.append(control);
      const values = {position:'relative',top:'auto',right:'auto',bottom:'auto',left:'auto',width:'100%','min-width':'0','max-width':'100%','box-sizing':'border-box','flex-shrink':'0'};
      for (const [name, value] of Object.entries(values)) {
        if (control.style.getPropertyValue(name) !== value || control.style.getPropertyPriority(name) !== 'important') control.style.setProperty(name, value, 'important');
      }
    }
    if (controls.length === 2 && dock.firstElementChild !== controls[0]) dock.insertBefore(controls[0], controls[1]);
  }
  function schedule() { if (!pending) { pending = true; setTimeout(arrange, 100); } }
  new MutationObserver(schedule).observe(document, {childList:true,subtree:true});
  setInterval(arrange, 1500);
  arrange();
})();

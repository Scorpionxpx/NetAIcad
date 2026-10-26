// Explicit alias for the existing GPT quiz command. No module navigation.
(() => {
  let host;
  let button;
  let status;
  let pending = false;
  function target() {
    const candidate = document.getElementById('netacad-ai-helper-btn-gpt');
    if (!candidate || !candidate.getClientRects().length) return null;
    const style = getComputedStyle(candidate);
    return style.visibility === 'hidden' || style.display === 'none' ? null : candidate;
  }
  function sync() {
    const current = target();
    if (!current) { if (host) host.hidden = true; return; }
    if (!host) {
      host = document.createElement('div');
      host.id = 'netacad-quiz-only-control';
      host.style.cssText = 'position:fixed;right:16px;bottom:90px;z-index:2147483646;';
      const root = host.attachShadow({mode: 'closed'});
      const style = document.createElement('style');
      style.textContent = 'div{max-width:260px;background:#15202b;color:white;border-radius:8px;padding:10px;font:13px sans-serif}button{padding:10px;cursor:pointer}p{margin:8px 0 0}';
      const panel = document.createElement('div');
      button = document.createElement('button');
      button.textContent = 'Quiz uniquement — OpenAI';
      button.title = 'Declenche la commande GPT du quiz ouvert, sans lancer le parcours du module.';
      status = document.createElement('p');
      status.setAttribute('role', 'status');
      status.textContent = 'Quiz ouvert uniquement. Utilise le comportement GPT existant.';
      button.onclick = () => {
        const original = target();
        if (!original || original.disabled) return;
        let moduleBusy = moduleWalkState.running;
        try {
          if (window !== window.top) moduleBusy = moduleBusy || Boolean(window.top.document.getElementById('netacad-ai-overlay'));
        } catch (_) {
          status.textContent = 'Impossible de verifier le parcours principal. Arrete-le avant de continuer.';
          return;
        }
        if (moduleBusy) {
          status.textContent = 'Arrete le parcours du module avant de lancer le quiz separement.';
          return;
        }
        original.click();
        status.textContent = 'Commande GPT declenchee. Consulte son resultat avant de relancer.';
        sync();
      };
      panel.append(button, status); root.append(style, panel);
      document.body.append(host);
    }
    host.hidden = false;
    const disabled = Boolean(current.disabled);
    if (button.disabled !== disabled) button.disabled = disabled;
  }
  function schedule() {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; sync(); }, 150);
  }
  function init() {
    if (!document.body) return;
    sync();
    new MutationObserver(schedule).observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['disabled', 'hidden', 'style', 'class']});
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init, {once: true});
})();

// Observe before quiz-auto.js mounts its closed-shadow panel.
// Retain the exact host and listeners; never click controls or change hidden state.
(() => {
  const id = 'netacad-quiz-auto-control';
  let host = null;
  let pending = false;
  let restores = [];
  let paused = false;
  const log = event => console.info('[NetAIcad auto panel]', {event, time: new Date().toISOString()});
  function candidate(node) {
    return node?.nodeType === 1 && node.tagName === 'DIV' && node.ownerDocument === document &&
      (node.id === id || (!node.id && node.style.position === 'fixed' && node.style.top === '12px' && node.style.right === '16px' && node.style.zIndex === '2147483647'));
  }
  function remember(node) {
    if (host || !candidate(node)) return;
    host = node; host.id = id; log('panel-observed');
  }
  function scan(node) {
    if (host || !node) return;
    remember(node);
    if (!host && node.querySelectorAll) {
      for (const el of node.querySelectorAll('div')) { remember(el); if (host) break; }
    }
  }
  function repair() {
    pending = false;
    if (paused) return;
    try {
      if (!host) scan(document.body);
      if (!host || host.isConnected || !document.body) return;
      log('panel-detached');
      const now = Date.now();
      restores = restores.filter(time => now - time < 10000);
      if (restores.length >= 5) {
        paused = true;
        console.warn('[NetAIcad auto panel] Repeated DOM removals: repair paused. Reload the page before another test.');
        return;
      }
      const duplicate = document.getElementById(id);
      if (duplicate && duplicate !== host) {
        paused = true; log('duplicate-panel-detected'); return;
      }
      document.body.append(host);
      restores.push(now); log('panel-restored');
    } catch (_) { console.warn('[NetAIcad auto panel] Panel repair failed; next check will retry.'); }
  }
  function schedule() {
    if (pending || paused) return;
    pending = true; setTimeout(repair, 100);
  }
  const observer = new MutationObserver(records => {
    try {
      for (const record of records) {
        for (const node of record.addedNodes) scan(node);
      }
      if (!host || !host.isConnected) schedule();
    } catch (_) { console.warn('[NetAIcad auto panel] DOM observation failed; periodic check remains active.'); }
  });
  observer.observe(document, {childList: true, subtree: true});
  setInterval(repair, 1500);
  log('repair-ready');
  repair();
})();

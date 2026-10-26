// Conservative overrides loaded after content.js; never write completion state.
(() => {
  const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
  function checkStop() {
    if (moduleWalkState.stopRequested) throw new Error('Parcours interrompu.');
  }
  async function pause(ms) {
    const end = Date.now() + ms;
    while (Date.now() < end) { checkStop(); await delay(Math.min(100, end - Date.now())); }
  }
  const originalLocate = locateCurrentOutlineGroupIndex;
  locateCurrentOutlineGroupIndex = function(buttons) {
    const found = originalLocate(buttons);
    if (found !== -1) return found;
    const frame = getContentIframe();
    const title = frame?.contentDocument?.title || '';
    const match = title.split('|').slice(1).join('|').trim().match(/^(\d+)\./);
    if (!match) return -1;
    const pattern = new RegExp('Modules?\\s+' + match[1] + '(?!\\d)\\s*[.:]', 'i');
    return buttons.findIndex(b => isOutlineGroupHeaderButton(b) && pattern.test(b.textContent || ''));
  };
  smoothScrollIntoView = async function(target, block = 'end') {
    if (!target?.isConnected) throw new Error('Element de lecture indisponible.');
    checkStop();
    target.scrollIntoView({block, behavior: 'smooth'});
    let previous = target.getBoundingClientRect().top;
    let stableSince = Date.now();
    const started = Date.now();
    while (Date.now() - started < 6000) {
      await pause(100);
      if (!target.isConnected) throw new Error('La page a change pendant le defilement.');
      const top = target.getBoundingClientRect().top;
      if (Math.abs(top - previous) > 0.5) stableSince = Date.now();
      previous = top;
      if (Date.now() - started >= 800 && Date.now() - stableSince >= 400) return;
    }
    throw new Error('Le defilement ne se stabilise pas.');
  };
  async function playVideo(video) {
    checkStop();
    if (video.ended) return;
    if (video.loop) throw new Error('Video en boucle : intervention manuelle requise.');
    video.playbackRate = 1;
    let playing;
    try {
      playing = video.play();
      await Promise.race([playing, delay(15000).then(() => { throw new Error('Demarrage video trop long.'); })]);
    } catch (error) {
      video.pause();
      throw new Error('Lance la video manuellement puis relance le parcours : ' + error.message);
    }
    let lastTime = video.currentTime;
    let lastProgress = Date.now();
    try {
      while (!video.ended) {
        await pause(250);
        if (!video.isConnected || video.error) throw new Error('Video indisponible.');
        if (video.currentTime > lastTime) { lastTime = video.currentTime; lastProgress = Date.now(); }
        if (video.paused) throw new Error('Video en pause : intervention manuelle requise.');
        if (Date.now() - lastProgress > 30000) throw new Error('Video bloquee depuis 30 secondes.');
      }
    } catch (error) { video.pause(); throw error; }
  }
  handleReadingSection = async function(elements) {
    const blocks = elements.filter(el => el?.isConnected && el.getBoundingClientRect);
    if (!blocks.length) throw new Error('Section de lecture introuvable.');
    for (const block of blocks) {
      await smoothScrollIntoView(block, 'start');
      const doc = block.ownerDocument;
      const view = doc.defaultView;
      let node = block.parentElement;
      while (node && node !== doc.documentElement) {
        const style = view.getComputedStyle(node);
        if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) break;
        node = node.parentElement;
      }
      const scroller = node && node !== doc.documentElement ? node : doc.scrollingElement;
      if (!scroller) throw new Error('Conteneur de defilement introuvable.');
      for (let steps = 0; steps < 500; steps++) {
        checkStop();
        const bottom = block.getBoundingClientRect().bottom;
        const edge = scroller === doc.scrollingElement ? view.innerHeight : scroller.getBoundingClientRect().bottom;
        if (bottom <= edge + 2) break;
        const before = scroller.scrollTop;
        scroller.scrollBy({top: Math.max(80, Math.min(500, scroller.clientHeight * 0.65)), behavior: 'smooth'});
        await pause(1200);
        if (Math.abs(scroller.scrollTop - before) < 1) throw new Error('Defilement bloque : verifier la page manuellement.');
        if (steps === 499) throw new Error('Limite de defilement atteinte.');
      }
      const videos = [...new Set(findInShadowDOM('video', block))];
      for (const video of videos) { await smoothScrollIntoView(video, 'center'); await playVideo(video); }
      if (findInShadowDOM('iframe', block).length) throw new Error('Contenu integre : verifier manuellement la lecture et les interactions.');
    }
    const headings = [...new Set(blocks.flatMap(block => findInShadowDOM('.js-heading', block)))];
    const initiallyIncomplete = headings.filter(h => h.classList.contains('is-incomplete'));
    if (!initiallyIncomplete.length) throw new Error('Impossible de confirmer la progression de cette section : verification manuelle requise.');
    const complete = await waitFor(() => { checkStop(); return initiallyIncomplete.every(h => h.isConnected && !h.classList.contains('is-incomplete')); }, 15000, 100);
    if (!complete) throw new Error('La section reste incomplete : verifier les videos et interactions manuellement.');
    return true;
  };
})();

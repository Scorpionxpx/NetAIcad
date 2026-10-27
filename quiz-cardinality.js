function resolveQuizCardinality(question, inputTypes, optionCount) {
  const fail = message => { throw new Error(message); };
  if (!Number.isInteger(optionCount) || optionCount < 1 || optionCount > 26 || inputTypes.length !== optionCount) fail('Options de question incompletes : aucun appel IA.');
  const types = new Set(inputTypes);
  if (types.size !== 1 || !['radio','checkbox'].includes(inputTypes[0])) fail('Type de selection inconnu ou incoherent : aucun appel IA.');
  const words = {un:1,une:1,deux:2,trois:3,quatre:4,cinq:5,six:6,sept:7,huit:8,neuf:9,dix:10,one:1,two:2,three:3,four:4,five:5,seven:7,eight:8,nine:9,ten:10};
  const text = String(question || '').split(/\n\s*Code\s*:/i)[0].normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const pattern = /\b(?:choisissez|selectionnez|selectionner|choisir|identifiez|choose|select|pick|identify)\s+(?:(?:les|the|exactement|exactly)\s+)*(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|one|two|three|four|five|seven|eight|nine|ten|\d{1,2})\b/g;
  const counts = [...new Set([...text.matchAll(pattern)].map(match => words[match[1]] || Number(match[1])))];
  if (counts.length > 1) fail('Consignes contradictoires sur le nombre de choix : aucun appel IA.');
  const count = counts[0];
  if (count !== undefined && (!Number.isInteger(count) || count < 1 || count > optionCount)) fail('Nombre demande incompatible avec les options extraites : aucun appel IA.');
  if (inputTypes[0] === 'radio') {
    if (count !== undefined && count !== 1) fail('La consigne demande ' + count + ' choix mais les controles sont a choix unique : aucun appel IA.');
    return {isMultipleAnswer:false,requiredAnswers:1,answerCountSource:count === 1 ? 'instruction-and-radio' : 'radio'};
  }
  if (count === undefined) fail('Cases a cocher detectees mais nombre de reponses non precise dans la consigne extraite : aucun appel IA.');
  return {isMultipleAnswer:true,requiredAnswers:count,answerCountSource:'instruction-and-checkbox'};
}
function quizIntersectionArea(rect, clip) {
  return Math.max(0,Math.min(rect.right,clip.right)-Math.max(rect.left,clip.left)) * Math.max(0,Math.min(rect.bottom,clip.bottom)-Math.max(rect.top,clip.top));
}
function chooseQuizCandidate(candidates) {
  const shown = candidates.filter(candidate => Number.isFinite(candidate.area) && candidate.area > 1);
  return shown.length === 1 ? shown[0].widget : null;
}
if (typeof module !== 'undefined') module.exports = {resolveQuizCardinality,quizIntersectionArea,chooseQuizCandidate};

(() => {
  if (typeof document === 'undefined' || typeof extractMcqQuestionData !== 'function') return;
  function shownByStyle(node) {
    if (!node?.isConnected || !node.getClientRects().length) return false;
    let cursor = node;
    while (cursor?.nodeType === 1) {
      const style = cursor.ownerDocument.defaultView.getComputedStyle(cursor);
      if (cursor.hidden || cursor.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      cursor = cursor.parentElement || cursor.getRootNode()?.host;
    }
    return true;
  }
  function visibleArea(node) {
    if (!shownByStyle(node)) return 0;
    const view = node.ownerDocument.defaultView;
    const clip = {left:0,top:0,right:view.innerWidth,bottom:view.innerHeight};
    let cursor = node.parentElement || node.getRootNode()?.host;
    while (cursor?.nodeType === 1) {
      const style = view.getComputedStyle(cursor), bounds = cursor.getBoundingClientRect();
      if (bounds.width > 0 && /(hidden|clip|auto|scroll)/.test(style.overflowX)) { clip.left = Math.max(clip.left,bounds.left); clip.right = Math.min(clip.right,bounds.right); }
      if (bounds.height > 0 && /(hidden|clip|auto|scroll)/.test(style.overflowY)) { clip.top = Math.max(clip.top,bounds.top); clip.bottom = Math.min(clip.bottom,bounds.bottom); }
      cursor = cursor.parentElement || cursor.getRootNode()?.host;
    }
    return quizIntersectionArea(node.getBoundingClientRect(),clip);
  }
  extractMcqQuestionData = function() {
    const candidates = [...new Set(findInShadowDOM('mcq-view',document))].map(widget => ({widget,area:[...(widget.shadowRoot?.querySelectorAll('.mcq__item') || [])].reduce((sum,item) => sum + visibleArea(item),0)}));
    const active = candidates.filter(candidate => candidate.area > 1);
    if (!active.length) return null;
    const widget = chooseQuizCandidate(candidates);
    if (!widget) throw new Error('Plusieurs questions occupent la zone visible pendant la transition. Aucun appel IA.');
    const root = widget.shadowRoot;
    const header = root.querySelector('.component__header-container');
    const bodies = header ? [...new Set(findInShadowDOM('.component__body-inner.mcq__body-inner',header))] : [];
    if (bodies.length !== 1 || !bodies[0].textContent.trim()) throw new Error('Consigne de la question visible introuvable : aucun appel IA.');
    let question = bodies[0].textContent.trim();
    const options = [...root.querySelectorAll('.mcq__item-text-inner')].map((node,index) => ({index,text:node.textContent.trim(),element:node.closest('.mcq__item')}));
    if (!options.length || !options.every(option => shownByStyle(option.element))) throw new Error('Options de la question visible incompletes : aucun appel IA.');
    const metadata = resolveQuizCardinality(question,options.map(option => option.element.querySelector('input')?.type || 'unknown'),options.length);
    const codeWithMcq = root.querySelector('code-with-mcq');
    if (codeWithMcq) {
      const code = codeWithMcq.shadowRoot?.querySelector('div.component')?.textContent?.trim();
      if (!code) throw new Error('Code de la question non charge : aucun appel IA.');
      question += '\n\nCode:\n' + code;
    } else if (root.querySelector('sgpluse-codewindowwithmcq-view')) {
      const windows = [...new Set(findInShadowDOM('code-window-webcomponent-mcq',widget))];
      const code = windows.map(node => node.shadowRoot?.querySelector('.code-container')?.textContent?.trim() || '').filter(Boolean).join('\n');
      if (!code) throw new Error('Code de la question non charge : aucun appel IA.');
      question += '\n\nCode:\n' + code;
    }
    return {question,options,...metadata,activeQuestionSource:'viewport-clipped-options'};
  };
})();

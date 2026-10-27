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
if (typeof module !== 'undefined') module.exports = {resolveQuizCardinality};

// One validation boundary shared by synchronous and asynchronous extraction users.
(() => {
  if (typeof document === 'undefined' || typeof extractMcqQuestionData !== 'function') return;
  const original = extractMcqQuestionData;
  function visible(node) {
    if (!node?.isConnected || !node.getClientRects().length) return false;
    let cursor = node;
    while (cursor?.nodeType === 1) {
      const style = cursor.ownerDocument.defaultView.getComputedStyle(cursor);
      if (cursor.hidden || style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
      cursor = cursor.parentElement || cursor.getRootNode()?.host;
    }
    return true;
  }
  extractMcqQuestionData = function() {
    const data = original();
    if (!data) return data;
    const options = data.options || [];
    if (!options.length || !options.every(option => visible(option.element))) throw new Error('La question extraite contient des options absentes ou masquees : aucun appel IA.');
    const root = options[0].element.getRootNode();
    if (!root.host?.matches('mcq-view') || !options.every(option => option.element.getRootNode() === root)) throw new Error('Les options ne proviennent pas d une meme question : aucun appel IA.');
    const candidates = [...new Set(findInShadowDOM('mcq-view',document))].filter(widget => [...(widget.shadowRoot?.querySelectorAll('.mcq__item') || [])].some(visible));
    if (candidates.length !== 1 || candidates[0] !== root.host) throw new Error('Question active ambigue : attends la fin du chargement. Aucun appel IA.');
    const inputs = options.map(option => option.element.querySelector('input'));
    const metadata = resolveQuizCardinality(data.question,inputs.map(input => input?.type || 'unknown'),options.length);
    return {...data,...metadata};
  };
})();

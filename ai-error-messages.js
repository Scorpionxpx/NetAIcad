function formatAiError(raw, context = {}) {
  const text = String(typeof raw === 'string' ? raw : raw?.message || '');
  const messages = {
    OUTPUT_COUNT: 'Nombre de reponses incompatible avec la demande.',
    OUTPUT_SYNTAX: 'La sortie recue ne respecte pas le format de reponse attendu.',
    OUTPUT_RANGE: 'La reponse designe une option absente de la liste extraite.',
    OUTPUT_DUPLICATE: 'La reponse contient plusieurs fois le meme choix.',
    INPUT_COUNTS: 'Le nombre d options ou de reponses attendu est invalide avant appel API.',
    PROVIDER_REFUSAL: 'OpenAI a renvoye un refus explicite. Aucune reponse selectionnee.',
    REQUEST_CONFIGURATION: 'OpenAI refuse un parametre de la requete. Consulte apiErrorParam dans les logs.',
    QUOTA_EXHAUSTED: 'OpenAI signale un quota ou des credits API epuises.',
    RATE_LIMIT: 'OpenAI signale une limite temporaire de requetes ou de tokens.',
    AUTHENTICATION: 'Le fournisseur refuse la cle API utilisee.',
    PERMISSION: 'Le fournisseur refuse les permissions de cette requete.',
    MODEL_OR_ENDPOINT: 'Le modele ou le point d acces demande est introuvable ou inaccessible.',
    MODEL_CONFIGURATION: 'L identifiant du modele configure est invalide.',
    RESPONSE_INCOMPLETE: 'OpenAI n a pas termine la reponse. Consulte incompleteReason dans les logs.',
    OUTPUT_EMPTY: 'OpenAI n a fourni aucun texte de reponse exploitable.',
    TIMEOUT: 'Le delai d attente IA est depasse. Aucun nouvel essai automatique.',
    NETWORK_OR_RESPONSE: 'Probleme de reseau ou de lecture de la reponse IA.',
    MATCHING_COUNT: 'Le nombre de lignes d associations recues ne correspond pas a la demande.',
    MATCHING_SYNTAX: 'Le format des lignes d associations est invalide.',
    MATCHING_OPTION: 'Une association recue ne correspond pas aux options de sa ligne.',
    INPUT_ROWS: 'Les lignes de la question a associations sont invalides.',
    PROVIDER_SERVER: 'Le fournisseur rencontre une erreur serveur.',
    HTTP_ERROR: 'Le fournisseur a rejete la requete. Consulte les logs pour le code API.',
    RESPONSE_NOT_JSON: 'La reponse IA n est pas un document JSON lisible.',
    HTTP_ERROR_NOT_JSON: 'Le fournisseur a renvoye une erreur sans detail JSON lisible.'
  };
  let code = text.match(/\[([A-Z_]+)\]/)?.[1];
  if (!Object.hasOwn(messages, code || '')) code = '';
  if (!code && /key.*not configured/i.test(text)) code = 'MISSING_KEY';
  if (!code && /timeout|delai|abort/i.test(text)) code = 'TIMEOUT';
  const http = text.match(/\bHTTP\s+([45]\d{2})\b/i)?.[1];
  const lines = [];
  if (Number.isInteger(context.questionNumber) && context.questionNumber > 0 && context.questionNumber <= 100) lines.push('Question ' + context.questionNumber + ' : traitement arrete.');
  lines.push(code === 'MISSING_KEY' ? 'Aucune cle API configuree pour le fournisseur utilise.' : messages[code] || 'Erreur IA non identifiee. Exporte les logs pour connaitre l etape de l echec.');
  if (code) lines.push('Code : ' + code + (http ? ' | HTTP ' + http : ''));
  else if (http) lines.push('HTTP ' + http);
  if (['OUTPUT_COUNT','INPUT_COUNTS'].includes(code)) {
    const expected = context.expected, available = context.optionCount;
    if (Number.isInteger(expected) && expected > 0 && expected <= 26) lines.push('Reponses attendues par l extension : ' + expected + '.');
    if (Number.isInteger(available) && available > 0 && available <= 26) lines.push('Options extraites : ' + available + '.');
    const normalized = String(context.question || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const match = normalized.match(/\b(?:choisissez|selectionnez|choisir|select|choose)\s+(?:les\s+)?(deux|trois|quatre|cinq|two|three|four|five|[2-5])\b/);
    const words = {deux:2,trois:3,quatre:4,cinq:5,two:2,three:3,four:4,five:5};
    const indicated = match ? words[match[1]] || Number(match[1]) : null;
    if (indicated && indicated !== expected) lines.push('Attention : la consigne extraite mentionne ' + indicated + ' choix. Verifie la detection de cette question.');
  }
  lines.push('Aucune nouvelle soumission apres cette erreur. Un appel IA deja effectue peut etre facture.');
  return lines.join('\n');
}
if (typeof module !== 'undefined') module.exports = {formatAiError};

function parseMcq(text, optionCount, required) {
  const fail = code => { throw new Error('OpenAI answer format invalid [' + code + '].'); };
  if (!Number.isInteger(optionCount) || optionCount < 1 || optionCount > 26 || !Number.isInteger(required) || required < 1 || required > optionCount) fail('INPUT_COUNTS');
  if (typeof text !== 'string') fail('OUTPUT_SYNTAX');
  let value = text.replace(/^\uFEFF/, '').replace(/\u00a0/g, ' ').trim();
  const fence = value.match(/^```(?:text|plaintext)?\s*\n([\s\S]*?)\n```$/i);
  if (fence) value = fence[1].trim();
  const bold = value.match(/^(\*\*|__)([\s\S]*?)\1$/);
  if (bold) value = bold[2].trim();
  value = value.replace(/^(?:answers?|r[eé]ponses?)\s*:\s*/i, '').trim();
  const innerBold = value.match(/^(\*\*|__)([\s\S]*?)\1$/);
  if (innerBold) value = innerBold[2].trim();
  value = value.replace(/\.$/, '').trim();
  if (!/^(?:[A-Z]|\([A-Z]\))(?:\s*[,;]\s*(?:[A-Z]|\([A-Z]\)))*$/i.test(value)) fail('OUTPUT_SYNTAX');
  const indices = value.split(/[,;]/).map(token => token.replace(/[()\s]/g, '').toUpperCase().charCodeAt(0) - 65);
  if (indices.some(i => i < 0 || i >= optionCount)) fail('OUTPUT_RANGE');
  if (new Set(indices).size !== indices.length) fail('OUTPUT_DUPLICATE');
  if (indices.length !== required) fail('OUTPUT_COUNT');
  return indices;
}
if (typeof module !== 'undefined') module.exports = {parseMcq};

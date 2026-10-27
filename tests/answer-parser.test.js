const {test} = require('node:test');
const assert = require('node:assert/strict');
const {parseMcq} = require('../answer-parser.js');
const cases = [
  ['B',4,1,[1]],['B.',4,1,[1]],['Réponse : B',4,1,[1]],
  ['**B**',4,1,[1]],['Answer: **B**',4,1,[1]],
  ['```text\nB\n```',4,1,[1]],['(A); (C)',4,2,[0,2]],['A,C',4,2,[0,2]],
  ['B because it is correct',4,1,null],['Answer: B or C',4,1,null],
  ['B,C',4,1,null],['A,A',4,2,null],['Z',4,1,null],['',4,1,null],
  ['B\nC',4,1,null],['The answer is B',4,1,null],['A',0,1,null]
];
for (const [text,n,k,expected] of cases) test(JSON.stringify({text,n,k}), () => {
  if (expected === null) assert.throws(() => parseMcq(text,n,k));
  else assert.deepEqual(parseMcq(text,n,k),expected);
});

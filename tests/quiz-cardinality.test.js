const {test} = require('node:test');
const assert = require('node:assert/strict');
const {resolveQuizCardinality} = require('../quiz-cardinality.js');
const c = n => Array(n).fill('checkbox'), r = n => Array(n).fill('radio');
const cases = [
  ['Choisissez trois.',c(5),5,3],
  ['Sélectionnez les deux bonnes réponses.',c(4),4,2],
  ['Choose exactly two.',c(4),4,2],
  ['Question simple',r(4),4,1],
  ['Choisissez trois.',r(4),4,null],
  ['Choisissez deux. Select three.',c(4),4,null],
  ['Question sans nombre',c(4),4,null],
  ['Choisissez six.',c(6),6,6],
  ['Choisissez cinq.',c(4),4,null],
  ['Choose one.',c(4),4,1],
  ['Question',['radio','checkbox'],2,null],
  ['Question',['radio'],2,null],
  ['Question\n\nCode:\nchoose two',r(4),4,1]
];
for (const [q,types,n,expected] of cases) test(JSON.stringify({q,types,n}), () => {
  if (expected === null) assert.throws(() => resolveQuizCardinality(q,types,n));
  else assert.equal(resolveQuizCardinality(q,types,n).requiredAnswers,expected);
});

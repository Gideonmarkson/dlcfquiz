import { parseQuestionsFromRawText } from '../src/lib/pdfExtractor.js';

const sampleText = `
2. Who was swallowed by a big fish?
  A. Jonah
  B. Peter
  C. Paul
  Correct answer: A. Jonah

3. What is the first book of the Bible?
  A. Exodus
  B. Psalms
  C. Genesis
  Correct answer: C. Genesis

4. Who defeated Goliath?
  A. David
  B. Solomon
  C. Samson
  Correct answer: A. David

5. Where was Jesus born?
  A. Jerusalem
  B. Bethlehem
  C. Nazareth
  Correct answer: B. Bethlehem

6. How many disciples did Jesus choose?
  A. 10
  B. 12
  C. 20
  Correct answer: B. 12

7. Who received the Ten Commandments?
  A. Moses
  B. Abraham
  C. Isaac
  Correct answer: A. Moses

10. What is the last book of the Bible?
  A. Acts
  B. Romans
  C. Revelation
  Correct answer: C. Revelation
`;

const res = parseQuestionsFromRawText(sampleText);
console.log('Total questions parsed:', res.questions.length);
const letters = ['A', 'B', 'C', 'D'];
for (const q of res.questions) {
  console.log(`Q: "${q.prompt.slice(0, 35)}..." -> Correct: ${letters[q.correctOptionIndex]} (${q.options[q.correctOptionIndex]})`);
}

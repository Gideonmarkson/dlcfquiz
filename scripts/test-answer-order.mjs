// Test with exact questions from user screenshot

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

function parseTest(rawText) {
  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const questions = [];
  let currentQ = null;

  const isQuestionStart = (l) => /^\d+[\s.):-]\s*[A-Za-z]/i.test(l);
  const isAnswerLine = (l) => /^(?:.*?)?(?:correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:=]/i.test(l);

  function extractOpts(l) {
    const results = [];
    const regex = /(?:^|\s+)(?:option\s+)?(?:\(|\[)?([A-Da-d])(?:\)|\]|\.|\:|-)?\s+([^\n\r]*?)(?=(?:\s+(?:option\s+)?(?:\(|\[)?[A-Da-d](?:\)|\]|\.|\:|-)?\s+)|$)/gi;
    let m;
    while ((m = regex.exec(l)) !== null) {
      const letter = m[1].toUpperCase();
      const text = m[2].trim().replace(/^[:.-]\s*/, '');
      if (['A', 'B', 'C', 'D'].includes(letter) && text.length > 0) {
        results.push({ letter, text });
      }
    }
    return results;
  }

  const flush = () => {
    if (!currentQ) return;
    questions.push({ ...currentQ });
  };

  for (const line of lines) {
    if (isQuestionStart(line)) {
      flush();
      const prompt = line.replace(/^\d+[\s.):-]\s*/, '');
      currentQ = { prompt, options: [], correctIndex: 0 };
      continue;
    }
    if (!currentQ) continue;

    // Check Answer FIRST!
    if (isAnswerLine(line)) {
      const ansPart = line.replace(/^(?:.*?)?(?:correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:=]*/i, '').trim();
      const letterMatch = ansPart.match(/^([A-Da-d])(?:[\s.):-]|$)/i) || ansPart.match(/\b([A-Da-d])\b/i);
      if (letterMatch) {
        currentQ.correctIndex = ['A', 'B', 'C', 'D'].indexOf(letterMatch[1].toUpperCase());
      }
      continue;
    }

    const opts = extractOpts(line);
    if (opts.length > 0) {
      for (const o of opts) currentQ.options.push(o);
      continue;
    }
  }
  flush();
  return questions;
}

const res = parseTest(sampleText);
for (const q of res) {
  const letters = ['A', 'B', 'C', 'D'];
  console.log(`Q: "${q.prompt.slice(0, 30)}..." -> Correct: ${letters[q.correctIndex]}`);
}

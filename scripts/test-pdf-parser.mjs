import assert from 'node:assert/strict';

function parseQuestionsFromText(fullText) {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const questions = [];
  let currentQ = null;

  const isQuestionStart = (line) => {
    return (
      /^question\s*\d+[\s.:]/i.test(line) ||
      /^q\d+[\s.:]/i.test(line) ||
      /^\d+[\s.):-]\s*[A-Z]/i.test(line)
    );
  };

  const isOption = (line) => {
    return /^(\(|\[)?([A-D])(\)|\]|\.|\:|-)\s+/i.test(line);
  };

  const getOptionLetter = (line) => {
    const match = line.match(/^(\(|\[)?([A-D])(\)|\]|\.|\:|-)\s+(.*)/i);
    if (match) {
      return {
        letter: match[2].toUpperCase(),
        text: match[4].trim(),
      };
    }
    return null;
  };

  const isAnswerLine = (line) => {
    return (
      /^(correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:]/i.test(line)
    );
  };

  const isScriptureLine = (line) => {
    return /^(scripture\s*ref|scripture\s*reference|scripture|verse|ref)[\s.:]/i.test(line);
  };

  const isExplanationLine = (line) => {
    return /^(explanation|note|notes|doctrinal\s*note)[\s.:]/i.test(line);
  };

  const isTimerLine = (line) => {
    return /^(time\s*limit|timer|time)[\s.:]/i.test(line);
  };

  const flushCurrent = () => {
    if (currentQ && currentQ.prompt) {
      if (currentQ.options.length === 4) {
        questions.push({
          prompt: currentQ.prompt,
          options: [
            currentQ.options[0].text,
            currentQ.options[1].text,
            currentQ.options[2].text,
            currentQ.options[3].text,
          ],
          correctOptionIndex: currentQ.correctIndex ?? 0,
          scriptureRef: currentQ.scriptureRef || '2 Timothy 2:15',
          explanation: currentQ.explanation || null,
          timeLimitSec: currentQ.timeLimitSec || 20,
        });
      }
    }
  };

  for (const line of lines) {
    if (isQuestionStart(line)) {
      flushCurrent();
      const promptText = line.replace(/^(question\s*\d+[\s.:]|q\d+[\s.:]|\d+[\s.):-]\s*)/i, '').trim();
      currentQ = {
        prompt: promptText,
        options: [],
        correctIndex: null,
        scriptureRef: '',
        explanation: null,
        timeLimitSec: 20,
      };
      continue;
    }

    if (!currentQ) continue;

    const opt = getOptionLetter(line);
    if (opt) {
      currentQ.options.push(opt);
      continue;
    }

    if (isAnswerLine(line)) {
      const ansPart = line.replace(/^(correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:]*/i, '').trim();
      const letterMatch = ansPart.match(/^([A-D])\b/i);
      if (letterMatch) {
        const letter = letterMatch[1].toUpperCase();
        currentQ.correctIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
      } else {
        // Try matching text with one of options
        const matchIdx = currentQ.options.findIndex((o) =>
          o.text.toLowerCase().includes(ansPart.toLowerCase()) || ansPart.toLowerCase().includes(o.text.toLowerCase())
        );
        if (matchIdx !== -1) {
          currentQ.correctIndex = matchIdx;
        }
      }

      // Check if scripture ref is on same line, e.g. "Answer: B (2 Timothy 2:15)"
      const scriptureInParens = ansPart.match(/\(([^)]+)\)/);
      if (scriptureInParens && !currentQ.scriptureRef) {
        currentQ.scriptureRef = scriptureInParens[1].trim();
      }
      continue;
    }

    if (isScriptureLine(line)) {
      currentQ.scriptureRef = line.replace(/^(scripture\s*ref|scripture\s*reference|scripture|verse|ref)[\s.:]*/i, '').trim();
      continue;
    }

    if (isExplanationLine(line)) {
      currentQ.explanation = line.replace(/^(explanation|note|notes|doctrinal\s*note)[\s.:]*/i, '').trim();
      continue;
    }

    if (isTimerLine(line)) {
      const match = line.match(/(\d{1,2})\s*(s|sec|seconds)?/i);
      if (match) {
        currentQ.timeLimitSec = Math.max(5, Math.min(60, parseInt(match[1], 10)));
      }
      continue;
    }

    // If still on prompt and no options yet, append to prompt
    if (currentQ.options.length === 0) {
      currentQ.prompt += ' ' + line;
    }
  }

  flushCurrent();
  return questions;
}

const samplePdfText = `
DLCF AFIT BIBLE QUIZ - WEEKLY REVIEW

Question 1: Which epistle instructs believers to 'Study to shew thyself approved unto God'?
A. 1 Timothy
B. 2 Timothy
C. Titus
D. Hebrews
Answer: B
Scripture: 2 Timothy 2:15
Explanation: Paul wrote this charge to Timothy.
Time: 20s

2. According to Psalm 119:105, God's word is a lamp unto my feet and a light unto my...?
(A) Path
(B) Home
(C) Heart
(D) Fellowship
Correct Option: A
Ref: Psalm 119:105
Timer: 15s
`;

const res = parseQuestionsFromText(samplePdfText);
console.log('Parsed questions from text:', JSON.stringify(res, null, 2));

assert.equal(res.length, 2);
assert.equal(res[0].correctOptionIndex, 1);
assert.equal(res[0].scriptureRef, '2 Timothy 2:15');
assert.equal(res[1].correctOptionIndex, 0);
assert.equal(res[1].scriptureRef, 'Psalm 119:105');
assert.equal(res[1].timeLimitSec, 15);
console.log('✅ Text parsing test passed successfully!');

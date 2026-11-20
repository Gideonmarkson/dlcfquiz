function parseFullQuiz(text) {
  const HEADER_PATTERNS = [
    /^\s*technical\s+bible\s+questions/i,
    /^\s*bible\s+quiz\s+(template|compilation|questions)/i,
    /^\s*multiple\s+choice\s+(questions|quiz)/i,
    /^\s*dlcf\s+afit/i,
    /^\s*instructions?\s*[:\-]/i,
  ];

  const lines = text
    .split(/\r?\n/)
    .map(l => l.replace(/\u00a0/g, ' ').trim())
    .filter(l => l.length > 0 && !HEADER_PATTERNS.some(p => p.test(l)));

  const questions = [];
  let currentQ = null;

  const isQuestionStart = (line) => {
    return (
      /^question\s*\d+[\s.:]/i.test(line) ||
      /^q\d+[\s.:]/i.test(line) ||
      /^\d+[\s.):-]\s*[A-Za-z]/i.test(line)
    );
  };

  const isAnswerLine = (line) => {
    return /^(correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:=]/i.test(line);
  };

  function extractOptionsFromText(line) {
    const results = [];
    const regex = /(?:^|\s+)(?:option\s+)?(?:\(|\[)?([A-Da-d])(?:\)|\]|\.|\:|-)?\s+([^\n\r]*?)(?=(?:\s+(?:option\s+)?(?:\(|\[)?[A-Da-d](?:\)|\]|\.|\:|-)?\s+)|$)/gi;
    let match;
    while ((match = regex.exec(line)) !== null) {
      const letter = match[1].toUpperCase();
      const t = match[2].trim().replace(/^[:.-]\s*/, '');
      if (['A', 'B', 'C', 'D'].includes(letter) && t.length > 0) {
        results.push({ letter, text: t });
      }
    }
    if (results.length === 0) {
      const noSpaceRegex = /(?:^|\s+)(?:option\s+)?(?:\(|\[)?([A-Da-d])(?:\)|\]|\.|\:|-)\s*([^\n\r]+)/i;
      const m = line.match(noSpaceRegex);
      if (m) {
        const letter = m[1].toUpperCase();
        const t = m[2].trim();
        if (['A', 'B', 'C', 'D'].includes(letter) && t.length > 0) {
          results.push({ letter, text: t });
        }
      }
    }
    return results;
  }

  const flush = () => {
    if (!currentQ) return;
    if (currentQ.options.length >= 2) {
      questions.push(currentQ);
    }
  };

  for (const line of lines) {
    if (isQuestionStart(line)) {
      flush();
      const prompt = line.replace(/^(question\s*\d+[\s.:]|q\d+[\s.:]|\d+[\s.):-]\s*)/i, '').trim();
      currentQ = { prompt, options: [], correctIndex: 0 };
      continue;
    }
    if (!currentQ) continue;

    const opts = extractOptionsFromText(line);
    if (opts.length > 0) {
      for (const o of opts) {
        currentQ.options.push(o);
      }
      continue;
    }

    if (isAnswerLine(line)) {
      const ansPart = line.replace(/^(correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:=]*/i, '').trim();
      const letterMatch = ansPart.match(/\b([A-D])\b/i);
      if (letterMatch) {
        currentQ.correctIndex = ['A', 'B', 'C', 'D'].indexOf(letterMatch[1].toUpperCase());
      }
      continue;
    }

    // If plain line under question and fewer than 4 options
    if (currentQ.options.length < 4 && line.length < 150) {
      const letter = ['A', 'B', 'C', 'D'][currentQ.options.length];
      currentQ.options.push({ letter, text: line });
    }
  }
  flush();

  return questions;
}

const samplePdfText = `
TECHNICAL BIBLE QUESTIONS Multiple Choice Quiz
AFIT Kaduna Chapter

1. Which judge of Israel was known for his great strength and riddle about a lion and honey?
A. Samson
B. Gideon
C. Jephthah
D. Barak
Answer: A
Scripture: Judges 14:14

2. At Pentecost, what appeared and sat upon each of them?
A. Cloven tongues like as of fire
B. A dove from heaven
C. A bright shining cloud
D. A rushing mighty wind
Answer: A
Scripture: Acts 2:3
`;

const res = parseFullQuiz(samplePdfText);
console.log('Parsed questions count:', res.length);
console.log('Question 1:', res[0].prompt, res[0].options.map(o => `${o.letter}:${o.text}`));
console.log('Question 2:', res[1].prompt, res[1].options.map(o => `${o.letter}:${o.text}`));

// Test script for improved rule-based parsing

function cleanHeaderLines(text) {
  const HEADER_PATTERNS = [
    /^\s*technical\s+bible\s+questions/i,
    /^\s*bible\s+quiz\s+(template|compilation|questions)/i,
    /^\s*multiple\s+choice\s+(questions|quiz)/i,
    /^\s*dlcf\s+afit/i,
    /^\s*instructions?\s*[:\-]/i,
  ];

  return text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(line => {
      if (!line) return false;
      return !HEADER_PATTERNS.some(p => p.test(line));
    });
}

function extractOptions(line) {
  const results = [];
  // Matches:
  // A. Samson or A.Samson
  // A) Samson or A)Samson
  // Option A: Samson
  // (A) Samson or [A] Samson
  // 1) Samson or 1. Samson (when followed by 2., 3., 4.)
  const regex = /(?:^|\s+)(?:option\s+)?(?:(?:\(|\[)?([A-Da-d])(?:\)|\]|\.|\:|-)?)\s*([\s\S]*?)(?=(?:\s+(?:option\s+)?(?:\(|\[)?[A-Da-d](?:\)|\]|\.|\:|-)?\s*)|$)/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const letter = match[1].toUpperCase();
    const text = match[2].trim().replace(/^[:.-]\s*/, '');
    if (['A', 'B', 'C', 'D'].includes(letter) && text.length > 0) {
      results.push({ letter, text });
    }
  }
  return results;
}

const lines = cleanHeaderLines('TECHNICAL BIBLE QUESTIONS Multiple Choice Quiz\n\n1. Which judge of Israel was known for his great strength and riddle about a lion and honey?\nA. Samson\nB. Gideon\nC. Jephthah\nD. Barak\nAnswer: A');

console.log('Cleaned lines:', lines);
console.log('Extracted options from A. Samson:', extractOptions('A. Samson'));
console.log('Extracted options from A.Samson (no space):', extractOptions('A.Samson'));
console.log('Extracted options from Option A: Samson:', extractOptions('Option A: Samson'));

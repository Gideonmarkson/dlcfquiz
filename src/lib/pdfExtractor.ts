import { QuestionInput } from '@/types/quiz';

const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Leviticus', 'Numbers', 'Deuteronomy', 'Joshua', 'Judges', 'Ruth',
  '1 Samuel', '2 Samuel', '1 Kings', '2 Kings', '1 Chronicles', '2 Chronicles', 'Ezra',
  'Nehemiah', 'Esther', 'Job', 'Psalm', 'Psalms', 'Proverbs', 'Ecclesiastes', 'Song of Solomon',
  'Isaiah', 'Jeremiah', 'Lamentations', 'Ezekiel', 'Daniel', 'Hosea', 'Joel', 'Amos',
  'Obadiah', 'Jonah', 'Micah', 'Nahum', 'Habakkuk', 'Zephaniah', 'Haggai', 'Zechariah',
  'Malachi', 'Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians',
  '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians',
  '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James',
  '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation'
];

const BIBLE_REF_REGEX = new RegExp(
  `\\b((?:[1-3]\\s+)?(?:${BIBLE_BOOKS.map((b) => b.replace(/^[1-3]\s+/, '')).join('|')})\\s+\\d+:\\d+(?:-\\d+)?)\\b`,
  'i'
);

/**
 * Extracts plain text from a PDF file using the server API route first,
 * with universal client-side fallback.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  // 1. Try server-side parsing route (most reliable across all devices and PDF versions)
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/host/parse-pdf', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.questions && data.questions.length > 0) {
        // Embed parsed questions as temporary flag or return text
        return data.rawTextPreview || 'PARSED_VIA_SERVER';
      }
    }
  } catch (err) {
    console.warn('Server-side PDF parse attempt failed, trying browser engine:', err);
  }

  // 2. Client-side fallback via unpdf
  try {
    const { extractText } = await import('unpdf');
    const buffer = await file.arrayBuffer();
    const result = await extractText(new Uint8Array(buffer));
    if (Array.isArray(result.text)) {
      return result.text.join('\n\n');
    }
    if (typeof result.text === 'string') {
      return result.text;
    }
  } catch (err) {
    console.warn('unpdf client extraction error:', err);
  }

  // 3. Last-resort Latin1 stream decoder
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('latin1').decode(bytes);
  let extracted = '';
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;
  while ((match = streamRegex.exec(text)) !== null) {
    const block = match[1];
    const strRegex = /\((.*?)\)\s*['"Tj]/g;
    let sMatch;
    while ((sMatch = strRegex.exec(block)) !== null) {
      extracted += sMatch[1].replace(/\\([()\\])/g, '$1') + '\n';
    }
  }
  return extracted;
}

/**
 * Directly extracts questions from PDF via server route or client-side parser
 */
export async function extractQuestionsFromPdfFile(file: File): Promise<{
  success: boolean;
  questions: QuestionInput[];
  errors: string[];
}> {
  // 1. Try high-performance server API route
  try {
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/host/parse-pdf', {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.questions && data.questions.length > 0) {
        return {
          success: true,
          questions: data.questions,
          errors: data.errors || [],
        };
      }
    }
  } catch (err) {
    console.warn('Server PDF parse route unavailable, falling back:', err);
  }

  // 2. Extract text and parse locally
  const rawText = await extractTextFromPdf(file);
  if (!rawText || rawText.trim().length === 0) {
    return {
      success: false,
      questions: [],
      errors: [
        'Could not extract text from this PDF. If this document was scanned from paper as a photo, please export it from Word or use our template.',
      ],
    };
  }

  return parseQuestionsFromRawText(rawText);
}

/**
 * Parses options from a line, supporting multiple options on the same line:
 * e.g. "A. Saul   B. David   C. Solomon   D. Samuel"
 */
function extractOptionsFromText(line: string): Array<{ letter: string; text: string }> {
  const results: Array<{ letter: string; text: string }> = [];
  const regex =
    /(?:^|\s+)(?:(?:\(|\[)?([A-Da-d])(?:\)|\]|\.|\:|-))\s+([\s\S]*?)(?=(?:\s+(?:\(|\[)?[A-Da-d](?:\)|\]|\.|\:|-)\s+)|$)/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const letter = match[1].toUpperCase();
    const text = match[2].trim();
    if (['A', 'B', 'C', 'D'].includes(letter) && text.length > 0) {
      results.push({ letter, text });
    }
  }
  return results;
}

/**
 * Parses raw extracted text into structured QuestionInput objects
 */
export function parseQuestionsFromRawText(rawText: string): {
  success: boolean;
  questions: QuestionInput[];
  errors: string[];
} {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const questions: QuestionInput[] = [];
  const errors: string[] = [];

  const isQuestionStart = (line: string) => {
    return (
      /^question\s*\d+[\s.:]/i.test(line) ||
      /^q\d+[\s.:]/i.test(line) ||
      /^\d+[\s.):-]\s*[A-Za-z]/i.test(line)
    );
  };

  const isAnswerLine = (line: string) => {
    return /^(correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:=]/i.test(line);
  };

  const isScriptureLine = (line: string) => {
    return /^(scripture\s*ref|scripture\s*reference|scripture|verse|ref)[\s.:=]/i.test(line);
  };

  const isExplanationLine = (line: string) => {
    return /^(explanation|note|notes|doctrinal\s*note)[\s.:=]/i.test(line);
  };

  const isTimerLine = (line: string) => {
    return /^(time\s*limit|timer|time)[\s.:=]/i.test(line);
  };

  interface IntermediateQuestion {
    prompt: string;
    options: Array<{ letter: string; text: string }>;
    correctIndex: number | null;
    scriptureRef: string;
    explanation: string | null;
    timeLimitSec: number;
    sourceIndex: number;
  }

  let currentQ: IntermediateQuestion | null = null;
  let qCounter = 0;

  const flushCurrent = () => {
    if (!currentQ) return;
    qCounter++;

    if (!currentQ.prompt || currentQ.prompt.trim().length < 4) {
      errors.push(`Question #${qCounter}: Prompt is too short or missing.`);
      return;
    }

    // Auto-detect Scripture reference if prompt contains one
    if (!currentQ.scriptureRef) {
      const matchInPrompt = currentQ.prompt.match(BIBLE_REF_REGEX);
      if (matchInPrompt) {
        currentQ.scriptureRef = matchInPrompt[1].trim();
      }
    }

    if (currentQ.options.length < 2) {
      errors.push(
        `Question #${qCounter} ("${currentQ.prompt.slice(0, 30)}..."): Expected options (A, B, C, D), found ${currentQ.options.length}.`
      );
      return;
    }

    // Sort options A, B, C, D
    const optionA =
      currentQ.options.find((o) => o.letter === 'A')?.text || currentQ.options[0]?.text || 'True';
    const optionB =
      currentQ.options.find((o) => o.letter === 'B')?.text || currentQ.options[1]?.text || 'False';
    const optionC =
      currentQ.options.find((o) => o.letter === 'C')?.text || currentQ.options[2]?.text || 'None of the above';
    const optionD =
      currentQ.options.find((o) => o.letter === 'D')?.text || currentQ.options[3]?.text || 'All of the above';

    let correctOptIndex: 0 | 1 | 2 | 3 = 0;
    if (currentQ.correctIndex !== null && [0, 1, 2, 3].includes(currentQ.correctIndex)) {
      correctOptIndex = currentQ.correctIndex as 0 | 1 | 2 | 3;
    }

    questions.push({
      prompt: currentQ.prompt.trim(),
      options: [optionA, optionB, optionC, optionD],
      correctOptionIndex: correctOptIndex,
      scriptureRef: currentQ.scriptureRef.trim() || '2 Timothy 2:15',
      explanation: currentQ.explanation ? currentQ.explanation.trim() : null,
      timeLimitSec: currentQ.timeLimitSec || 20,
    });
  };

  for (const line of lines) {
    if (isQuestionStart(line)) {
      flushCurrent();
      const promptText = line
        .replace(/^(question\s*\d+[\s.:]|q\d+[\s.:]|\d+[\s.):-]\s*)/i, '')
        .trim();
      currentQ = {
        prompt: promptText,
        options: [],
        correctIndex: null,
        scriptureRef: '',
        explanation: null,
        timeLimitSec: 20,
        sourceIndex: qCounter + 1,
      };
      continue;
    }

    if (!currentQ) continue;

    // Check if line contains one or multiple options (e.g. A. ... B. ...)
    const extractedOpts = extractOptionsFromText(line);
    if (extractedOpts.length > 0) {
      for (const opt of extractedOpts) {
        // Replace or add
        const existingIdx = currentQ.options.findIndex((o) => o.letter === opt.letter);
        if (existingIdx !== -1) {
          currentQ.options[existingIdx] = opt;
        } else {
          currentQ.options.push(opt);
        }
      }
      continue;
    }

    if (isAnswerLine(line)) {
      const ansPart = line
        .replace(/^(correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:=]*/i, '')
        .trim();

      const letterMatch = ansPart.match(/\b([A-D])\b/i);
      if (letterMatch) {
        const letter = letterMatch[1].toUpperCase();
        currentQ.correctIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
      } else {
        // Try matching text of option
        const matchIdx = currentQ.options.findIndex(
          (o) =>
            o.text.toLowerCase().includes(ansPart.toLowerCase()) ||
            ansPart.toLowerCase().includes(o.text.toLowerCase())
        );
        if (matchIdx !== -1) {
          currentQ.correctIndex = matchIdx;
        }
      }

      // Check if Scripture reference is in answer line
      const scriptureMatch = line.match(BIBLE_REF_REGEX);
      if (scriptureMatch && !currentQ.scriptureRef) {
        currentQ.scriptureRef = scriptureMatch[1].trim();
      }
      continue;
    }

    if (isScriptureLine(line)) {
      const refPart = line
        .replace(/^(scripture\s*ref|scripture\s*reference|scripture|verse|ref)[\s.:=]*/i, '')
        .trim();
      currentQ.scriptureRef = refPart;
      continue;
    }

    if (isExplanationLine(line)) {
      const expPart = line
        .replace(/^(explanation|note|notes|doctrinal\s*note)[\s.:=]*/i, '')
        .trim();
      currentQ.explanation = expPart;
      continue;
    }

    if (isTimerLine(line)) {
      const match = line.match(/(\d{1,2})\s*(s|sec|seconds)?/i);
      if (match) {
        currentQ.timeLimitSec = Math.max(5, Math.min(60, parseInt(match[1], 10)));
      }
      continue;
    }

    // Check for inline Scripture reference
    const scriptureMatch = line.match(BIBLE_REF_REGEX);
    if (scriptureMatch && !currentQ.scriptureRef) {
      currentQ.scriptureRef = scriptureMatch[1].trim();
    }

    // Append to prompt if options not yet started
    if (currentQ.options.length === 0) {
      currentQ.prompt += ' ' + line;
    }
  }

  flushCurrent();

  if (questions.length === 0) {
    return {
      success: false,
      questions: [],
      errors:
        errors.length > 0
          ? errors
          : [
              'No questions could be recognized in this PDF. Please verify questions have numbered prompts, options A, B, C, D, and Answer: B.',
            ],
    };
  }

  return {
    success: true,
    questions,
    errors,
  };
}

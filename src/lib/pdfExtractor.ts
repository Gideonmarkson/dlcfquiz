import { QuestionInput } from '@/types/quiz';

declare global {
  interface Window {
    pdfjsLib?: {
      getDocument: (params: { data: ArrayBuffer | Uint8Array }) => {
        promise: Promise<{
          numPages: number;
          getPage: (num: number) => Promise<{
            getTextContent: () => Promise<{
              items: Array<{ str: string }>;
            }>;
          }>;
        }>;
      };
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
  }
}

/**
 * Dynamically loads PDF.js script from cdnjs if not already present
 */
export async function loadPdfJsLibrary(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.pdfjsLib) return true;

  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(true);
      } else {
        resolve(false);
      }
    };
    script.onerror = () => {
      resolve(false);
    };
    document.head.appendChild(script);
  });
}

/**
 * Extracts plain text from PDF using PDF.js
 */
export async function extractTextWithPdfJs(arrayBuffer: ArrayBuffer): Promise<string> {
  if (!window.pdfjsLib) {
    throw new Error('PDF.js not loaded');
  }

  const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  let fullText = '';

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map((item) => item.str).join(' ');
    fullText += pageText + '\n';
  }

  return fullText;
}

/**
 * Fallback raw PDF stream extractor (works offline/standalone)
 */
export async function extractTextFromPdfStreamFallback(arrayBuffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(arrayBuffer);
  const text = new TextDecoder('latin1').decode(bytes);

  // Look for text in uncompressed stream blocks: BT ... ET
  let extracted = '';
  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let match;

  while ((match = streamRegex.exec(text)) !== null) {
    const streamData = match[1];
    // Check for BT ... ET text blocks
    const btRegex = /BT[\s\S]*?ET/g;
    let btMatch;
    while ((btMatch = btRegex.exec(streamData)) !== null) {
      const block = btMatch[0];
      // Extract (string) Tj or ' or "
      const strRegex = /\((.*?)\)\s*['"Tj]/g;
      let sMatch;
      while ((sMatch = strRegex.exec(block)) !== null) {
        extracted += sMatch[1].replace(/\\([()\\])/g, '$1') + '\n';
      }
    }
  }

  return extracted;
}

/**
 * Main PDF text extractor: tries PDF.js first, then fallback
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();

  // Try loading PDF.js
  const loaded = await loadPdfJsLibrary();
  if (loaded && window.pdfjsLib) {
    try {
      const text = await extractTextWithPdfJs(arrayBuffer);
      if (text.trim().length > 20) {
        return text;
      }
    } catch (e) {
      console.warn('PDF.js parsing failed, trying stream fallback', e);
    }
  }

  // Fallback
  return await extractTextFromPdfStreamFallback(arrayBuffer);
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

  const getOptionLetter = (line: string) => {
    const match = line.match(/^(\(|\[)?([A-D])(\)|\]|\.|\:|-)\s+(.*)/i);
    if (match) {
      return {
        letter: match[2].toUpperCase(),
        text: match[4].trim(),
      };
    }
    return null;
  };

  const isAnswerLine = (line: string) => {
    return /^(correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:]/i.test(line);
  };

  const isScriptureLine = (line: string) => {
    return /^(scripture\s*ref|scripture\s*reference|scripture|verse|ref)[\s.:]/i.test(line);
  };

  const isExplanationLine = (line: string) => {
    return /^(explanation|note|notes|doctrinal\s*note)[\s.:]/i.test(line);
  };

  const isTimerLine = (line: string) => {
    return /^(time\s*limit|timer|time)[\s.:]/i.test(line);
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

    if (!currentQ.prompt || currentQ.prompt.trim().length < 5) {
      errors.push(`Question #${qCounter}: Prompt is too short or missing.`);
      return;
    }

    if (currentQ.options.length < 4) {
      errors.push(
        `Question #${qCounter} ("${currentQ.prompt.slice(0, 30)}..."): Expected 4 options (A, B, C, D), found ${currentQ.options.length}.`
      );
      return;
    }

    // Sort options A, B, C, D
    const optionA = currentQ.options.find((o) => o.letter === 'A')?.text || currentQ.options[0]?.text || '';
    const optionB = currentQ.options.find((o) => o.letter === 'B')?.text || currentQ.options[1]?.text || '';
    const optionC = currentQ.options.find((o) => o.letter === 'C')?.text || currentQ.options[2]?.text || '';
    const optionD = currentQ.options.find((o) => o.letter === 'D')?.text || currentQ.options[3]?.text || '';

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

    const opt = getOptionLetter(line);
    if (opt) {
      currentQ.options.push(opt);
      continue;
    }

    if (isAnswerLine(line)) {
      const ansPart = line
        .replace(/^(correct\s*answer|correct\s*option|correct|answer|ans|key)[\s.:]*/i, '')
        .trim();

      const letterMatch = ansPart.match(/^([A-D])\b/i);
      if (letterMatch) {
        const letter = letterMatch[1].toUpperCase();
        currentQ.correctIndex = ['A', 'B', 'C', 'D'].indexOf(letter);
      } else {
        const matchIdx = currentQ.options.findIndex(
          (o) =>
            o.text.toLowerCase().includes(ansPart.toLowerCase()) ||
            ansPart.toLowerCase().includes(o.text.toLowerCase())
        );
        if (matchIdx !== -1) {
          currentQ.correctIndex = matchIdx;
        }
      }

      const scriptureInParens = ansPart.match(/\(([^)]+)\)/);
      if (scriptureInParens && !currentQ.scriptureRef) {
        currentQ.scriptureRef = scriptureInParens[1].trim();
      }
      continue;
    }

    if (isScriptureLine(line)) {
      currentQ.scriptureRef = line
        .replace(/^(scripture\s*ref|scripture\s*reference|scripture|verse|ref)[\s.:]*/i, '')
        .trim();
      continue;
    }

    if (isExplanationLine(line)) {
      currentQ.explanation = line
        .replace(/^(explanation|note|notes|doctrinal\s*note)[\s.:]*/i, '')
        .trim();
      continue;
    }

    if (isTimerLine(line)) {
      const match = line.match(/(\d{1,2})\s*(s|sec|seconds)?/i);
      if (match) {
        currentQ.timeLimitSec = Math.max(5, Math.min(60, parseInt(match[1], 10)));
      }
      continue;
    }

    // Append multiline prompt
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
              'No questions could be detected in this PDF. Please ensure questions are formatted with A, B, C, D options and Answer: B.',
            ],
    };
  }

  return {
    success: true,
    questions,
    errors,
  };
}

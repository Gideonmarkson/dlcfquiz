import { GoogleGenAI } from '@google/genai';
import { QuestionInput } from '@/types/quiz';

/**
 * Gemini Google AI Intelligent PDF Question Parser
 * Reads and comprehends any PDF or Word document format (tables, columns, custom layouts).
 */

export function isGeminiConfigured(overrideKey?: string): boolean {
  const key =
    overrideKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    '';
  return Boolean(key && key.trim().length > 10 && !key.includes('placeholder'));
}

export async function parsePdfWithGemini(
  pdfBuffer: ArrayBuffer,
  extractedTextFallback?: string,
  overrideKey?: string
): Promise<{
  success: boolean;
  questions: QuestionInput[];
  errors: string[];
}> {
  const apiKey =
    overrideKey ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    '';

  if (!apiKey || apiKey.includes('placeholder')) {
    return {
      success: false,
      questions: [],
      errors: ['GEMINI_API_KEY is not configured in environment.'],
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are an expert Bible quiz parser for the Deeper Life Campus Fellowship (DLCF) at Air Force Institute of Technology (AFIT).

Analyze this document and extract ALL multiple-choice Bible questions into a clean JSON array.

RULES:
1. IGNORE title headers, decorative headers (such as "TECHNICAL BIBLE QUESTIONS Multiple Choice Quiz"), rules, page numbers, instructions, or exam guidelines.
2. For each question:
   - "prompt": The full, clear question text (e.g. "Which judge of Israel was known for his great strength and riddle about a lion and honey?").
   - "options": An array of exactly 4 strings [Option A, Option B, Option C, Option D]. If options in the document were lettered (A-D) or numbered (1-4) or roman numerals, strip the letters and provide the clean text.
   - "correctOptionIndex": Integer 0, 1, 2, or 3 representing the correct option (0 for A, 1 for B, 2 for C, 3 for D).
     * If an answer key or correct answer is provided in the document (e.g., "Answer: Samson", "Ans: A", bolded text, or an answer table at the end), use it.
     * If NO answer is explicitly stated in the document, use authoritative Holy Bible (KJV) knowledge to determine the true correct answer.
   - "scriptureRef": The accurate King James Bible scripture reference (Book Chapter:Verse, e.g. "Judges 14:14", "Acts 2:1-4"). If not given in text, infer the exact biblical reference.
   - "explanation": A concise 1-sentence doctrinal note explaining why the answer is correct according to the scriptures.
   - "timeLimitSec": Recommended timer in seconds (default 20, between 15 and 30).

Return ONLY a JSON array matching this format:
[
  {
    "prompt": "Question text here?",
    "options": ["First option", "Second option", "Third option", "Fourth option"],
    "correctOptionIndex": 1,
    "scriptureRef": "Book Chapter:Verse",
    "explanation": "Contextual explanation here.",
    "timeLimitSec": 20
  }
]`;

  try {
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
    const contentParts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Pdf,
        },
      },
      ...(extractedTextFallback
        ? [{ text: `\n\n--- EXTRACTED TEXT FROM DOCUMENT ---\n${extractedTextFallback.slice(0, 30000)}` }]
        : []),
    ];

    // Try Gemini 2.5 Flash, falling back to Gemini 1.5 Flash if needed
    let response;
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{ role: 'user', parts: contentParts }],
        config: { responseMimeType: 'application/json' },
      });
    } catch (modelErr) {
      console.warn('Gemini 2.5 Flash call failed, attempting fallback to gemini-1.5-flash:', modelErr);
      response = await ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: [{ role: 'user', parts: contentParts }],
        config: { responseMimeType: 'application/json' },
      });
    }

    const responseText = response.text?.trim() || '';
    if (!responseText) {
      return { success: false, questions: [], errors: ['Gemini returned an empty response.'] };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(responseText);
    } catch {
      // Clean potential markdown backticks
      const cleanJson = responseText.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      parsed = JSON.parse(cleanJson);
    }

    // Support both direct array or wrapped object like { questions: [...] }
    let rawQuestions: unknown[] = [];
    if (Array.isArray(parsed)) {
      rawQuestions = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      const list = obj.questions || obj.quiz || obj.data;
      if (Array.isArray(list)) {
        rawQuestions = list;
      }
    }

    if (rawQuestions.length === 0) {
      return {
        success: false,
        questions: [],
        errors: ['Gemini could not identify any multiple-choice questions in this document.'],
      };
    }

    const validatedQuestions: QuestionInput[] = [];
    const errors: string[] = [];

    rawQuestions.forEach((qItem, i) => {
      if (!qItem || typeof qItem !== 'object') return;
      const q = qItem as Record<string, unknown>;

      const promptStr = typeof q.prompt === 'string' ? q.prompt.trim() : '';
      if (promptStr.length < 5) {
        errors.push(`Item #${i + 1}: Prompt is too short.`);
        return;
      }

      let optionsList: string[] = [];
      if (Array.isArray(q.options)) {
        optionsList = q.options.map((opt) => String(opt || '').trim());
      }

      // Ensure 4 options
      if (optionsList.length < 4) {
        // Pad with sensible defaults if 3 options were given
        while (optionsList.length < 4) {
          optionsList.push(`Option ${String.fromCharCode(65 + optionsList.length)}`);
        }
      } else if (optionsList.length > 4) {
        optionsList = optionsList.slice(0, 4);
      }

      let correctIdx: 0 | 1 | 2 | 3 = 0;
      if (typeof q.correctOptionIndex === 'number' && [0, 1, 2, 3].includes(q.correctOptionIndex)) {
        correctIdx = q.correctOptionIndex as 0 | 1 | 2 | 3;
      } else if (typeof q.correctOptionIndex === 'string') {
        const letter = q.correctOptionIndex.trim().toUpperCase();
        const map: Record<string, 0 | 1 | 2 | 3> = { A: 0, B: 1, C: 2, D: 3 };
        if (map[letter] !== undefined) correctIdx = map[letter];
      }

      const scripture =
        typeof q.scriptureRef === 'string' && q.scriptureRef.trim()
          ? q.scriptureRef.trim()
          : '2 Timothy 2:15';

      const explanation =
        typeof q.explanation === 'string' && q.explanation.trim()
          ? q.explanation.trim()
          : null;

      const timeLimitSec =
        typeof q.timeLimitSec === 'number' && q.timeLimitSec >= 5 && q.timeLimitSec <= 60
          ? q.timeLimitSec
          : 20;

      validatedQuestions.push({
        prompt: promptStr,
        options: [optionsList[0], optionsList[1], optionsList[2], optionsList[3]],
        correctOptionIndex: correctIdx,
        scriptureRef: scripture,
        explanation,
        timeLimitSec,
      });
    });

    return {
      success: validatedQuestions.length > 0,
      questions: validatedQuestions,
      errors,
    };
  } catch (err) {
    console.error('Gemini parsing API error:', err);
    return {
      success: false,
      questions: [],
      errors: [
        `Google AI parsing failed: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }
}

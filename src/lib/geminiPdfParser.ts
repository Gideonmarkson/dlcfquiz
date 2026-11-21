import { generateWithFallback } from '@/lib/gemini';
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
  overrideKey?: string,
  pageTexts?: string[]
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


  const totalPages = pageTexts && pageTexts.length > 0 ? pageTexts.length : 1;

  const prompt = `You are an expert Bible quiz parser for the Deeper Life Campus Fellowship (DLCF) at Air Force Institute of Technology (AFIT).

Analyze this ${totalPages > 1 ? `${totalPages}-PAGE` : ''} document and extract ALL multiple-choice Bible questions into a clean JSON array.

*** CRITICAL MULTI-PAGE COMPLETENESS REQUIREMENT ***
1. This PDF document contains ${totalPages} PAGE(S).
2. You MUST inspect and extract questions from EVERY SINGLE PAGE (Page 1, Page 2${totalPages > 2 ? `, through Page ${totalPages}` : ''}) all the way to the very last page!
3. DO NOT stop after Page 1!
4. DO NOT omit, skip, or summarize ANY questions from any page.
5. If Page 1 has questions 1-10 and Page 2 has questions 11-20, your final output JSON array MUST include ALL 20 questions!

RULES:
1. IGNORE title headers, decorative headers (such as "TECHNICAL BIBLE QUESTIONS Multiple Choice Quiz", "DLCF AFIT", etc.), rules, page numbers (e.g. "Page 2 of 4", "2"), instructions, or exam guidelines.
2. For each question:
   - "prompt": The full, clear question text (e.g. "Which judge of Israel was known for his great strength and riddle about a lion and honey?").
   - "options": An array of exactly 4 strings [Option A, Option B, Option C, Option D]. If options in the document were lettered (A-D) or numbered (1-4) or roman numerals, strip the letters and provide the clean text.

   - "correctOptionIndex": Integer 0, 1, 2, or 3 representing the correct option (0 for Option A, 1 for Option B, 2 for Option C, 3 for Option D).
     *** HIGHEST PRIORITY - GREEN COLOR VISUAL DETECTION ***
     * In this PDF document, the quiz author has visually marked the correct answer in GREEN!
     * Inspect the visual colors of each option in the PDF rendering:
       - If an option's text is written in GREEN font/color, THAT IS THE CORRECT ANSWER!
       - If an option has a GREEN background highlight, shading, or box, THAT IS THE CORRECT ANSWER!
       - If an option has a GREEN checkmark, bullet, circle, or border next to it, THAT IS THE CORRECT ANSWER!
       - You MUST set "correctOptionIndex" to the exact option that is styled in GREEN (0 for A, 1 for B, 2 for C, 3 for D).
     * If NO option is visually colored green:
       - Check for an explicit answer label (e.g., "Answer: B", "Ans: C", bold text, or an answer key table).
       - If still no indicator, use authoritative King James Holy Bible (KJV) knowledge to determine which option is the true biblical answer.
     * NEVER automatically default to Option A (index 0) if another option (B, C, or D) is green or is the correct biblical answer!

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

    // Build page-by-page text transcript for maximum multi-page comprehension
    let formattedTextTranscript = '';
    if (pageTexts && pageTexts.length > 0) {
      formattedTextTranscript = pageTexts
        .map((pText, pIdx) => `=== DOCUMENT PAGE ${pIdx + 1} OF ${pageTexts.length} ===\n${pText.trim()}`)
        .join('\n\n');
    } else if (extractedTextFallback) {
      formattedTextTranscript = extractedTextFallback;
    }

    const contentParts = [
      { text: prompt },
      {
        inlineData: {
          mimeType: 'application/pdf',
          data: base64Pdf,
        },
      },
      ...(formattedTextTranscript
        ? [{ text: `\n\n--- EXTRACTED FULL TEXT TRANSCRIPT ACROSS ALL ${totalPages} PAGES ---\n${formattedTextTranscript.slice(0, 100000)}` }]
        : []),
    ];

    // Shared helper tries the current Flash alias first, then older names.
    const responseText = await generateWithFallback(apiKey, {
      contents: [{ role: 'user', parts: contentParts }],
      config: {
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
        temperature: 0.1,
      },
    });
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
      const rawAns =
        q.correctOptionIndex !== undefined
          ? q.correctOptionIndex
          : (q as Record<string, unknown>).correctAnswer !== undefined
          ? (q as Record<string, unknown>).correctAnswer
          : (q as Record<string, unknown>).answer;

      if (typeof rawAns === 'number' && [0, 1, 2, 3].includes(rawAns)) {
        correctIdx = rawAns as 0 | 1 | 2 | 3;
      } else if (typeof rawAns === 'string') {
        const letter = rawAns.trim().toUpperCase();
        const map: Record<string, 0 | 1 | 2 | 3> = { A: 0, B: 1, C: 2, D: 3 };
        if (map[letter] !== undefined) {
          correctIdx = map[letter];
        } else {
          const matched = optionsList.findIndex(
            (o) =>
              o.toLowerCase().trim() === rawAns.toLowerCase().trim() ||
              o.toLowerCase().includes(rawAns.toLowerCase().trim())
          );
          if (matched !== -1) {
            correctIdx = matched as 0 | 1 | 2 | 3;
          }
        }
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

import { z } from 'zod';
import Papa from 'papaparse';
import type { QuestionInput } from '@/types/quiz';

export const QuestionInputSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(5, 'Prompt must be at least 5 characters')
    .max(400, 'Prompt cannot exceed 400 characters'),
  options: z
    .tuple([
      z.string().trim().min(1, 'Option A cannot be empty').max(160, 'Option A exceeds 160 characters'),
      z.string().trim().min(1, 'Option B cannot be empty').max(160, 'Option B exceeds 160 characters'),
      z.string().trim().min(1, 'Option C cannot be empty').max(160, 'Option C exceeds 160 characters'),
      z.string().trim().min(1, 'Option D cannot be empty').max(160, 'Option D exceeds 160 characters')
    ]),
  correctOptionIndex: z
    .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  scriptureRef: z
    .string()
    .trim()
    .min(3, 'Scripture reference must be at least 3 characters (e.g. John 3:16)')
    .max(120, 'Scripture reference cannot exceed 120 characters'),
  explanation: z
    .string()
    .trim()
    .max(280, 'Explanation cannot exceed 280 characters')
    .nullable()
    .optional(),
  timeLimitSec: z
    .number()
    .int()
    .min(5, 'Time limit must be at least 5 seconds')
    .max(60, 'Time limit cannot exceed 60 seconds')
    .default(20)
});

export const QuestionsArraySchema = z
  .array(QuestionInputSchema)
  .min(1, 'At least 1 question is required')
  .max(50, 'Maximum 50 questions per quiz room');

export interface ParseResult {
  success: boolean;
  questions: QuestionInput[];
  errors: string[];
}

/**
 * Normalizes user input for correct option ('A' -> 0, 'B' -> 1, 'C' -> 2, 'D' -> 3, '0' -> 0, etc.)
 */
function normalizeCorrectOption(val: unknown): 0 | 1 | 2 | 3 | null {
  if (typeof val === 'number' && [0, 1, 2, 3].includes(val)) {
    return val as 0 | 1 | 2 | 3;
  }
  if (typeof val === 'string') {
    const s = val.trim().toUpperCase();
    if (s === 'A' || s === '0') return 0;
    if (s === 'B' || s === '1') return 1;
    if (s === 'C' || s === '2') return 2;
    if (s === 'D' || s === '3') return 3;
  }
  return null;
}

/**
 * Parse JSON text into QuestionInput array
 */
export function parseQuestionsFromJSON(rawJson: string): ParseResult {
  try {
    const parsed = JSON.parse(rawJson);
    const result = QuestionsArraySchema.safeParse(parsed);
    if (!result.success) {
      return {
        success: false,
        questions: [],
        errors: result.error.errors.map(
          (e) => `Question ${(e.path[0] as number) + 1} (${e.path.slice(1).join('.')}): ${e.message}`
        )
      };
    }
    return { success: true, questions: result.data, errors: [] };
  } catch (err: unknown) {
    return {
      success: false,
      questions: [],
      errors: [`Invalid JSON format: ${err instanceof Error ? err.message : String(err)}`]
    };
  }
}

/**
 * Parse CSV text into QuestionInput array
 */
export function parseQuestionsFromCSV(rawCsv: string): ParseResult {
  try {
    const parseOutput = Papa.parse<Record<string, string>>(rawCsv, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim().toLowerCase()
    });

    if (parseOutput.errors.length > 0) {
      return {
        success: false,
        questions: [],
        errors: parseOutput.errors.map((e) => `Line ${e.row ?? '?'}: ${e.message}`)
      };
    }

    const rows = parseOutput.data;
    if (rows.length === 0) {
      return { success: false, questions: [], errors: ['CSV contains no question rows.'] };
    }

    const candidateQuestions: unknown[] = [];
    const rowErrors: string[] = [];

    rows.forEach((row, idx) => {
      const lineNum = idx + 2; // header is line 1
      const prompt = row['prompt'] || row['question'] || '';
      const optionA = row['option_a'] || row['option a'] || row['a'] || '';
      const optionB = row['option_b'] || row['option b'] || row['b'] || '';
      const optionC = row['option_c'] || row['option c'] || row['c'] || '';
      const optionD = row['option_d'] || row['option d'] || row['d'] || '';
      const rawCorrect = row['correct_option'] || row['correct'] || row['answer'] || '';
      const scriptureRef = row['scripture_ref'] || row['scripture'] || row['reference'] || '';
      const explanation = row['explanation'] || row['notes'] || null;
      const rawTime = row['time_limit_sec'] || row['time_limit'] || row['timer'] || '20';

      const correctIndex = normalizeCorrectOption(rawCorrect);
      if (correctIndex === null) {
        rowErrors.push(
          `Line ${lineNum}: Invalid correct option '${rawCorrect}'. Must be A, B, C, or D (or 0, 1, 2, 3).`
        );
      }

      const timeLimitSec = parseInt(rawTime, 10) || 20;

      candidateQuestions.push({
        prompt,
        options: [optionA, optionB, optionC, optionD],
        correctOptionIndex: correctIndex ?? 0,
        scriptureRef,
        explanation: explanation || null,
        timeLimitSec
      });
    });

    if (rowErrors.length > 0) {
      return { success: false, questions: [], errors: rowErrors };
    }

    const zodResult = QuestionsArraySchema.safeParse(candidateQuestions);
    if (!zodResult.success) {
      return {
        success: false,
        questions: [],
        errors: zodResult.error.errors.map(
          (e) => `Line ${(e.path[0] as number) + 2} (${e.path.slice(1).join('.')}): ${e.message}`
        )
      };
    }

    return { success: true, questions: zodResult.data, errors: [] };
  } catch (err: unknown) {
    return {
      success: false,
      questions: [],
      errors: [`Failed to parse CSV: ${err instanceof Error ? err.message : String(err)}`]
    };
  }
}

export const SAMPLE_CSV_TEMPLATE = `prompt,option_a,option_b,option_c,option_d,correct_option,scripture_ref,explanation,time_limit_sec
"Which epistle instructs believers to 'Study to shew thyself approved unto God'?","1 Timothy","2 Timothy","Titus","Hebrews","B","2 Timothy 2:15","Paul's solemn charge to Timothy.",20
"According to Psalm 119:105, God's word is a lamp unto my feet and a light unto my...?","Path","Home","Heart","Fellowship","A","Psalm 119:105","David declares the guidance of God's Word.",20`;

export const SAMPLE_JSON_TEMPLATE = JSON.stringify(
  [
    {
      prompt: "Which epistle instructs believers to 'Study to shew thyself approved unto God'?",
      options: ["1 Timothy", "2 Timothy", "Titus", "Hebrews"],
      correctOptionIndex: 1,
      scriptureRef: "2 Timothy 2:15",
      explanation: "Paul's solemn charge to Timothy.",
      timeLimitSec: 20
    }
  ],
  null,
  2
);

import { QuestionInput } from '@/types/quiz';
import { generateWithFallback, getGeminiKey, parseJsonLoose } from '@/lib/gemini';

const MAX_NOTE_CHARS = 280; // questions.explanation is VARCHAR(280)
const TIMEOUT_MS = 12000;

/**
 * Writes the short note shown with each answer reveal, for every question that doesn't have one.
 * All questions go to Gemini in a single request. If Gemini isn't configured, is slow, or fails,
 * the questions come back unchanged — creating the game never waits on or fails because of this.
 */
export async function fillMissingAnswerNotes(
  questions: QuestionInput[],
  overrideKey?: string | null
): Promise<{ questions: QuestionInput[]; generated: number }> {
  const missing = questions
    .map((q, index) => ({ q, index }))
    .filter(({ q }) => !q.explanation || !q.explanation.trim());

  const apiKey = getGeminiKey(overrideKey);
  if (missing.length === 0 || !apiKey) return { questions, generated: 0 };

  const items = missing.map(({ q, index }) => ({
    id: index,
    question: q.prompt,
    correctAnswer: q.options[q.correctOptionIndex],
    otherOptions: q.options.filter((_, i) => i !== q.correctOptionIndex),
    scripture: q.scriptureRef,
  }));

  const prompt = `You write the short note that appears on a projector after each question in a live Bible quiz for a campus fellowship (Deeper Life Campus Fellowship, AFIT Kaduna). The note is read aloud by the quizmaster after the correct answer is revealed.

For each item, write one note that:
- explains why the correct answer is right, drawing on the given scripture and the surrounding Bible passage (King James Version)
- adds one helpful piece of context (who, where, or what happened) when it fits
- is 1–2 plain sentences, at most 220 characters, in a warm but factual tone
- never quotes more than a short phrase of scripture, never mentions the wrong options, and never starts with "Correct" or "The answer is"

If the scripture reference looks wrong for the question, still explain the correct answer from the Bible.

Return only JSON: an array of objects {"id": number, "note": string}, one per item, using the same ids.

Items:
${JSON.stringify(items, null, 2)}`;

  try {
    const text = await generateWithFallback(apiKey, {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      config: {
        responseMimeType: 'application/json',
        temperature: 0.4,
        maxOutputTokens: 4096,
        abortSignal: AbortSignal.timeout(TIMEOUT_MS),
      },
    });

    const parsed = parseJsonLoose(text);
    const list = Array.isArray(parsed)
      ? parsed
      : Array.isArray((parsed as { notes?: unknown })?.notes)
        ? (parsed as { notes: unknown[] }).notes
        : [];

    const notesById = new Map<number, string>();
    for (const entry of list as { id?: unknown; note?: unknown }[]) {
      if (typeof entry?.id === 'number' && typeof entry?.note === 'string' && entry.note.trim()) {
        notesById.set(entry.id, clamp(entry.note.trim()));
      }
    }

    let generated = 0;
    const filled = questions.map((q, index) => {
      const note = notesById.get(index);
      if (note && (!q.explanation || !q.explanation.trim())) {
        generated++;
        return { ...q, explanation: note };
      }
      return q;
    });

    return { questions: filled, generated };
  } catch (err) {
    console.warn('AI answer notes skipped:', err instanceof Error ? err.message : err);
    return { questions, generated: 0 };
  }
}

function clamp(note: string): string {
  if (note.length <= MAX_NOTE_CHARS) return note;
  const cut = note.slice(0, MAX_NOTE_CHARS - 1);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  return (lastStop > 120 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, '')) + (lastStop > 120 ? '' : '…');
}

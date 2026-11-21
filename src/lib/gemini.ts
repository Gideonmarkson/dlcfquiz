import { GoogleGenAI } from '@google/genai';

/** Key from the host's browser (optional) or the server environment. */
export function getGeminiKey(overrideKey?: string | null): string {
  const key =
    overrideKey?.trim() ||
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_API_KEY ||
    process.env.GOOGLE_AI_API_KEY ||
    '';
  return key.length > 10 && !key.includes('placeholder') ? key : '';
}

/**
 * Models to try in order. Google retires model names regularly, so the stable
 * "latest" alias goes first and GEMINI_MODEL can pin a specific one.
 */
export function geminiModelCandidates(): string[] {
  return [process.env.GEMINI_MODEL, 'gemini-flash-latest', 'gemini-2.5-flash', 'gemini-2.0-flash'].filter(
    (m, i, all): m is string => Boolean(m) && all.indexOf(m) === i
  );
}

type GenerateArgs = Parameters<GoogleGenAI['models']['generateContent']>[0];

/** Calls generateContent, falling through the model list if a model name is unavailable. */
export async function generateWithFallback(
  apiKey: string,
  request: Omit<GenerateArgs, 'model'>
): Promise<string> {
  const ai = new GoogleGenAI({ apiKey });
  let lastError: unknown;

  for (const model of geminiModelCandidates()) {
    try {
      const response = await ai.models.generateContent({ ...request, model });
      return response.text?.trim() || '';
    } catch (err) {
      lastError = err;
      // Only move on for "model not found"-type errors; anything else (bad key, timeout) won't improve.
      const msg = err instanceof Error ? err.message : String(err);
      if (!/not.?found|404|not supported|unknown model|deprecated|retired/i.test(msg)) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini request failed');
}

export function parseJsonLoose(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return JSON.parse(text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim());
  }
}

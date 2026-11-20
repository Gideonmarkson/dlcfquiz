import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { parseQuestionsFromRawText } from '@/lib/pdfExtractor';
import { isGeminiConfigured, parsePdfWithGemini } from '@/lib/geminiPdfParser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file uploaded' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const pdfData = new Uint8Array(arrayBuffer);

    // Extract text across all pages using unpdf
    let fullText = '';
    try {
      const extractionResult = await extractText(pdfData);
      if (Array.isArray(extractionResult.text)) {
        fullText = extractionResult.text.join('\n\n');
      } else if (typeof extractionResult.text === 'string') {
        fullText = extractionResult.text;
      }
    } catch (extractErr) {
      console.warn('unpdf text extraction warning:', extractErr);
    }

    const explicitApiKey =
      req.headers.get('x-gemini-key')?.trim() ||
      (formData.get('geminiApiKey') as string)?.trim() ||
      '';

    // --- TIER 1: GOOGLE GEMINI AI DOCUMENT COMPREHENSION ---
    // If GEMINI_API_KEY is configured in env or passed by host, Gemini reads directly
    if (isGeminiConfigured(explicitApiKey)) {
      try {
        console.log('Invoking Gemini AI for intelligent PDF question parsing...');
        const geminiResult = await parsePdfWithGemini(arrayBuffer, fullText, explicitApiKey);
        if (geminiResult.success && geminiResult.questions.length > 0) {
          console.log(`Gemini successfully extracted ${geminiResult.questions.length} questions!`);
          return NextResponse.json({
            success: true,
            questions: geminiResult.questions,
            errors: geminiResult.errors,
            parsedBy: 'gemini-ai',
            totalPages: 1,
          });
        } else {
          console.warn('Gemini returned no questions, falling back to rule-based engine:', geminiResult.errors);
        }
      } catch (geminiErr) {
        console.error('Gemini invocation error, falling back to local engine:', geminiErr);
      }
    }

    // --- TIER 2: ADVANCED LOCAL RULE-BASED ENGINE ---
    if (!fullText || fullText.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Could not extract text from this PDF. Please ensure GEMINI_API_KEY is added to .env.local, or upload a text/Word-exported PDF.',
        },
        { status: 422 }
      );
    }

    const parseResult = parseQuestionsFromRawText(fullText);

    return NextResponse.json({
      success: parseResult.success,
      questions: parseResult.questions,
      errors: parseResult.errors,
      rawTextPreview: fullText.slice(0, 500),
      parsedBy: 'local-engine',
    });
  } catch (error) {
    console.error('PDF parsing error in API route:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to parse PDF document',
      },
      { status: 500 }
    );
  }
}

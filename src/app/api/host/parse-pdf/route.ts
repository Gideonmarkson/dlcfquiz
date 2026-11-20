import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { parseQuestionsFromRawText, extractGreenTextsFromPdf } from '@/lib/pdfExtractor';
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
    let pageTexts: string[] = [];
    let totalPages = 1;
    try {
      const extractionResult = await extractText(pdfData);
      totalPages = extractionResult.totalPages || 1;
      if (Array.isArray(extractionResult.text)) {
        pageTexts = extractionResult.text;
        fullText = extractionResult.text.join('\n\n');
      } else if (typeof extractionResult.text === 'string') {
        fullText = extractionResult.text;
        pageTexts = [extractionResult.text];
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
        console.log(`Invoking Gemini AI for intelligent multi-page PDF parsing (${totalPages} page${totalPages > 1 ? 's' : ''})...`);
        const geminiResult = await parsePdfWithGemini(arrayBuffer, fullText, explicitApiKey, pageTexts);
        if (geminiResult.success && geminiResult.questions.length > 0) {
          console.log(`Gemini successfully extracted ${geminiResult.questions.length} questions across ${totalPages} pages!`);
          return NextResponse.json({
            success: true,
            questions: geminiResult.questions,
            errors: geminiResult.errors,
            parsedBy: 'gemini-ai',
            totalPages,
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

    let greenTexts: string[] = [];
    try {
      const latin1Text = Buffer.from(arrayBuffer).toString('latin1');
      greenTexts = extractGreenTextsFromPdf(latin1Text);
    } catch {
      // ignore
    }

    const parseResult = parseQuestionsFromRawText(fullText, greenTexts);

    return NextResponse.json({
      success: parseResult.success,
      questions: parseResult.questions,
      errors: parseResult.errors,
      rawTextPreview: fullText.slice(0, 50000),
      parsedBy: 'local-engine',
      totalPages,
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

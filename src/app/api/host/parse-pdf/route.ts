import { NextRequest, NextResponse } from 'next/server';
import { extractText } from 'unpdf';
import { parseQuestionsFromRawText } from '@/lib/pdfExtractor';

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
    const extractionResult = await extractText(pdfData);
    let fullText = '';

    if (Array.isArray(extractionResult.text)) {
      fullText = extractionResult.text.join('\n\n');
    } else if (typeof extractionResult.text === 'string') {
      fullText = extractionResult.text;
    }

    if (!fullText || fullText.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Could not extract text from this PDF. If this is a scanned document (image-only), please copy text into a Word document or use the CSV template.',
        },
        { status: 422 }
      );
    }

    // Parse extracted text into questions
    const parseResult = parseQuestionsFromRawText(fullText);

    return NextResponse.json({
      success: parseResult.success,
      questions: parseResult.questions,
      errors: parseResult.errors,
      rawTextPreview: fullText.slice(0, 500),
      totalPages: extractionResult.totalPages,
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

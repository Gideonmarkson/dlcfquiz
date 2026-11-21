'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Upload } from 'lucide-react';
import { ui } from '@/lib/ui';
import { QuestionInput } from '@/types/quiz';
import {
  parseQuestionsFromCSV,
  parseQuestionsFromJSON,
  SAMPLE_CSV_TEMPLATE,
  SAMPLE_JSON_TEMPLATE,
} from '@/lib/questionParser';
import { extractQuestionsFromPdfFile, parseQuestionsFromRawText } from '@/lib/pdfExtractor';
import { generateSamplePdfBytes } from '@/lib/pdfTemplateGenerator';
import { SAMPLE_BIBLE_QUESTIONS } from '@/lib/sampleQuestions';

interface QuestionUploaderProps {
  onQuestionsLoaded: (questions: QuestionInput[]) => void;
}

export const QuestionUploader: React.FC<QuestionUploaderProps> = ({ onQuestionsLoaded }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [successCount, setSuccessCount] = useState<number | null>(null);
  const [totalPagesFound, setTotalPagesFound] = useState<number | null>(null);
  const [parsedSource, setParsedSource] = useState<'gemini-ai' | 'local-engine' | null>(null);
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);
  const [keySaved, setKeySaved] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('dlcf_gemini_api_key') || '';
      if (stored) setGeminiKey(stored);
    }
  }, []);

  const handleSaveKey = (val: string) => {
    setGeminiKey(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('dlcf_gemini_api_key', val.trim());
      setKeySaved(true);
      setTimeout(() => setKeySaved(false), 2000);
    }
  };

  const handleFileProcess = async (file: File) => {
    setParseErrors([]);
    setSuccessCount(null);
    setTotalPagesFound(null);
    setParsedSource(null);

    const fileName = file.name.toLowerCase();
    const isPdf = fileName.endsWith('.pdf');
    const isCsv = fileName.endsWith('.csv');
    const isJson = fileName.endsWith('.json');
    const isTxt = fileName.endsWith('.txt');

    if (!isPdf && !isCsv && !isJson && !isTxt) {
      setParseErrors(['That file type isn’t supported. Upload a .pdf, .csv, .json or .txt file.']);
      return;
    }

    setIsProcessing(true);

    try {
      if (isPdf) {
        // Extract questions directly via server engine & fallback (with Gemini key if present)
        const parseResult = await extractQuestionsFromPdfFile(file, geminiKey.trim() || undefined);
        if (parseResult.success && parseResult.questions.length > 0) {
          setSuccessCount(parseResult.questions.length);
          setTotalPagesFound(parseResult.totalPages || 1);
          setParsedSource(parseResult.parsedBy || 'gemini-ai');
          onQuestionsLoaded(parseResult.questions);
        } else {
          setParseErrors(
            parseResult.errors.length > 0
              ? parseResult.errors
              : ['No questions were found in this PDF. Compare it with the PDF template below.']
          );
        }
      } else if (isTxt) {
        const text = await file.text();
        const parseResult = parseQuestionsFromRawText(text);
        if (parseResult.success && parseResult.questions.length > 0) {
          setSuccessCount(parseResult.questions.length);
          onQuestionsLoaded(parseResult.questions);
        } else {
          setParseErrors(parseResult.errors);
        }
      } else if (isCsv) {
        const content = await file.text();
        const result = parseQuestionsFromCSV(content);
        if (result.success && result.questions.length > 0) {
          setSuccessCount(result.questions.length);
          onQuestionsLoaded(result.questions);
        } else {
          setParseErrors(result.errors.length > 0 ? result.errors : ['Failed to parse CSV file.']);
        }
      } else if (isJson) {
        const content = await file.text();
        const result = parseQuestionsFromJSON(content);
        if (result.success && result.questions.length > 0) {
          setSuccessCount(result.questions.length);
          onQuestionsLoaded(result.questions);
        } else {
          setParseErrors(result.errors.length > 0 ? result.errors : ['Failed to parse JSON file.']);
        }
      }
    } catch (err) {
      console.error('File parsing error:', err);
      setParseErrors([
        `Error reading file: ${err instanceof Error ? err.message : String(err)}`,
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  const handleDownloadTemplate = (type: 'pdf' | 'csv' | 'json') => {
    if (type === 'pdf') {
      const pdfBytes = generateSamplePdfBytes();
      const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'dlcf_bible_quiz_template.pdf');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    const content = type === 'csv' ? SAMPLE_CSV_TEMPLATE : SAMPLE_JSON_TEMPLATE;
    const blob = new Blob([content], {
      type: type === 'csv' ? 'text/csv;charset=utf-8;' : 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `dlcf_bible_quiz_template.${type}`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const usingOwnKey = geminiKey.trim().length > 10;

  return (
    <div className="flex w-full flex-col gap-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !isProcessing) fileInputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`flex cursor-pointer items-center gap-5 rounded-[var(--radius-tile)] border border-dashed p-6 transition-colors ${
          isDragging ? 'border-gilt bg-cover-2' : 'border-rule hover:border-faint hover:bg-cover'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.csv,.json,.txt"
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files[0]) {
              handleFileProcess(e.target.files[0]);
            }
          }}
        />
        <Upload className={`h-7 w-7 shrink-0 ${isProcessing ? 'animate-pulse text-gilt' : 'text-muted'}`} />
        <div>
          <p className="text-lg font-medium">
            {isProcessing ? 'Reading questions from your file…' : 'Upload your questions'}
          </p>
          <p className="text-muted">Drop a PDF, CSV or JSON file here, or click to choose one.</p>
        </div>
      </div>

      {successCount !== null && (
        <p role="status" className="border-l-2 border-psalm pl-3 text-psalm">
          Loaded {successCount} {successCount === 1 ? 'question' : 'questions'}
          {totalPagesFound && totalPagesFound > 1 ? ` from ${totalPagesFound} pages` : ''}
          {parsedSource === 'gemini-ai' ? ', read with Gemini.' : '.'} Check them below before you start.
        </p>
      )}

      {parseErrors.length > 0 && (
        <div role="alert" className="border-l-2 border-ribbon pl-3 text-sm text-[#f0a49d]">
          <p className="font-medium">
            {parseErrors.length === 1 ? 'There’s a problem with this file:' : `There are ${parseErrors.length} problems with this file:`}
          </p>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {parseErrors.slice(0, 5).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {parseErrors.length > 5 && <li>…and {parseErrors.length - 5} more.</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
        <span>
          Templates:{' '}
          {(['pdf', 'csv', 'json'] as const).map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 && ', '}
              <button
                type="button"
                onClick={() => handleDownloadTemplate(t)}
                className="text-page underline decoration-rule underline-offset-4 hover:decoration-gilt"
              >
                {t.toUpperCase()}
              </button>
            </React.Fragment>
          ))}
        </span>
        <button
          type="button"
          onClick={() => {
            setSuccessCount(SAMPLE_BIBLE_QUESTIONS.length);
            onQuestionsLoaded(SAMPLE_BIBLE_QUESTIONS);
          }}
          className="text-page underline decoration-rule underline-offset-4 hover:decoration-gilt"
        >
          Use the 5 sample questions
        </button>
        <button
          type="button"
          onClick={() => setShowKeyInput(!showKeyInput)}
          className="ml-auto text-page underline decoration-rule underline-offset-4 hover:decoration-gilt"
          aria-expanded={showKeyInput}
        >
          {usingOwnKey ? 'Gemini key added' : 'Add a Gemini key for hard-to-read PDFs'}
        </button>
      </div>

      {showKeyInput && (
        <div className="flex flex-col gap-2 border-t border-rule pt-4">
          <label htmlFor="gemini-key" className={ui.label}>
            Google AI Studio key
          </label>
          <div className="flex items-center gap-3">
            <input
              id="gemini-key"
              type="password"
              placeholder="AIzaSy…"
              value={geminiKey}
              onChange={(e) => handleSaveKey(e.target.value)}
              className={`${ui.input} py-2 text-sm`}
            />
            {keySaved && <span className="shrink-0 text-sm text-psalm">Saved</span>}
          </div>
          <p className="text-sm text-faint">
            Gemini reads PDFs with tables, two columns or unusual fonts. The key is stored in this browser only.
          </p>
        </div>
      )}
    </div>
  );
};

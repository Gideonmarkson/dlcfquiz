'use client';

import React, { useState, useRef } from 'react';
import { Upload, FileText, Download, Sparkles, AlertCircle, RefreshCw, FileCheck } from 'lucide-react';
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileProcess = async (file: File) => {
    setParseErrors([]);
    setSuccessCount(null);

    const fileName = file.name.toLowerCase();
    const isPdf = fileName.endsWith('.pdf');
    const isCsv = fileName.endsWith('.csv');
    const isJson = fileName.endsWith('.json');
    const isTxt = fileName.endsWith('.txt');

    if (!isPdf && !isCsv && !isJson && !isTxt) {
      setParseErrors(['Please upload a valid .pdf, .csv, or .json file.']);
      return;
    }

    setIsProcessing(true);

    try {
      if (isPdf) {
        // Extract questions directly via server engine & fallback
        const parseResult = await extractQuestionsFromPdfFile(file);
        if (parseResult.success && parseResult.questions.length > 0) {
          setSuccessCount(parseResult.questions.length);
          onQuestionsLoaded(parseResult.questions);
        } else {
          setParseErrors(
            parseResult.errors.length > 0
              ? parseResult.errors
              : ['No questions could be identified in this PDF. Please verify format matches template.']
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

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Dropzone Container */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => !isProcessing && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-3xl p-6 md:p-8 text-center cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-3 ${
          isDragging
            ? 'border-amber-400 bg-amber-500/10 scale-[1.01]'
            : 'border-slate-700 bg-slate-800/40 hover:border-slate-500 hover:bg-slate-800/70'
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

        <div className="w-14 h-14 rounded-2xl bg-amber-500/15 text-amber-400 flex items-center justify-center shadow-inner">
          {isProcessing ? (
            <RefreshCw className="w-7 h-7 animate-spin text-amber-400" />
          ) : (
            <Upload className="w-7 h-7" />
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <h3 className="font-extrabold text-slate-100 text-lg md:text-xl">
              Upload Question Bank
            </h3>
            <div className="flex items-center gap-1.5">
              <span className="px-2.5 py-0.5 rounded-md bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-black tracking-wider">
                PDF
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black tracking-wider">
                CSV
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-400 border border-blue-500/30 text-xs font-black tracking-wider">
                JSON
              </span>
            </div>
          </div>
          <p className="text-slate-300 text-xs md:text-sm max-w-lg leading-relaxed">
            Drag & drop your compilation <span className="text-red-400 font-bold font-mono">.pdf</span>, <span className="text-emerald-400 font-bold font-mono">.csv</span>, or <span className="text-blue-400 font-bold font-mono">.json</span> file here, or click to browse
          </p>
        </div>

        {isProcessing && (
          <span className="text-xs text-amber-300 font-semibold animate-pulse">
            Extracting questions and correct answers from PDF...
          </span>
        )}

        {successCount !== null && (
          <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 rounded-full">
            <FileCheck className="w-4 h-4" />
            <span>Loaded {successCount} questions from document!</span>
          </div>
        )}
      </div>

      {/* Action Row: Demo Pack & Templates */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs md:text-sm">
        <button
          type="button"
          onClick={() => {
            setSuccessCount(SAMPLE_BIBLE_QUESTIONS.length);
            onQuestionsLoaded(SAMPLE_BIBLE_QUESTIONS);
          }}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/30 font-semibold rounded-xl transition shadow-sm"
        >
          <Sparkles className="w-4 h-4" />
          Load 5-Question AFIT Demo Set
        </button>

        <div className="flex items-center gap-2 flex-wrap text-slate-400">
          <span className="font-semibold text-slate-300">Templates:</span>
          <button
            type="button"
            onClick={() => handleDownloadTemplate('pdf')}
            className="px-2.5 py-1 bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/30 rounded-lg font-bold flex items-center gap-1 transition"
          >
            <Download className="w-3.5 h-3.5" /> PDF
          </button>
          <button
            type="button"
            onClick={() => handleDownloadTemplate('csv')}
            className="px-2.5 py-1 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/30 rounded-lg font-bold flex items-center gap-1 transition"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={() => handleDownloadTemplate('json')}
            className="px-2.5 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 rounded-lg font-bold flex items-center gap-1 transition"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
        </div>
      </div>

      {/* Error Callout */}
      {parseErrors.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-200 flex flex-col gap-1.5 text-xs md:text-sm">
          <div className="flex items-center gap-2 font-bold text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Document Parsing Callouts ({parseErrors.length})</span>
          </div>
          <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-red-300">
            {parseErrors.slice(0, 5).map((err, i) => (
              <li key={i}>{err}</li>
            ))}
            {parseErrors.length > 5 && (
              <li>...and {parseErrors.length - 5} more issues.</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * ============================================================
 * @module modules/manuscript
 * @file ManuscriptAnalysisLab.tsx
 * ============================================================
 * @description 원고 분석실 - 기존 소설 파일 분석 및 이어쓰기
 * ============================================================
 */

import { useState, useRef } from 'react';
import type { Novel, AiAuthor, Chapter, Content } from '@core/types';
import {
  ArrowLeftIcon,
  WandSparklesIcon,
  XMarkIcon,
  toast,
} from '@shared/components';
import {
  analyzeAndCharacterizeNovel,
  createAuthorProfileFromNovel,
} from '@services/ai';

export interface ManuscriptAnalysisLabProps {
  authors: AiAuthor[];
  onBack: () => void;
  onCreateNovel: (novelData: Novel) => void;
  onCreateAuthor: (authorDetails: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>) => AiAuthor;
}

interface AnalysisResult {
  title?: string;
  subject?: string;
  mood?: string;
  plotSummary?: string;
  characters?: Novel['characters'];
}

interface AuthorProfile {
  writingStyle?: string;
  specialty?: string;
  coreDirectives?: string;
  tags?: string[];
}

export function ManuscriptAnalysisLab({
  authors,
  onBack,
  onCreateNovel,
  onCreateAuthor,
}: ManuscriptAnalysisLabProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isLongNovelMode, setIsLongNovelMode] = useState(false);
  const [loadingStep, setLoadingStep] = useState<'analyzing' | ''>('');
  const [manuscript, setManuscript] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [authorChoice, setAuthorChoice] = useState<'auto' | 'select'>('auto');
  const [createdAuthorProfile, setCreatedAuthorProfile] = useState<AuthorProfile | null>(null);
  const [selectedAuthorId, setSelectedAuthorId] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = loadingStep !== '';

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newlySelectedFiles = event.target.files;
    if (newlySelectedFiles && newlySelectedFiles.length > 0) {
      setFiles((currentFiles) => {
        const currentFileKeys = new Set(
          currentFiles.map((file: File) => `${file.name}-${file.size}-${file.lastModified}`)
        );

        const filesToAdd = Array.from(newlySelectedFiles).filter((file: File) => {
          const key = `${file.name}-${file.size}-${file.lastModified}`;
          return !currentFileKeys.has(key);
        });

        return [...currentFiles, ...filesToAdd];
      });
    }
  };

  const handleFileInputClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    fileInputRef.current?.click();
  };

  const handleAnalyze = async () => {
    if (files.length === 0) {
      setError('분석할 파일을 업로드해주세요.');
      return;
    }
    setError(null);
    setAnalysisResult(null);
    setCreatedAuthorProfile(null);

    const fileContents = await Promise.all(files.map((file) => file.text()));
    const manuscriptContent = fileContents.join('\n\n');
    setManuscript(manuscriptContent);

    try {
      setLoadingStep('analyzing');

      // 구조 분석과 문체 분석을 병렬로 실행 (분석 시간 50% 단축)
      const [structureResult, profileResult] = await Promise.all([
        analyzeAndCharacterizeNovel(manuscriptContent, isLongNovelMode),
        createAuthorProfileFromNovel(manuscriptContent, isLongNovelMode),
      ]);

      // 구조 분석 결과 처리
      const result: AnalysisResult = {
        title: (structureResult as AnalysisResult).title || files[0]?.name.replace('.txt', '') || '무제',
        subject: (structureResult as AnalysisResult).subject || '',
        mood: (structureResult as AnalysisResult).mood || '',
        plotSummary: (structureResult as AnalysisResult).plotSummary || '',
        characters: (structureResult as AnalysisResult).characters || [],
      };
      setAnalysisResult(result);

      // 문체 분석 결과 처리
      const profile: AuthorProfile = {
        writingStyle: profileResult.writingStyle || '',
        specialty: profileResult.specialty || '',
        coreDirectives: profileResult.coreDirectives || '',
        tags: profileResult.tags || [],
      };
      setCreatedAuthorProfile(profile);
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      setError(errorMessage);
    } finally {
      setLoadingStep('');
    }
  };

  const handleStart = () => {
    if (!analysisResult) return;

    let finalAuthorId: string | null = null;

    if (authorChoice === 'auto') {
      if (!createdAuthorProfile || !createdAuthorProfile.specialty) {
        toast.warning('자동 생성된 작가 프로필이 유효하지 않습니다.');
        return;
      }
      const newAuthorName = `${analysisResult.title || '새 소설'}의 작가`;
      const newAuthor = onCreateAuthor({
        name: newAuthorName,
        specialty: createdAuthorProfile.specialty || '',
        writingStyle: createdAuthorProfile.writingStyle || '',
        coreDirectives: createdAuthorProfile.coreDirectives || '',
        tags: createdAuthorProfile.tags || [],
      });
      finalAuthorId = newAuthor.id;
    } else {
      finalAuthorId = selectedAuthorId || null;
    }

    const CHAPTER_LIMIT = 3000;
    const chapters: Chapter[] = [];
    let remainingText = manuscript.trim();
    let chapterIndex = 1;

    if (remainingText) {
      while (remainingText.length > 0) {
        if (remainingText.length <= CHAPTER_LIMIT) {
          chapters.push({
            id: crypto.randomUUID(),
            title: `${chapterIndex}장`,
            content: remainingText,
            trace: { revision: 1, createdAt: Date.now(), updatedAt: Date.now(), source: 'imported' },
          });
          break;
        }

        const chunk = remainingText.substring(0, CHAPTER_LIMIT);
        let splitAt = chunk.lastIndexOf(' ');

        if (splitAt <= 0) {
          splitAt = CHAPTER_LIMIT;
        }

        const chapterContent = remainingText.substring(0, splitAt);
        chapters.push({
          id: crypto.randomUUID(),
          title: `${chapterIndex}장`,
          content: chapterContent.trim(),
          trace: { revision: 1, createdAt: Date.now(), updatedAt: Date.now(), source: 'imported' },
        });

        remainingText = remainingText.substring(splitAt).trim();
        chapterIndex++;
      }
    }

    const newHistory: Content[] = [];
    if (chapters.length > 0) {
      chapters.forEach((chapter) => {
        newHistory.push({ role: 'user', parts: [{ text: '다음 챕터를 이어서 작성해줘.' }] });
        newHistory.push({ role: 'model', parts: [{ text: chapter.content }] });
      });
    }

    const finalNovel: Novel = {
      id: `novel-${Date.now()}`,
      createdAt: Date.now(),
      history: newHistory,
      title: analysisResult.title || '무제',
      subject: analysisResult.subject || '알 수 없음',
      mood: analysisResult.mood || '알 수 없음',
      plotSummary: analysisResult.plotSummary || '요약 없음',
      characters: analysisResult.characters || [],
      chapters: chapters,
      aiAuthorId: finalAuthorId,
    };
    onCreateNovel(finalNovel);
  };

  const handleDragStart = (e: React.DragEvent<HTMLLIElement>, index: number) =>
    e.dataTransfer.setData('text/plain', index.toString());
  const handleDragOver = (e: React.DragEvent<HTMLLIElement>) => e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLLIElement>, dropIndex: number) => {
    e.preventDefault();
    const dragIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    const newFiles = [...files];
    const [draggedItem] = newFiles.splice(dragIndex, 1);
    newFiles.splice(dropIndex, 0, draggedItem);
    setFiles(newFiles);
  };

  const analyzeButtonText =
    loadingStep === 'analyzing'
      ? '원고 분석 중... (구조 + 문체 동시 분석)'
      : '원고 분석하기';

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col p-4 sm:p-6 lg:p-8">
      <header className="flex items-center mb-6">
        <button
          onClick={onBack}
          className="flex items-center text-indigo-400 hover:text-indigo-300 transition-colors mr-4"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" />
          <span>서재로</span>
        </button>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-white">원고 분석실</h1>
      </header>

      <div className="flex-grow flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Left Panel */}
        <div className="lg:w-1/2 flex flex-col">
          <h2 className="text-xl font-bold mb-2">1. 원고 파일 업로드</h2>
          <div className="flex-1 flex flex-col bg-gray-800 border border-gray-700 rounded-lg p-4">
            <input
              type="file"
              multiple
              accept=".txt"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={handleFileInputClick}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg"
            >
              파일 선택 (다중 선택 가능)
            </button>
            <p className="text-xs text-gray-500 mt-2 text-center">
              파일 이름 순으로 자동 정렬됩니다. 드래그하여 순서를 변경할 수 있습니다.
            </p>
            {files.length > 0 && (
              <ul className="mt-4 space-y-2 overflow-y-auto flex-1">
                {files.map((file, index) => (
                  <li
                    key={`${file.name}-${file.lastModified}-${index}`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, index)}
                    className="flex items-center justify-between bg-gray-700 p-2 rounded-md cursor-move"
                  >
                    <span className="truncate text-sm">
                      {index + 1}. {file.name}
                    </span>
                    <button
                      onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      className="p-1 text-gray-400 hover:text-red-400"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-4 border-t border-gray-700 pt-4">
              <label className="flex items-center space-x-2 text-sm text-gray-400">
                <input
                  type="checkbox"
                  checked={isLongNovelMode}
                  onChange={(e) => setIsLongNovelMode(e.target.checked)}
                  className="form-checkbox h-4 w-4 rounded bg-gray-600 border-gray-500 text-indigo-500 focus:ring-indigo-600"
                />
                <span>장편 소설 모드 (대용량 파일 분석)</span>
              </label>
            </div>
            <button
              onClick={handleAnalyze}
              disabled={isLoading || files.length === 0}
              className="mt-4 w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
            >
              <WandSparklesIcon className="w-5 h-5" />
              {analyzeButtonText}
            </button>
            {error && <p className="text-red-400 mt-2 text-sm">{error}</p>}
          </div>
        </div>

        {/* Right Panel */}
        <div className="lg:w-1/2 flex flex-col">
          <h2 className="text-xl font-bold mb-2">2. 분석 결과 및 설정</h2>
          <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg p-4 overflow-y-auto">
            {!analysisResult && isLoading && (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-gray-400 animate-pulse">{analyzeButtonText}</p>
              </div>
            )}
            {!analysisResult && !isLoading && (
              <div className="flex items-center justify-center h-full text-center">
                <p className="text-gray-500">분석 결과가 여기에 표시됩니다.</p>
              </div>
            )}
            {analysisResult && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-indigo-400">소설 정보 (AI 추론)</h3>
                <InputGroup
                  label="소설 제목"
                  value={analysisResult.title || ''}
                  onChange={(e) =>
                    setAnalysisResult({ ...analysisResult, title: e.target.value })
                  }
                />
                <TextAreaGroup
                  label="줄거리 요약"
                  value={analysisResult.plotSummary || ''}
                  onChange={(e) =>
                    setAnalysisResult({ ...analysisResult, plotSummary: e.target.value })
                  }
                  rows={4}
                />

                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-bold text-indigo-400 mb-2">작가 배정 방식</h3>
                  <div className="flex gap-4 mb-4">
                    <button
                      onClick={() => setAuthorChoice('auto')}
                      className={`flex-1 py-2 rounded-md text-sm font-semibold ${
                        authorChoice === 'auto'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      원고 분석으로 새 작가 생성
                    </button>
                    <button
                      onClick={() => setAuthorChoice('select')}
                      className={`flex-1 py-2 rounded-md text-sm font-semibold ${
                        authorChoice === 'select'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      기존 작가에서 선택
                    </button>
                  </div>

                  {authorChoice === 'auto' &&
                    (!createdAuthorProfile ? (
                      <p className="text-sm text-gray-400 animate-pulse">
                        원고의 문체를 분석하여 작가를 생성 중...
                      </p>
                    ) : (
                      <div className="p-3 bg-gray-700/50 rounded-md text-xs space-y-1">
                        <p>
                          <b>스타일:</b> {createdAuthorProfile.writingStyle}
                        </p>
                        <p>
                          <b>장르:</b> {createdAuthorProfile.specialty}
                        </p>
                      </div>
                    ))}

                  {authorChoice === 'select' && (
                    <select
                      value={selectedAuthorId || ''}
                      onChange={(e) => setSelectedAuthorId(e.target.value)}
                      className="w-full bg-gray-700 p-2 rounded-md"
                    >
                      <option value="">기본 만능 작가</option>
                      {authors.map((author) => (
                        <option key={author.id} value={author.id}>
                          {author.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="text-center pt-4">
                  <button
                    onClick={handleStart}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg"
                  >
                    이 내용으로 이어쓰기 시작
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InputGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={onChange}
        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>
  );
}

function TextAreaGroup({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: React.ChangeEventHandler<HTMLTextAreaElement>;
  rows: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-1">{label}</label>
      <textarea
        value={value}
        onChange={onChange}
        rows={rows}
        className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>
  );
}

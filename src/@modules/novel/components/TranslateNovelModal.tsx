/**
 * ============================================================
 * @module modules/novel/components
 * @file TranslateNovelModal.tsx
 * ============================================================
 * @description 소설 전체 번역 모달
 * ============================================================
 */

import { useState } from 'react';
import type { Novel } from '@core/types';
import { Modal } from '@shared/components/Modal';
import { LanguageIcon } from '@shared/components';
import {
  translateLongText,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from '@services/ai/translation';

interface TranslateNovelModalProps {
  novel: Novel;
  isOpen: boolean;
  onClose: () => void;
  onTranslated: (translatedNovel: Novel) => void;
}

export function TranslateNovelModal({
  novel,
  isOpen,
  onClose,
  onTranslated,
}: TranslateNovelModalProps) {
  const [targetLang, setTargetLang] = useState<LanguageCode>('en');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [saveOption, setSaveOption] = useState<'new' | 'overwrite'>('new');

  const handleTranslate = async () => {
    setIsTranslating(true);
    setError(null);
    setProgress({ current: 0, total: novel.chapters.length });

    try {
      const translatedChapters = [];

      for (let i = 0; i < novel.chapters.length; i++) {
        setProgress({ current: i + 1, total: novel.chapters.length });

        const chapter = novel.chapters[i];

        // 제목 번역
        const translatedTitle = await translateLongText(chapter.title, targetLang);

        // 본문 번역
        const translatedContent = await translateLongText(chapter.content, targetLang);

        translatedChapters.push({
          ...chapter,
          id: saveOption === 'new' ? crypto.randomUUID() : chapter.id,
          title: translatedTitle,
          content: translatedContent,
          trace: {
            revision: saveOption === 'new' ? 1 : (chapter.trace?.revision ?? 1) + 1,
            createdAt: saveOption === 'new' ? Date.now() : (chapter.trace?.createdAt ?? Date.now()),
            updatedAt: Date.now(),
            source: 'translated' as const,
            originChapterId: saveOption === 'new' ? chapter.id : chapter.trace?.originChapterId,
          },
        });

        // API 제한 방지 딜레이
        if (i < novel.chapters.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // 소설 제목, 줄거리도 번역
      const translatedTitle = await translateLongText(novel.title, targetLang);
      const translatedPlotSummary = novel.plotSummary
        ? await translateLongText(novel.plotSummary, targetLang)
        : '';

      const langName = SUPPORTED_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;

      const translatedNovel: Novel = {
        ...novel,
        id: saveOption === 'new' ? crypto.randomUUID() : novel.id,
        title: saveOption === 'new' ? `${translatedTitle} (${langName})` : translatedTitle,
        plotSummary: translatedPlotSummary,
        chapters: translatedChapters,
        createdAt: saveOption === 'new' ? Date.now() : novel.createdAt,
      };

      onTranslated(translatedNovel);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '번역 중 오류가 발생했습니다.');
    } finally {
      setIsTranslating(false);
    }
  };

  const totalCharacters = novel.chapters.reduce((sum, ch) => sum + ch.content.length, 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="소설 번역">
      <div className="space-y-6">
        {/* 소설 정보 */}
        <div className="bg-gray-800 rounded-lg p-4">
          <h3 className="font-semibold text-indigo-400">{novel.title}</h3>
          <p className="text-sm text-gray-400 mt-1">
            {novel.chapters.length}개 챕터 · {totalCharacters.toLocaleString()}자
          </p>
        </div>

        {/* 언어 선택 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            <LanguageIcon className="w-4 h-4 inline mr-1" />
            번역할 언어
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value as LanguageCode)}
            disabled={isTranslating}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-indigo-500"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.name} ({lang.nativeName})
              </option>
            ))}
          </select>
        </div>

        {/* 저장 옵션 */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            저장 방식
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="saveOption"
                value="new"
                checked={saveOption === 'new'}
                onChange={() => setSaveOption('new')}
                disabled={isTranslating}
                className="text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-gray-300">새 소설로 저장 (원본 유지)</span>
            </label>
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="saveOption"
                value="overwrite"
                checked={saveOption === 'overwrite'}
                onChange={() => setSaveOption('overwrite')}
                disabled={isTranslating}
                className="text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-gray-300">원본에 덮어쓰기</span>
            </label>
          </div>
        </div>

        {/* 진행 상황 */}
        {isTranslating && (
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between text-sm text-gray-300 mb-2">
              <span>번역 중...</span>
              <span>{progress.current} / {progress.total} 챕터</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progress.current / progress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* 에러 메시지 */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* 버튼 */}
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            disabled={isTranslating}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            취소
          </button>
          <button
            onClick={handleTranslate}
            disabled={isTranslating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2"
          >
            {isTranslating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>번역 중...</span>
              </>
            ) : (
              <>
                <LanguageIcon className="w-4 h-4" />
                <span>번역 시작</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}

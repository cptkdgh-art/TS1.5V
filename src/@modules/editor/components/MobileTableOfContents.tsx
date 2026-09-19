/**
 * ============================================================
 * @module modules/editor/components
 * @file MobileTableOfContents.tsx
 * ============================================================
 * @description 모바일 전용 풀스크린 목차 컴포넌트
 * ============================================================
 */

import type { Chapter } from '@core/types';
import type { EditorTab } from '../types';
import { XMarkIcon, ArrowLeftIcon, BookOpenIcon } from '@shared/components';

interface MobileTableOfContentsProps {
  isOpen: boolean;
  onClose: () => void;
  chapters: Chapter[];
  selectedIndex: number;
  onChapterSelect: (index: number) => void;
  onTabChange: (tab: EditorTab) => void;
  onBack: () => void;
}

export function MobileTableOfContents({
  isOpen,
  onClose,
  chapters,
  selectedIndex,
  onChapterSelect,
  onTabChange,
  onBack,
}: MobileTableOfContentsProps) {
  if (!isOpen) return null;

  const handleChapterClick = (index: number) => {
    onChapterSelect(index);
    onTabChange('content');
    onClose();
  };

  const handleBack = () => {
    onClose();
    onBack();
  };

  // 총 글자 수 계산
  const totalChars = chapters.reduce((sum, ch) => sum + (ch.content?.length || 0), 0);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900 lg:hidden flex flex-col">
      {/* 헤더 */}
      <header className="flex items-center justify-between p-4 border-b border-gray-700 shrink-0">
        <button
          onClick={handleBack}
          className="flex items-center gap-2 text-gray-400 hover:text-white"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          <span>목록으로</span>
        </button>
        <button
          onClick={onClose}
          aria-label="목차 닫기"
          className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-800"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
      </header>

      {/* 통계 */}
      <div className="px-4 py-3 bg-gray-800/50 border-b border-gray-700">
        <div className="flex items-center gap-3 text-sm">
          <BookOpenIcon className="w-5 h-5 text-indigo-400" />
          <span className="text-gray-300">
            {chapters.length}개 챕터 · {totalChars.toLocaleString()}자
          </span>
        </div>
      </div>

      {/* 챕터 목록 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {chapters.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>아직 작성된 챕터가 없습니다.</p>
            <p className="text-sm mt-2">새 장 추가를 눌러 시작하세요.</p>
          </div>
        ) : (
          chapters.map((chapter, index) => {
            const chapterNum = chapter.chapterNumber ?? index + 1;
            // 제목이 "N화" 또는 "N장" 패턴이면 번호 배지 생략
            const titleHasNumber = /^\d+[화장]/.test(chapter.title || '');
            return (
            <button
              key={index}
              onClick={() => handleChapterClick(index)}
              className={`w-full text-left p-4 rounded-lg transition-colors ${
                selectedIndex === index
                  ? 'bg-indigo-600 hover:bg-indigo-500'
                  : 'bg-gray-800 hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">
                  {!titleHasNumber && (
                    <span className="text-xs bg-gray-700 px-1.5 py-0.5 rounded mr-2">{chapterNum}화</span>
                  )}
                  {chapter.title || `${chapterNum}화`}
                </span>
                <span className="text-xs text-gray-500">
                  {(chapter.content?.length || 0).toLocaleString()}자
                </span>
              </div>
              {chapter.content && (
                <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                  {chapter.content.substring(0, 100)}...
                </p>
              )}
            </button>
          );
          })
        )}
      </div>

      {/* 탭 네비게이션 */}
      <nav className="shrink-0 border-t border-gray-700 bg-gray-800 p-2">
        <div className="grid grid-cols-5 gap-1">
          {[
            { id: 'content' as EditorTab, label: '본문' },
            { id: 'characters' as EditorTab, label: '인물' },
            { id: 'worldview' as EditorTab, label: '세계관' },
            { id: 'settings' as EditorTab, label: '설정' },
            { id: 'cache' as EditorTab, label: '캐시' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                onTabChange(tab.id);
                onClose();
              }}
              className="py-2 px-1 text-xs text-center text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

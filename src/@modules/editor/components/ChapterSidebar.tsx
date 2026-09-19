/**
 * ============================================================
 * @module modules/editor/components
 * @file ChapterSidebar.tsx
 * ============================================================
 * @description 챕터 목록 사이드바 컴포넌트
 * ============================================================
 */

import { useState } from 'react';
import type { Chapter } from '@core/types';
import { PlusIcon, ChevronDoubleLeftIcon } from '@shared/components';

interface ChapterSidebarProps {
  chapters: Chapter[];
  selectedIndex: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectChapter: (index: number) => void;
  onAddChapter: () => void;
  onUpdateChapterTitle?: (index: number, title: string) => void;
}

export function ChapterSidebar({
  chapters,
  selectedIndex,
  isOpen,
  onClose,
  onSelectChapter,
  onAddChapter,
  onUpdateChapterTitle,
}: ChapterSidebarProps) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  if (!isOpen) return null;

  /** 제목 편집 시작 (더블클릭) */
  const handleStartEdit = (e: React.MouseEvent, index: number, currentTitle: string) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingIndex(index);
    setEditValue(currentTitle);
  };

  /** 제목 편집 완료 */
  const handleFinishEdit = (index: number) => {
    if (editValue.trim() && onUpdateChapterTitle) {
      onUpdateChapterTitle(index, editValue.trim());
    }
    setEditingIndex(null);
    setEditValue('');
  };

  /** 키보드 이벤트 처리 */
  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      handleFinishEdit(index);
    } else if (e.key === 'Escape') {
      setEditingIndex(null);
      setEditValue('');
    }
  };

  return (
    <aside className="fixed lg:relative inset-y-0 left-0 z-40 w-64 bg-gray-800 border-r border-gray-700 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-gray-700">
        <h2 className="font-bold text-white">목차</h2>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white rounded"
        >
          <ChevronDoubleLeftIcon className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {chapters.map((chapter, index) => {
          const isEditing = editingIndex === index;
          const displayTitle = chapter.title || `${index + 1}화`;

          return (
            <button
              key={index}
              onClick={() => onSelectChapter(index)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                selectedIndex === index
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
            >
              {isEditing ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleFinishEdit(index)}
                  onKeyDown={(e) => handleKeyDown(e, index)}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full px-2 py-1 text-sm bg-gray-900 border border-gray-600 rounded text-white"
                  autoFocus
                  placeholder="예: 6화 또는 6화 제목"
                />
              ) : (
                <span
                  onDoubleClick={(e) => handleStartEdit(e, index, displayTitle)}
                  className="font-medium truncate block cursor-text"
                  title="더블클릭하여 제목 수정"
                >
                  {displayTitle}
                </span>
              )}
              <p className="text-xs text-gray-400 mt-0.5 truncate">
                {chapter.content.length.toLocaleString()}자
              </p>
            </button>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-700">
        <button
          onClick={onAddChapter}
          className="w-full flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 text-white py-2 px-4 rounded-lg transition-colors"
        >
          <PlusIcon className="w-4 h-4" />
          새 장 추가
        </button>
      </div>
    </aside>
  );
}

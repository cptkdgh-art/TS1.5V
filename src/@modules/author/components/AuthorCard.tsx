/**
 * ============================================================
 * @module modules/author/components
 * @file AuthorCard.tsx
 * ============================================================
 * @description AI 작가 카드 컴포넌트
 * ============================================================
 */

import { memo, useState, useRef, useEffect } from 'react';
import type { AiAuthor } from '@core/types';
import {
  PencilIcon,
  TrashIcon,
  DocumentDuplicateIcon,
  ChatBubbleThoughtIcon,
  ChatBubbleLeftEllipsisIcon,
  BrainIcon,
  EllipsisVerticalIcon,
} from '@shared/components';

interface AuthorCardProps {
  author: AiAuthor;
  isSelected: boolean;
  onToggleSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onOpenMemory: () => void;
  onOpenGeneralChat: () => void;
  onOpenMetaChat: () => void;
}

export const AuthorCard = memo(function AuthorCard({
  author,
  isSelected,
  onToggleSelect,
  onEdit,
  onDelete,
  onDuplicate,
  onOpenMemory,
  onOpenGeneralChat,
  onOpenMetaChat,
}: AuthorCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className={`bg-gray-800 rounded-lg p-3 sm:p-5 flex items-start gap-2.5 sm:gap-4 transition-all ${
        isSelected ? 'ring-2 ring-teal-500' : 'ring-0 ring-transparent'
      }`}
    >
      {/* 선택 체크박스 */}
      <div className="mt-0.5 sm:mt-1 shrink-0">
        <input
          type="checkbox"
          className="form-checkbox h-4 w-4 sm:h-5 sm:w-5 rounded bg-gray-700 border-gray-600 text-teal-500 focus:ring-teal-600 cursor-pointer"
          checked={isSelected}
          onChange={onToggleSelect}
        />
      </div>

      {/* 작가 정보 */}
      <div className="flex-grow min-w-0">
        <div className="flex items-center gap-2 sm:gap-3 mb-1.5 sm:mb-2">
          <h3 className="font-bold text-lg sm:text-xl text-white truncate">{author.name}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {author.isDefault && (
              <span className="text-xs font-medium bg-gray-600 text-gray-300 px-2 py-0.5 rounded-full">
                기본
              </span>
            )}
            {author.role && (
              <span className="text-xs font-medium bg-yellow-500/20 text-yellow-300 px-2 py-0.5 rounded-full">
                {author.role}
              </span>
            )}
          </div>
        </div>

        <div className="text-sm space-y-1 sm:space-y-2 text-gray-300 mb-2 sm:mb-3">
          <p>
            <strong className="font-semibold text-gray-500 mr-2">전문 분야:</strong>
            {author.specialty}
          </p>
          <p>
            <strong className="font-semibold text-gray-500 mr-2">문체:</strong>
            {author.writingStyle}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {author.tags?.map((tag) => (
            <span
              key={tag}
              className="text-xs font-medium bg-indigo-500/20 text-indigo-300 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* 데스크톱: 액션 버튼 전체 표시 */}
      <div className="hidden sm:flex items-center gap-1 shrink-0">
        <button onClick={onOpenMemory} title="작가 기억 관리" className="p-2 text-gray-400 hover:text-indigo-400 rounded-full hover:bg-gray-700">
          <BrainIcon className="w-5 h-5" />
        </button>
        <button onClick={onOpenGeneralChat} title="일반 대화" className="p-2 text-gray-400 hover:text-indigo-400 rounded-full hover:bg-gray-700">
          <ChatBubbleLeftEllipsisIcon className="w-5 h-5" />
        </button>
        <button onClick={onOpenMetaChat} title="성장 회고 대화" className="p-2 text-gray-400 hover:text-indigo-400 rounded-full hover:bg-gray-700">
          <ChatBubbleThoughtIcon className="w-5 h-5" />
        </button>
        <button onClick={onDuplicate} title="복제" className="p-2 text-gray-400 hover:text-indigo-400 rounded-full hover:bg-gray-700">
          <DocumentDuplicateIcon className="w-5 h-5" />
        </button>
        {!author.isDefault && (
          <>
            <button onClick={onEdit} title="수정" className="p-2 text-gray-400 hover:text-indigo-400 rounded-full hover:bg-gray-700">
              <PencilIcon className="w-5 h-5" />
            </button>
            <button onClick={onDelete} title="삭제" className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-700">
              <TrashIcon className="w-5 h-5" />
            </button>
          </>
        )}
      </div>

      {/* 모바일: 더보기 메뉴 */}
      <div className="relative sm:hidden shrink-0" ref={menuRef}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="p-1.5 text-gray-400 hover:text-white rounded-full hover:bg-gray-700"
        >
          <EllipsisVerticalIcon className="w-5 h-5" />
        </button>
        {showMenu && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
            <button onClick={() => { onOpenMemory(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 flex items-center gap-2">
              <BrainIcon className="w-3.5 h-3.5" /> 기억 관리
            </button>
            <button onClick={() => { onOpenGeneralChat(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 flex items-center gap-2">
              <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5" /> 일반 대화
            </button>
            <button onClick={() => { onOpenMetaChat(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 flex items-center gap-2">
              <ChatBubbleThoughtIcon className="w-3.5 h-3.5" /> 성장 회고
            </button>
            <button onClick={() => { onDuplicate(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 flex items-center gap-2">
              <DocumentDuplicateIcon className="w-3.5 h-3.5" /> 복제
            </button>
            {!author.isDefault && (
              <>
                <button onClick={() => { onEdit(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-gray-300 hover:bg-gray-700 flex items-center gap-2">
                  <PencilIcon className="w-3.5 h-3.5" /> 수정
                </button>
                <hr className="my-1 border-gray-700" />
                <button onClick={() => { onDelete(); setShowMenu(false); }} className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-gray-700 flex items-center gap-2">
                  <TrashIcon className="w-3.5 h-3.5" /> 삭제
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
});

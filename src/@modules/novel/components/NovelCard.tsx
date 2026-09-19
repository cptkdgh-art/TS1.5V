/**
 * ============================================================
 * @module modules/novel/components
 * @file NovelCard.tsx
 * ============================================================
 * @description 소설 카드 컴포넌트 (모바일 최적화 버전)
 * - compact 모드: 모바일용 가로 레이아웃, 액션 메뉴화
 * - 기본 모드: 기존 스타일 유지
 * ============================================================
 */

import { useRef, useEffect, useState, useMemo, memo } from 'react';
import type { Novel } from '@core/types';
import {
  TrashIcon,
  ArrowDownTrayIcon,
  DocumentDuplicateIcon,
  PhotoIcon,
  DocumentTextIcon,
  ArchiveBoxIcon,
  LanguageIcon,
  EllipsisVerticalIcon,
} from '@shared/components';

interface NovelCardProps {
  novel: Novel;
  volumeLabel?: string;
  compact?: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onExport: (format: 'json' | 'txt') => void;
  onIncorporateToSeries?: () => void;
  onTranslate?: () => void;
}

export const NovelCard = memo(function NovelCard({
  novel,
  volumeLabel,
  compact = false,
  onSelect,
  onDuplicate,
  onDelete,
  onExport,
  onIncorporateToSeries,
  onTranslate,
}: NovelCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const characterCount = useMemo(
    () => novel.chapters.reduce((sum, ch) => sum + ch.content.length, 0),
    [novel.chapters]
  );

  const displayTitle = volumeLabel ? `[${volumeLabel}] ${novel.title}` : novel.title;
  const formattedCount = characterCount >= 10000
    ? `${(characterCount / 10000).toFixed(1)}만자`
    : `${characterCount.toLocaleString()}자`;

  // 시간 포맷 (상대적)
  const getRelativeTime = (date: string | number) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    if (diffHours < 24) return `${diffHours}시간 전`;
    if (diffDays < 7) return `${diffDays}일 전`;
    return then.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  // 컴팩트 모드 (모바일용)
  if (compact) {
    return (
      <li className="bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-all duration-200 p-3">
        <div className="flex items-center gap-3">
          {/* 썸네일 (작게) */}
          <div
            onClick={onSelect}
            className="w-14 h-20 shrink-0 bg-gray-600 rounded overflow-hidden cursor-pointer"
          >
            {novel.coverImage ? (
              <img
                src={novel.coverImage}
                alt={`${novel.title} 표지`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <PhotoIcon className="w-6 h-6 text-gray-500" />
              </div>
            )}
          </div>

          {/* 정보 */}
          <div onClick={onSelect} className="flex-grow min-w-0 cursor-pointer">
            <h3 className="text-base font-semibold text-indigo-400 truncate">
              {displayTitle}
            </h3>
            <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">
              {novel.plotSummary || novel.subject || '설명 없음'}
            </p>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
              <span>{novel.chapters.length}화</span>
              <span>·</span>
              <span>{formattedCount}</span>
              <span>·</span>
              <span>{getRelativeTime(novel.createdAt)}</span>
            </div>
          </div>

          {/* 더보기 메뉴 */}
          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(!showMenu);
              }}
              className="p-2 text-gray-400 hover:text-white rounded-full hover:bg-gray-600 transition-colors"
              aria-label="더보기"
            >
              <EllipsisVerticalIcon className="w-5 h-5" />
            </button>

            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                {onIncorporateToSeries && (
                  <button
                    onClick={() => { onIncorporateToSeries(); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <ArchiveBoxIcon className="w-4 h-4" />
                    시리즈 편입
                  </button>
                )}
                {onTranslate && (
                  <button
                    onClick={() => { onTranslate(); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                  >
                    <LanguageIcon className="w-4 h-4" />
                    번역
                  </button>
                )}
                <button
                  onClick={() => { onDuplicate(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <DocumentDuplicateIcon className="w-4 h-4" />
                  복제
                </button>
                <button
                  onClick={() => { onExport('json'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  JSON 내보내기
                </button>
                <button
                  onClick={() => { onExport('txt'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  TXT 내보내기
                </button>
                <div className="border-t border-gray-700 my-1" />
                <button
                  onClick={() => { onDelete(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-900/30 flex items-center gap-2"
                >
                  <TrashIcon className="w-4 h-4" />
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </li>
    );
  }

  // 기본 모드 (데스크탑)
  return (
    <li className="group bg-gray-700 hover:bg-gray-600 rounded-lg transition-all duration-200 flex items-start space-x-4 p-4">
      {/* 커버 이미지 영역 */}
      <div
        onClick={onSelect}
        className="w-24 h-36 sm:w-28 sm:h-40 shrink-0 bg-gray-600 rounded-md flex items-center justify-center cursor-pointer overflow-hidden"
      >
        {novel.coverImage ? (
          <img
            src={novel.coverImage}
            alt={`${novel.title} 표지`}
            className="w-full h-full object-cover"
          />
        ) : (
          <PhotoIcon className="w-10 h-10 text-gray-500" />
        )}
      </div>

      {/* 소설 정보 영역 */}
      <div className="flex-grow flex flex-col justify-between h-36 sm:h-40">
        <div onClick={onSelect} className="cursor-pointer flex-grow pr-4">
          <h3 className="text-lg font-semibold text-indigo-400 line-clamp-1">
            {displayTitle}
          </h3>
          <p className="text-gray-400 mt-1 text-sm line-clamp-2">
            {novel.plotSummary || novel.subject || '설명 없음'}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="inline-flex items-center text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
              {novel.chapters.length}화
            </span>
            <span className="inline-flex items-center text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded">
              {formattedCount}
            </span>
            <span className="text-xs text-gray-500">
              {getRelativeTime(novel.createdAt)}
            </span>
          </div>
        </div>

        <div className="flex items-end justify-between">
          <div />

          {/* 액션 버튼 (호버시 표시) */}
          <div className="flex items-center space-x-1 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity" role="group" aria-label="소설 관리 버튼">
            {onIncorporateToSeries && (
              <button
                onClick={(e) => { e.stopPropagation(); onIncorporateToSeries(); }}
                className="p-2 text-gray-400 hover:text-indigo-400 rounded-full hover:bg-gray-800 transition-colors"
                aria-label="시리즈에 편입"
              >
                <ArchiveBoxIcon className="w-5 h-5" />
              </button>
            )}
            {onTranslate && (
              <button
                onClick={(e) => { e.stopPropagation(); onTranslate(); }}
                className="p-2 text-gray-400 hover:text-blue-400 rounded-full hover:bg-gray-800 transition-colors"
                aria-label="소설 번역"
              >
                <LanguageIcon className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
              className="p-2 text-gray-400 hover:text-indigo-400 rounded-full hover:bg-gray-800 transition-colors"
              aria-label="소설 복제"
            >
              <DocumentDuplicateIcon className="w-5 h-5" />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="p-2 text-gray-400 hover:text-indigo-400 rounded-full hover:bg-gray-800 transition-colors"
                aria-label="소설 내보내기"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
              </button>
              {showMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-48 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-10">
                  <button
                    onClick={() => { onExport('json'); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                  >
                    <ArrowDownTrayIcon className="w-4 h-4 mr-2" />
                    JSON (백업용)
                  </button>
                  <button
                    onClick={() => { onExport('txt'); setShowMenu(false); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center"
                  >
                    <DocumentTextIcon className="w-4 h-4 mr-2" />
                    TXT (읽기용)
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-2 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-800 transition-colors"
              aria-label="소설 삭제"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
});

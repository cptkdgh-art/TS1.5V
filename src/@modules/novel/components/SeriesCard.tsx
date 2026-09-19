/**
 * ============================================================
 * @module modules/novel/components
 * @file SeriesCard.tsx
 * ============================================================
 * @description 시리즈 카드 컴포넌트
 * ============================================================
 */

import { useState, useMemo, memo, useEffect, useRef } from 'react';
import type { Novel, Series } from '@core/types';
import { ChevronDownIcon, ArrowDownTrayIcon, BrainIcon, QuestionMarkCircleIcon, TrashIcon, CubeIcon, EllipsisVerticalIcon, PlusIcon } from '@shared/components';
import { NovelCard } from './NovelCard';
import { SeriesWorkflowGuideModal } from './SeriesWorkflowGuideModal';
import { getVolumeDisplayLabel, resolveSeriesVolume } from '@services/novel';

interface SeriesCardProps {
  series: Series;
  novelsInSeries: Novel[]; // 이미 시리즈에 속한 소설들만 전달받음 (상위에서 Map으로 O(1) 조회)
  isOpen: boolean;
  onToggle: () => void;
  onSelectNovel: (id: string) => void;
  onDuplicateNovel: (id: string) => void;
  onDeleteNovel: (novel: Novel) => void;
  onExportNovel: (novel: Novel, format: 'json' | 'txt') => void;
  onExportSeries: () => void;
  onOpenMemory: () => void;
  onOpenArchitect: () => void;
  onCreateNextVolume: () => void;
  onDeleteSeries: () => void;
}

export const SeriesCard = memo(function SeriesCard({
  series,
  novelsInSeries,
  isOpen,
  onToggle,
  onSelectNovel,
  onDuplicateNovel,
  onDeleteNovel,
  onExportNovel,
  onExportSeries,
  onOpenMemory,
  onOpenArchitect,
  onCreateNextVolume,
  onDeleteSeries,
}: SeriesCardProps) {
  const [isGuideOpen, setIsGuideOpen] = useState(false);
  const [isDeleteConfirm, setIsDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // 모바일 감지
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // novelIds 순서대로 정렬 (O(n) 조회를 위해 Map 사용)
  const seriesNovels = useMemo(() => {
    const novelMap = new Map(novelsInSeries.map(n => [n.id, n]));
    return series.novelIds
      .map(id => novelMap.get(id))
      .filter((n): n is Novel => n !== undefined)
      .sort((a, b) => {
        const aNumber = resolveSeriesVolume(series, a)?.volumeNumber ?? a.volumeNumber ?? Number.MAX_SAFE_INTEGER;
        const bNumber = resolveSeriesVolume(series, b)?.volumeNumber ?? b.volumeNumber ?? Number.MAX_SAFE_INTEGER;
        return aNumber - bNumber;
      });
  }, [series, novelsInSeries]);

  return (
    <div className="bg-gray-800 shadow-lg rounded-lg p-4 sm:p-6">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-4 gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={onToggle}
            aria-label={`시리즈 ${series.title} ${isOpen ? '접기' : '펼치기'}`}
            aria-expanded={isOpen}
            className="p-1 text-gray-400 hover:text-white shrink-0"
          >
            <ChevronDownIcon
              className={`w-5 h-5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
          <h3 className="text-base sm:text-xl font-bold text-indigo-400 truncate">{series.title}</h3>
          <span className="text-xs text-gray-500 shrink-0">{seriesNovels.length}권</span>
        </div>

        {/* 데스크톱: 전체 버튼 표시 */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={() => setIsGuideOpen(true)}
            className="text-sm text-gray-400 hover:text-indigo-400 p-1 rounded transition-colors"
            title="시리즈 기억 관리 가이드"
          >
            <QuestionMarkCircleIcon className="w-5 h-5" />
          </button>
          <button
            onClick={onOpenMemory}
            className="text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded-lg flex items-center gap-1"
          >
            <BrainIcon className="w-4 h-4" />
            기억 관리
          </button>
          <button
            onClick={onOpenArchitect}
            className={`text-sm font-semibold py-1 px-3 rounded-lg flex items-center gap-1 ${
              series.blueprint
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-white'
            }`}
            title={series.blueprint ? '청사진 수정' : '시리즈 구조 설계'}
          >
            <CubeIcon className="w-4 h-4" />
            {series.blueprint ? '청사진' : '구조 설계'}
          </button>
          <button
            onClick={onExportSeries}
            className="text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded-lg flex items-center gap-1"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            TXT
          </button>
          <button
            onClick={onCreateNextVolume}
            className="text-sm bg-gray-700 hover:bg-gray-600 text-white font-semibold py-1 px-3 rounded-lg"
          >
            다음 권 집필
          </button>
          {isDeleteConfirm ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onDeleteSeries();
                  setIsDeleteConfirm(false);
                }}
                className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-lg"
              >
                삭제 확인
              </button>
              <button
                onClick={() => setIsDeleteConfirm(false)}
                className="text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-2 rounded-lg"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsDeleteConfirm(true)}
              className="text-sm text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
              title="시리즈 삭제"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 모바일: 다음 권 + 더보기 메뉴 */}
        <div className="flex md:hidden items-center gap-1">
          <button
            onClick={onCreateNextVolume}
            className="p-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg"
            title="다음 권 집필"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700"
              aria-label="시리즈 메뉴"
            >
              <EllipsisVerticalIcon className="w-5 h-5" />
            </button>
            {showMenu && (
              <div className="absolute right-0 top-full mt-1 w-40 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
                <button
                  onClick={() => { onOpenMemory(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <BrainIcon className="w-4 h-4" /> 기억 관리
                </button>
                <button
                  onClick={() => { onOpenArchitect(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <CubeIcon className="w-4 h-4" /> {series.blueprint ? '청사진' : '구조 설계'}
                </button>
                <button
                  onClick={() => { onExportSeries(); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" /> TXT 내보내기
                </button>
                <button
                  onClick={() => { setIsGuideOpen(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 flex items-center gap-2"
                >
                  <QuestionMarkCircleIcon className="w-4 h-4" /> 가이드
                </button>
                <hr className="my-1 border-gray-700" />
                <button
                  onClick={() => { setIsDeleteConfirm(true); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
                >
                  <TrashIcon className="w-4 h-4" /> 시리즈 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 모바일 삭제 확인 */}
      {isDeleteConfirm && isMobile && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700 rounded-lg flex items-center justify-between">
          <span className="text-sm text-red-300">시리즈를 삭제하시겠습니까?</span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onDeleteSeries();
                setIsDeleteConfirm(false);
              }}
              className="text-sm bg-red-600 hover:bg-red-700 text-white font-semibold py-1 px-3 rounded-lg"
            >
              삭제
            </button>
            <button
              onClick={() => setIsDeleteConfirm(false)}
              className="text-sm bg-gray-600 hover:bg-gray-500 text-white font-semibold py-1 px-2 rounded-lg"
            >
              취소
            </button>
          </div>
        </div>
      )}

      <ul
        className={`space-y-2 sm:space-y-4 transition-all duration-300 overflow-hidden ${
          isOpen ? 'max-h-none' : 'max-h-0'
        }`}
      >
        {seriesNovels.map((novel) => {
          const volume = resolveSeriesVolume(series, novel);
          const volumeLabel = volume
            ? getVolumeDisplayLabel(volume)
            : novel.volumeNumber ? `${novel.volumeNumber}권` : '권 미지정';
          return (
            <NovelCard
              key={novel.id}
              novel={novel}
              volumeLabel={volumeLabel}
              compact={isMobile}
              onSelect={() => onSelectNovel(novel.id)}
              onDuplicate={() => onDuplicateNovel(novel.id)}
              onDelete={() => onDeleteNovel(novel)}
              onExport={(format) => onExportNovel(novel, format)}
            />
          );
        })}
      </ul>

      {isGuideOpen && (
        <SeriesWorkflowGuideModal onClose={() => setIsGuideOpen(false)} />
      )}
    </div>
  );
});

/**
 * ============================================================
 * @module modules/novel
 * @file NovelList.tsx
 * ============================================================
 * @description 소설 목록 페이지 컴포넌트 (원본 스타일)
 * ============================================================
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Novel, Series, AiAuthor } from '@core/types';
import { useLocalStorage, usePwaInstall } from '@shared/hooks';
import {
  BookOpenIcon,
  ChatBubbleThoughtIcon,
  PlusIcon,
  UserGroupIcon,
  InformationCircleIcon,
  WandSparklesIcon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  KeyIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  Modal,
  StudioGuideModal,
  ApiKeyModal,
  toast,
} from '@shared/components';

/** 필터 타입 */
type FilterType = 'all' | 'ongoing' | 'completed';

/** 정렬 타입 */
type SortType = 'recent' | 'name' | 'length';
import { useIsApiKeyConfigured } from '@stores/settingsStore';
import { getCurrentApiInfo } from '@services/ai';
import { WorkspaceSwitcher } from '@modules/workspace';
import {
  NovelCard,
  SeriesCard,
  CreateWorkModal,
  DeleteNovelModal,
  SeriesMemoryModal,
  IncorporateToSeriesModal,
  TranslateNovelModal,
  SeriesArchitectModal,
  type CreateNovelData,
  type CreateSeriesData,
  type IncorporateTarget,
} from './components';

export interface NovelListProps {
  novels: Novel[];
  series: Series[];
  authors: AiAuthor[];
  onSelectNovel: (id: string) => void;
  onCreateNovel: (data: CreateNovelData) => void;
  onCreateSeries: (data: CreateSeriesData) => void;
  onCreateNextVolume: (seriesId: string) => void;
  onDeleteNovel: (id: string) => void;
  onDuplicateNovel: (id: string) => void;
  onImportNovel: (novel: Novel) => void;
  onManageAuthors: () => void;
  onOpenCharacterChat: () => void;
  onStartManuscriptAnalysis: () => void;
  onExportStudio: (scope: string | 'all') => void;
  onImportStudioFile: (
    event: React.ChangeEvent<HTMLInputElement>,
    targetWorkspaceId: string | 'new',
  ) => void;
  onOpenProductionPackage: () => void;
  onUpdateSeries: (series: Series) => void;
  onDeleteSeries: (seriesId: string) => void;
  onIncorporateToSeries?: (novelId: string, target: IncorporateTarget) => void;
}

export function NovelList({
  novels,
  series,
  authors,
  onSelectNovel,
  onCreateNovel,
  onCreateSeries,
  onCreateNextVolume,
  onDeleteNovel,
  onDuplicateNovel,
  onImportNovel,
  onManageAuthors,
  onOpenCharacterChat,
  onStartManuscriptAnalysis,
  onExportStudio,
  onImportStudioFile,
  onOpenProductionPackage,
  onUpdateSeries,
  onDeleteSeries,
  onIncorporateToSeries,
}: NovelListProps) {
  const [isCreateModalOpen, setCreateModalOpen] = useState(false);
  const [isGuideModalOpen, setGuideModalOpen] = useState(false);
  const [isInstallHelpOpen, setInstallHelpOpen] = useState(false);
  const [isApiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [novelToDelete, setNovelToDelete] = useState<Novel | null>(null);
  const [novelToIncorporate, setNovelToIncorporate] = useState<Novel | null>(null);
  const [seriesMemoryToEdit, setSeriesMemoryToEdit] = useState<Series | null>(null);
  const [seriesArchitectToEdit, setSeriesArchitectToEdit] = useState<Series | null>(null);
  const [openSeriesId, setOpenSeriesId] = useLocalStorage<string | null>('openSeriesId', null);
  const [novelToTranslate, setNovelToTranslate] = useState<Novel | null>(null);

  // 검색/필터/정렬 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useLocalStorage<FilterType>('novelFilter', 'all');
  const [sortBy, setSortBy] = useLocalStorage<SortType>('novelSort', 'recent');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // 최적화된 셀렉터 사용
  const isApiKeyConfigured = useIsApiKeyConfigured();
  const { canInstall, isInstalled, install } = usePwaInstall();

  const importFileRef = useRef<HTMLInputElement>(null);
  const ideaImportFileRef = useRef<HTMLInputElement>(null);

  // 정렬 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 현재 AI 정보
  const currentApiInfo = getCurrentApiInfo();

  const handleInstallApp = useCallback(async () => {
    if (!canInstall) {
      setInstallHelpOpen(true);
      return;
    }
    const outcome = await install();
    if (outcome === 'accepted') toast.success('진폭 STIDO 앱을 설치했습니다.');
  }, [canInstall, install]);

  // 시리즈별 소설 맵 (O(1) 조회용) - js-index-maps 규칙 적용
  const novelsBySeriesMap = useMemo(() => {
    const map = new Map<string, Novel[]>();
    for (const novel of novels) {
      if (novel.seriesId) {
        const existing = map.get(novel.seriesId);
        if (existing) {
          existing.push(novel);
        } else {
          map.set(novel.seriesId, [novel]);
        }
      }
    }
    return map;
  }, [novels]);

  // 독립 소설 (시리즈에 속하지 않은)
  const standaloneNovels = useMemo(
    () => novels.filter((n) => !n.seriesId),
    [novels]
  );

  // 검색/필터/정렬 적용된 독립 소설
  const filteredNovels = useMemo(() => {
    let result = standaloneNovels;

    // 검색 필터
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          (n.plotSummary?.toLowerCase().includes(query)) ||
          (n.subject?.toLowerCase().includes(query))
      );
    }

    // 상태 필터 (완결 여부는 isCompleted 필드 또는 chapters 기준)
    if (filter === 'completed') {
      result = result.filter((n) => (n as any).isCompleted === true);
    } else if (filter === 'ongoing') {
      result = result.filter((n) => !(n as any).isCompleted);
    }

    // 정렬
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.title.localeCompare(b.title, 'ko');
        case 'length':
          const aLen = a.chapters.reduce((sum, ch) => sum + ch.content.length, 0);
          const bLen = b.chapters.reduce((sum, ch) => sum + ch.content.length, 0);
          return bLen - aLen;
        case 'recent':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [standaloneNovels, searchQuery, filter, sortBy]);

  // 모바일 감지 (반응형)
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile(); // 초기 체크
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  /** 아이디어 작업대에서 가져오기 */
  const handleIdeaImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const result = e.target?.result;
            if (typeof result === 'string') {
              const imported = JSON.parse(result);
              if (imported._source === 'idea-workbench' && imported.title) {
                // Clean up internal markers
                const { _source, _version, ...novelData } = imported;
                const novel: Novel = {
                  ...novelData,
                  id: crypto.randomUUID(),
                  chapters: novelData.chapters || [],
                  history: novelData.history || [],
                  characters: novelData.characters || [],
                  createdAt: Date.now(),
                  aiAuthorId: novelData.aiAuthorId || null,
                  targetedGenerationEnabled: novelData.targetedGenerationEnabled !== false,
                  chapterGenerationMode: novelData.chapterGenerationMode ?? 'single',
                  chapterTargetCharacters: novelData.chapterTargetCharacters ?? 6000,
                  maxTokens: novelData.maxTokens ?? 16384,
                };
                onImportNovel(novel);
                toast.success(`"${novel.title}" — 아이디어 작업대에서 가져왔습니다!`);
              } else {
                toast.error('아이디어 작업대 형식이 아닙니다. (.stido.json 파일을 선택해주세요)');
              }
            }
          } catch (error) {
            console.error('아이디어 작업대 가져오기 실패:', error);
            toast.error('파일을 분석하는 데 실패했습니다.');
          }
        };
        reader.readAsText(file);
        event.target.value = '';
      }
    },
    [onImportNovel]
  );

  /** 개별 소설 파일 가져오기 */
  const handleFileImport = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const result = e.target?.result;
            if (typeof result === 'string') {
              const imported = JSON.parse(result) as Novel;
              if (imported.id && imported.title && imported.chapters) {
                // 버전 호환성을 위한 마이그레이션
                const migrated: Novel = {
                  ...imported,
                  targetChapterCount: imported.targetChapterCount ?? undefined,
                  preventAutoEnding: imported.preventAutoEnding ?? false,
                  targetedGenerationEnabled: imported.targetedGenerationEnabled !== false,
                  chapterGenerationMode: imported.chapterGenerationMode ?? 'single',
                  chapterTargetCharacters: imported.chapterTargetCharacters ?? 6000,
                  maxTokens: imported.maxTokens ?? 16384,
                  foreshadowingSystem: imported.foreshadowingSystem ?? undefined,
                  webnovelSettings: imported.webnovelSettings ?? undefined,
                  openingStyle: imported.openingStyle ?? undefined,
                  startingPoint: imported.startingPoint ?? undefined,
                };
                onImportNovel(migrated);
              } else {
                toast.error('유효하지 않은 소설 파일 형식입니다.');
              }
            }
          } catch (error) {
            console.error('소설 불러오기 실패:', error);
            toast.error('소설 파일을 분석하는 데 실패했습니다.');
          }
        };
        reader.onerror = () => {
          toast.error('파일을 읽는 중 오류가 발생했습니다.');
        };
        reader.readAsText(file);
        event.target.value = '';
      }
    },
    [onImportNovel]
  );

  /** 안전한 파일 다운로드 (file-saver 패턴) */
  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    // dispatchEvent가 link.click()보다 크로스 브라우저 호환성이 높음
    a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view: window }));
    // 충분한 시간 후 정리
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 40000);
  }, []);

  /** 소설 내보내기 */
  const handleExportNovel = useCallback((novel: Novel, format: 'json' | 'txt') => {
    try {
      const safeTitle = novel.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled';
      let blob: Blob;
      let ext: string;

      if (format === 'json') {
        const data = JSON.stringify(novel, null, 2);
        blob = new Blob([data], { type: 'application/json;charset=utf-8' });
        ext = 'json';
      } else {
        let txt = `제목: ${novel.title}\n\n========================================\n\n`;
        novel.chapters.forEach((ch) => {
          txt += `${ch.title}\n\n${ch.content}\n\n----------------------------------------\n\n`;
        });
        blob = new Blob(['\uFEFF' + txt], { type: 'text/plain;charset=utf-8' });
        ext = 'txt';
      }

      triggerDownload(blob, `${safeTitle}.${ext}`);
      toast.success(`"${novel.title}" ${format.toUpperCase()} 내보내기 완료`);
    } catch (error) {
      console.error('소설 내보내기 실패:', error);
      toast.error('소설을 내보내는 데 실패했습니다.');
    }
  }, [triggerDownload]);

  /** 시리즈 내보내기 */
  const handleExportSeries = useCallback(
    (seriesData: Series) => {
      try {
        const safeTitle = seriesData.title.replace(/[\\/:*?"<>|]/g, '_').trim() || 'untitled_series';
        let txt = `시리즈: ${seriesData.title}\n시리즈 총괄 설계도: ${seriesData.seriesPlotSummary}\n\n========================================\n\n`;

        seriesData.novelIds.forEach((novelId, index) => {
          const novel = novels.find((n) => n.id === novelId);
          if (novel) {
            txt += `[${index + 1}권] ${novel.title}\n권별 설계도: ${novel.plotSummary}\n\n----------------------------------------\n\n`;
            novel.chapters.forEach((ch) => {
              txt += `${ch.title}\n\n${ch.content}\n\n----------------------------------------\n\n`;
            });
          }
        });

        const blob = new Blob(['\uFEFF' + txt], { type: 'text/plain;charset=utf-8' });
        triggerDownload(blob, `${safeTitle}_series.txt`);
        toast.success(`"${seriesData.title}" 시리즈 내보내기 완료`);
      } catch (error) {
        console.error('시리즈 내보내기 실패:', error);
        toast.error('시리즈를 내보내는 데 실패했습니다.');
      }
    },
    [novels, triggerDownload]
  );

  /** 삭제 확정 */
  const confirmDelete = useCallback(() => {
    if (novelToDelete) {
      onDeleteNovel(novelToDelete.id);
      setNovelToDelete(null);
    }
  }, [novelToDelete, onDeleteNovel]);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
      {/* 숨겨진 파일 입력 */}
      <input
        type="file"
        accept=".json"
        ref={importFileRef}
        onChange={handleFileImport}
        className="hidden"
      />
      <input
        type="file"
        ref={ideaImportFileRef}
        className="hidden"
        accept=".json"
        onChange={handleIdeaImport}
      />

      {/* 헤더 */}
      <header className="w-full max-w-5xl mb-6">
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 flex items-center justify-center">
              <BookOpenIcon className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white leading-tight">AI 소설가 스튜디오</h1>
              <p className="text-xs text-gray-500">소설 창작을 위한 크리에이티브 파트너</p>
            </div>
          </div>

          {/* 현재 AI 엔진 표시 */}
          {isApiKeyConfigured && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline">AI 엔진:</span>
              <div className="flex bg-gray-800 rounded-lg p-1 gap-1">
                <div className="px-2.5 py-1.5 rounded-md text-xs font-semibold bg-blue-600 text-white shadow-lg shadow-blue-500/30">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-pulse" />
                  <span className="hidden sm:inline">Gemini</span>
                  <span className="sm:hidden">G</span>
                </span>
                </div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded hidden sm:inline bg-blue-900/50 text-blue-300">
              {currentApiInfo.model}
            </span>
            </div>
          )}
        </div>
        <WorkspaceSwitcher
          onExportStudio={onExportStudio}
          onImportStudioFile={onImportStudioFile}
          onOpenProductionPackage={onOpenProductionPackage}
        />
      </header>

      <div className="w-full max-w-5xl flex-grow">
        {/* 제목 및 액션 버튼 */}
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-3 pt-2 border-t border-gray-800">
          <h2 className="text-xl font-bold text-gray-200">내 서재</h2>
          <div className="flex gap-2 flex-wrap justify-center">
            {!isInstalled && (
              <button
                type="button"
                onClick={() => void handleInstallApp()}
                className={`flex items-center font-bold py-2 px-3 sm:px-4 rounded-lg transition-colors text-sm sm:text-base ${
                  canInstall
                    ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                }`}
                data-testid="pwa-install-button"
              >
                <ArrowDownTrayIcon className="w-5 h-5 mr-1 sm:mr-2" />
                <span className="text-xs sm:text-base">앱 설치</span>
              </button>
            )}
            <button
              onClick={onOpenCharacterChat}
              className="flex items-center bg-rose-600 hover:bg-rose-500 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-colors text-sm sm:text-base"
            >
              <ChatBubbleThoughtIcon className="w-5 h-5 mr-1 sm:mr-2" />
              <span className="text-xs sm:text-base">캐릭터챗</span>
            </button>
            <button
              onClick={() => setGuideModalOpen(true)}
              className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-colors text-sm sm:text-base"
            >
              <InformationCircleIcon className="w-5 h-5 mr-1 sm:mr-2" />
              <span className="sm:hidden text-xs">안내</span>
              <span className="hidden sm:inline">스튜디오 안내</span>
            </button>
            <button
              onClick={onManageAuthors}
              className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-colors text-sm sm:text-base"
            >
              <UserGroupIcon className="w-5 h-5 mr-1 sm:mr-2" />
              <span className="sm:hidden text-xs">작가</span>
              <span className="hidden sm:inline">AI 작가 관리</span>
            </button>
            <button
              onClick={onStartManuscriptAnalysis}
              className="flex items-center bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-colors text-sm sm:text-base"
            >
              <WandSparklesIcon className="w-5 h-5 mr-1 sm:mr-2" />
              <span className="sm:hidden text-xs">이어쓰기</span>
              <span className="hidden sm:inline">외부 소설 이어쓰기</span>
            </button>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="flex items-center bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 sm:px-4 rounded-lg transition-colors text-sm sm:text-base"
            >
              <PlusIcon className="w-5 h-5 mr-1 sm:mr-2" />
              <span className="sm:hidden text-xs">새 작품</span>
              <span className="hidden sm:inline">새 작품</span>
            </button>
          </div>
        </div>

        {/* API 키 미설정 배너 (작품이 있을 때) */}
        {!isApiKeyConfigured && (novels.length > 0 || series.length > 0) && (
          <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 flex items-center gap-3">
            <KeyIcon className="w-4 h-4 text-yellow-400 flex-shrink-0" />
            <p className="text-sm text-yellow-400/80 flex-grow">AI 기능을 사용하려면 API 키를 설정해주세요.</p>
            <button
              onClick={() => setApiKeyModalOpen(true)}
              className="text-sm text-yellow-300 hover:text-yellow-200 font-semibold flex-shrink-0 transition-colors"
            >
              설정 →
            </button>
          </div>
        )}

        {/* 검색/필터/정렬 바 */}
        <div className="mb-6 space-y-3">
          {/* 검색바 + 정렬 */}
          <div className="flex gap-2">
            <div className="flex-grow relative">
              <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="소설 검색..."
                className="w-full pl-10 pr-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="relative" ref={sortMenuRef}>
              <button
                onClick={() => setShowSortMenu(!showSortMenu)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-700 transition-colors"
              >
                <FunnelIcon className="w-5 h-5" />
                <span className="hidden sm:inline">
                  {sortBy === 'recent' ? '최신순' : sortBy === 'name' ? '이름순' : '글자수'}
                </span>
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-20 py-1">
                  {[
                    { value: 'recent', label: '최신순' },
                    { value: 'name', label: '이름순' },
                    { value: 'length', label: '글자수' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value as SortType); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        sortBy === opt.value
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-300 hover:bg-gray-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* 필터 탭 */}
          <div className="flex gap-2">
            {[
              { value: 'all', label: '전체' },
              { value: 'ongoing', label: '연재중' },
              { value: 'completed', label: '완결' },
            ].map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value as FilterType)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === tab.value
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {tab.label}
                {tab.value === 'all' && ` (${standaloneNovels.length})`}
              </button>
            ))}
          </div>
        </div>

        {/* 시리즈 목록 */}
        <div className="space-y-8">
          {series.map((s) => (
            <SeriesCard
              key={s.id}
              series={s}
              novelsInSeries={novelsBySeriesMap.get(s.id) || []}
              isOpen={openSeriesId === s.id}
              onToggle={() => setOpenSeriesId(openSeriesId === s.id ? null : s.id)}
              onSelectNovel={onSelectNovel}
              onDuplicateNovel={onDuplicateNovel}
              onDeleteNovel={setNovelToDelete}
              onExportNovel={handleExportNovel}
              onExportSeries={() => handleExportSeries(s)}
              onOpenMemory={() => setSeriesMemoryToEdit(s)}
              onOpenArchitect={() => setSeriesArchitectToEdit(s)}
              onCreateNextVolume={() => {
                setOpenSeriesId(s.id);
                onCreateNextVolume(s.id);
              }}
              onDeleteSeries={() => onDeleteSeries(s.id)}
            />
          ))}

          {/* 독립 소설 목록 */}
          {filteredNovels.length > 0 && (
            <div className="bg-gray-800 shadow-lg rounded-lg p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg sm:text-xl font-bold text-gray-300">
                  단편 / 독립 소설
                </h3>
                {searchQuery && (
                  <span className="text-sm text-gray-500">
                    {filteredNovels.length}개 검색됨
                  </span>
                )}
              </div>
              <ul className="space-y-2 sm:space-y-4">
                {filteredNovels.map((novel) => (
                  <NovelCard
                    key={novel.id}
                    novel={novel}
                    compact={isMobile}
                    onSelect={() => onSelectNovel(novel.id)}
                    onDuplicate={() => onDuplicateNovel(novel.id)}
                    onDelete={() => setNovelToDelete(novel)}
                    onExport={(format) => handleExportNovel(novel, format)}
                    onIncorporateToSeries={() => setNovelToIncorporate(novel)}
                    onTranslate={() => setNovelToTranslate(novel)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* 검색 결과 없음 */}
          {searchQuery && filteredNovels.length === 0 && standaloneNovels.length > 0 && (
            <div className="text-center py-8 bg-gray-800 rounded-lg">
              <MagnifyingGlassIcon className="w-12 h-12 mx-auto text-gray-600 mb-3" />
              <p className="text-gray-400">"{searchQuery}" 검색 결과가 없습니다</p>
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-indigo-400 hover:text-indigo-300 text-sm"
              >
                검색어 지우기
              </button>
            </div>
          )}
        </div>

        {/* 빈 상태 - 온보딩 */}
        {novels.length === 0 && series.length === 0 && (
          <div className="py-8">
            {/* 메인 CTA */}
            <div className="text-center py-12 bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl border border-gray-700 mb-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-indigo-600/20 flex items-center justify-center">
                <BookOpenIcon className="w-10 h-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">첫 작품을 시작해보세요</h3>
              <p className="text-gray-400 mb-6 max-w-md mx-auto">
                AI와 함께 소설을 쓰고, 캐릭터를 만들고, 시리즈를 관리하세요.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
              >
                <PlusIcon className="w-5 h-5" />
                새 작품 만들기
              </button>
            </div>

            {/* 기능 카드 */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="w-10 h-10 rounded-lg bg-blue-600/20 flex items-center justify-center mb-3">
                  <WandSparklesIcon className="w-5 h-5 text-blue-400" />
                </div>
                <h4 className="font-semibold text-white mb-1">AI 공동 집필</h4>
                <p className="text-sm text-gray-400">Gemini 직접 집필과 Codex 브리지로 소설을 함께 써보세요.</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center mb-3">
                  <UserGroupIcon className="w-5 h-5 text-purple-400" />
                </div>
                <h4 className="font-semibold text-white mb-1">AI 작가 시스템</h4>
                <p className="text-sm text-gray-400">개성 있는 AI 작가를 만들고, 각자의 문체와 성격으로 집필할 수 있어요.</p>
              </div>
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <div className="w-10 h-10 rounded-lg bg-teal-600/20 flex items-center justify-center mb-3">
                  <BookOpenIcon className="w-5 h-5 text-teal-400" />
                </div>
                <h4 className="font-semibold text-white mb-1">시리즈 & 세계관</h4>
                <p className="text-sm text-gray-400">다권 시리즈를 관리하고, 일관된 세계관을 유지하며 집필하세요.</p>
              </div>
            </div>

            {/* API 키 미설정 안내 */}
            {!isApiKeyConfigured && (
              <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                  <KeyIcon className="w-5 h-5 text-yellow-400" />
                </div>
                <div className="flex-grow">
                  <h4 className="font-semibold text-yellow-300 mb-0.5">API 키를 먼저 설정해주세요</h4>
                  <p className="text-sm text-yellow-400/80">앱에서 직접 집필하려면 Gemini API 키를 설정해주세요. Codex 브리지는 별도로 준비되어 있습니다.</p>
                </div>
                <button
                  onClick={() => setApiKeyModalOpen(true)}
                  className="flex-shrink-0 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 font-semibold py-2 px-5 rounded-lg transition-colors border border-yellow-500/30"
                >
                  API 설정하기
                </button>
              </div>
            )}
          </div>
        )}

        {/* 하단 유틸리티 */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 border-t border-gray-700 pt-6 text-center text-sm">
          <button
            onClick={() => setApiKeyModalOpen(true)}
            className={`flex items-center gap-2 transition-colors ${
              isApiKeyConfigured
                ? 'text-green-400 hover:text-green-300'
                : 'text-yellow-400 hover:text-yellow-300'
            }`}
          >
            <KeyIcon className="w-4 h-4" />
            API 설정 {isApiKeyConfigured ? '✓' : '!'}
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={() => importFileRef.current?.click()}
            className="text-gray-400 hover:text-white underline transition-colors"
          >
            개별 소설 파일 가져오기
          </button>
          <span className="text-gray-600">|</span>
          <button
            onClick={() => ideaImportFileRef.current?.click()}
            className="flex items-center gap-2 text-indigo-400 hover:text-indigo-300 transition-colors font-semibold"
          >
            <ArrowUpTrayIcon className="w-4 h-4" />
            아이디어 작업대에서 가져오기
          </button>
        </div>
      </div>

      {/* 푸터 */}
      <footer className="w-full max-w-5xl text-center text-gray-500 text-xs mt-10 pb-4">
        <p>
          진폭프로젝트 - 공동 개발자: 리듬-상호 & 진폭
        </p>
      </footer>

      {/* 모달들 */}
      {isCreateModalOpen && (
        <CreateWorkModal
          authors={authors}
          onClose={() => setCreateModalOpen(false)}
          onCreateNovel={onCreateNovel}
          onCreateSeries={onCreateSeries}
        />
      )}

      {novelToDelete && (
        <DeleteNovelModal
          novelTitle={novelToDelete.title}
          onClose={() => setNovelToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}

      {isGuideModalOpen && (
        <StudioGuideModal onClose={() => setGuideModalOpen(false)} />
      )}

      {isInstallHelpOpen && (
        <Modal
          isOpen
          onClose={() => setInstallHelpOpen(false)}
          title="진폭 STIDO 앱 설치"
          size="sm"
        >
          <div className="space-y-4 text-sm text-gray-300">
            <p>
              이 브라우저에서는 설치창을 직접 열 수 없어요. 같은 주소를 Chrome 또는 Edge에서 열어주세요.
            </p>
            <div className="rounded-md border border-gray-700 bg-gray-900/60 p-3 text-gray-400">
              <p>PC·Android: 브라우저 메뉴의 앱 설치 또는 홈 화면에 추가</p>
              <p className="mt-2">iPhone·iPad: Safari 공유 메뉴의 홈 화면에 추가</p>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setInstallHelpOpen(false)}
                className="rounded-md bg-indigo-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-indigo-500"
              >
                확인
              </button>
            </div>
          </div>
        </Modal>
      )}

      {isApiKeyModalOpen && (
        <ApiKeyModal onClose={() => setApiKeyModalOpen(false)} />
      )}

      {seriesMemoryToEdit && (
        <SeriesMemoryModal
          series={seriesMemoryToEdit}
          novelsInSeries={novelsBySeriesMap.get(seriesMemoryToEdit.id) || []}
          onClose={() => setSeriesMemoryToEdit(null)}
          onUpdateSeries={onUpdateSeries}
        />
      )}

      {novelToIncorporate && (
        <IncorporateToSeriesModal
          novel={novelToIncorporate}
          seriesList={series}
          onClose={() => setNovelToIncorporate(null)}
          onConfirm={(target) => {
            if (onIncorporateToSeries) {
              onIncorporateToSeries(novelToIncorporate.id, target);
            }
            setNovelToIncorporate(null);
          }}
        />
      )}

      {novelToTranslate && (
        <TranslateNovelModal
          novel={novelToTranslate}
          isOpen={true}
          onClose={() => setNovelToTranslate(null)}
          onTranslated={(translatedNovel) => {
            onImportNovel(translatedNovel);
            setNovelToTranslate(null);
          }}
        />
      )}

      {seriesArchitectToEdit && (
        <SeriesArchitectModal
          series={seriesArchitectToEdit}
          novelsInSeries={novelsBySeriesMap.get(seriesArchitectToEdit.id) || []}
          onClose={() => setSeriesArchitectToEdit(null)}
          onUpdateSeries={async (updatedSeries) => {
            await onUpdateSeries(updatedSeries);
            setSeriesArchitectToEdit(updatedSeries);
          }}
        />
      )}
    </div>
  );
}

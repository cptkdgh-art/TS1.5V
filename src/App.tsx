/**
 * ============================================================
 * @file App.tsx
 * @description 진폭 STIDO 메인 앱 컴포넌트
 * ============================================================
 *
 * 이 파일은 라우팅과 전역 상태 관리를 담당합니다.
 * 모든 기능은 @modules와 @pages에서 처리합니다.
 *
 * ============================================================
 */

import { lazy, Suspense, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
  Novel,
  Series,
  AiAuthor,
} from '@core/types';
import { useNovelStore } from '@stores/novelStore';
import { useSeriesStore } from '@stores/seriesStore';
import { useAuthorStore } from '@stores/authorStore';
import { useSettingsStore } from '@stores/settingsStore';
import { useCharacterChatStore } from '@stores/characterChatStore';
import { useDirectorClioStore } from '@stores/directorClioStore';
import { useWorkspaceStore } from '@stores/workspaceStore';
import { getWorkspaceGeneration, subscribeWorkspaceChanges } from '@services/storage/workspaceCoordination';
import {
  ALL_WORKSPACES_BACKUP_KIND,
  createAllWorkspacesBackup,
  createSingleWorkspaceBackup,
  parseAllWorkspacesBackup,
  parseWorkspaceBackupContent,
  writeWorkspaceBackupContent,
} from '@services/studio-backup';
import { NovelList, type CreateNovelData, type CreateSeriesData } from '@modules/novel';
import { AuthorManager } from '@modules/author';
import { NovelEditor } from '@modules/editor';
import {
  bindNovelToSeriesVolume,
  createVolumeBlueprint,
  detachNovelFromSeries,
  ensureSeriesVolumeIds,
  reconcileSeriesVolumeBindings,
  removeNovelReferencesFromSeries,
} from '@services/novel';
import { ManuscriptAnalysisLab } from '@modules/manuscript';
import { OAuthCallback } from '@modules/settings/components/OAuthCallback';
import { useToast, setGlobalToast, useConfirmDialog } from '@shared/components';

const CharacterChatApp = lazy(() => import('@modules/character-chat').then((module) => ({
  default: module.CharacterChatApp,
})));
const ProductionPackageCenterModal = lazy(() => import('@modules/production-package').then((module) => ({
  default: module.ProductionPackageCenterModal,
})));

type AppView = 'home' | 'authors' | 'editor' | 'manuscript' | 'character-chat';

function App() {
  // OAuth 콜백 페이지 처리 (팝업에서 열림)
  if (window.location.pathname === '/oauth/callback') {
    return <OAuthCallback />;
  }

  return <MainApp />;
}

function MainApp() {
  const [view, setView] = useState<AppView>('home');
  const [isProductionPackageOpen, setProductionPackageOpen] = useState(false);
  const [selectedNovelId, setSelectedNovelId] = useState<string | null>(null);
  const isReconcilingSeriesRef = useRef(false);
  const confirm = useConfirmDialog();

  const {
    activeWorkspace,
    isLoading: workspaceLoading,
    initialize: initializeWorkspace,
    workspaces,
    createWorkspace,
  } = useWorkspaceStore();
  const workspaceGeneration = getWorkspaceGeneration(activeWorkspace?.id ?? 'workspace-default');

  useEffect(() => subscribeWorkspaceChanges((change) => {
    if (!change.external || change.workspaceId !== activeWorkspace?.id || change.kind === 'updated') return;
    void confirm({
      title: '다른 창에서 작업실이 변경됐어요',
      message: '이 작업실이 복원되거나 삭제됐어요. 이전 화면의 저장은 차단됩니다. 필요한 미저장 내용은 확인한 뒤 작업실을 다시 열어 주세요.',
      confirmText: '작업실 다시 열기',
    }).then((approved) => {
      if (!approved) return;
      if (change.kind === 'deleted') window.location.assign('/');
      else window.location.reload();
    });
  }), [activeWorkspace?.id, confirm]);

  // Individual stores
  const {
    novels,
    isLoading: novelsLoading,
    loadNovels,
    addNovel,
    updateNovel,
    mutateNovel,
    deleteNovel,
    getNovelById,
  } = useNovelStore();

  const {
    seriesList: series,
    isLoading: seriesLoading,
    loadSeries,
    addSeries,
    updateSeries,
    deleteSeries,
    getSeriesById,
  } = useSeriesStore();

  const {
    authors,
    isLoading: authorsLoading,
    loadAuthors,
    addAuthor,
    setAuthors,
  } = useAuthorStore();

  const {
    isLoading: settingsLoading,
    loadSettings,
  } = useSettingsStore();

  const {
    isLoading: characterChatLoading,
    load: loadCharacterChat,
  } = useCharacterChatStore();

  const {
    isLoading: directorClioLoading,
    load: loadDirectorClio,
    migrateLegacySession,
  } = useDirectorClioStore();

  const { addToast } = useToast();

  const isLoading = novelsLoading
    || seriesLoading
    || authorsLoading
    || settingsLoading
    || characterChatLoading
    || directorClioLoading
    || workspaceLoading;

  // 전역 toast 연결
  useEffect(() => {
    setGlobalToast(addToast);
  }, [addToast]);

  // 작업실 저장 경계를 먼저 확정한 뒤 해당 작업실 데이터만 불러온다.
  useEffect(() => {
    void (async () => {
      await initializeWorkspace();
      await Promise.all([
        loadNovels(),
        loadSeries(),
        loadAuthors(),
        loadSettings(),
        loadCharacterChat(),
        loadDirectorClio(),
      ]);
    })();
  }, [
    initializeWorkspace,
    loadNovels,
    loadSeries,
    loadAuthors,
    loadSettings,
    loadCharacterChat,
    loadDirectorClio,
  ]);

  useEffect(() => {
    if (!activeWorkspace) return;
    document.title = `${activeWorkspace.slot} · ${activeWorkspace.name} | 진폭 STIDO`;
  }, [activeWorkspace]);

  useEffect(() => {
    if (authorsLoading || directorClioLoading) return;
    void migrateLegacySession(authors);
  }, [authors, authorsLoading, directorClioLoading, migrateLegacySession]);

  useEffect(() => {
    if (novelsLoading || seriesLoading || isReconcilingSeriesRef.current) return;
    const reconcile = async () => {
      isReconcilingSeriesRef.current = true;
      try {
        for (const currentSeries of series) {
          const result = reconcileSeriesVolumeBindings(currentSeries, novels);
          if (!result.changed) continue;
          if (JSON.stringify(result.series.blueprint) !== JSON.stringify(currentSeries.blueprint)) {
            await updateSeries(currentSeries.id, { blueprint: result.series.blueprint });
          }
          for (const nextNovel of result.novels) {
            const currentNovel = novels.find((item) => item.id === nextNovel.id);
            if (!currentNovel || currentNovel === nextNovel) continue;
            await updateNovel(nextNovel.id, {
              seriesVolumeId: nextNovel.seriesVolumeId,
              volumeNumber: nextNovel.volumeNumber,
              seriesVolumePlanSnapshot: nextNovel.seriesVolumePlanSnapshot,
            });
          }
        }
      } finally {
        isReconcilingSeriesRef.current = false;
      }
    };
    void reconcile();
  }, [novels, novelsLoading, series, seriesLoading, updateNovel, updateSeries]);

  // Novel handlers
  const handleSelectNovel = useCallback((id: string) => {
    setSelectedNovelId(id);
    setView('editor');
  }, []);

  const handleBackToHome = useCallback(() => {
    setSelectedNovelId(null);
    setView('home');
  }, []);

  const handleCreateNovel = useCallback((data: CreateNovelData) => {
    const now = Date.now();
    const newNovel: Novel = {
      id: crypto.randomUUID(),
      title: data.title,
      subject: data.subject || '',
      mood: data.mood || '',
      primaryGenre: data.primaryGenre || undefined,
      subgenres: data.subgenres,
      themes: data.themes,
      aiAuthorId: data.aiAuthorId,
      plotSummary: data.plotSummary || '',
      chapters: [],
      history: [],
      characters: [],
      useLorekeeper: true,
      targetedGenerationEnabled: true,
      chapterGenerationMode: 'single',
      chapterTargetCharacters: 6000,
      maxTokens: 16384,
      createdAt: now,
      // AI 생성 세계관이 있으면 worldviewFiles에 저장
      worldviewFiles: data.worldviewDraft
        ? [{ filename: '기본 세계관', content: data.worldviewDraft }]
        : [],
    };
    addNovel(newNovel);
  }, [addNovel]);

  const handleCreateSeries = useCallback(async (data: CreateSeriesData) => {
    const now = Date.now();
    const seriesId = crypto.randomUUID();
    const novelId = crypto.randomUUID();

    // Create first volume
    const firstVolume: Novel = {
      id: novelId,
      title: data.volume1.title,
      subject: data.volume1.subject || '',
      mood: data.volume1.mood || '',
      primaryGenre: data.volume1.primaryGenre || undefined,
      subgenres: data.volume1.subgenres,
      themes: data.volume1.themes,
      aiAuthorId: data.volume1.aiAuthorId,
      plotSummary: data.volume1.plotSummary || '',
      chapters: [],
      history: [],
      characters: [],
      useLorekeeper: true,
      targetedGenerationEnabled: true,
      chapterGenerationMode: 'single',
      chapterTargetCharacters: 6000,
      maxTokens: 16384,
      createdAt: now,
      seriesId: seriesId,
      volumeNumber: 1,
    };

    // Create series with novelIds already containing the first volume
    const newSeries: Series = {
      id: seriesId,
      title: data.seriesTitle,
      seriesPlotSummary: data.seriesPlotSummary || '',
      characters: [],
      novelIds: [novelId], // 시리즈 생성 시 첫 번째 소설 ID를 바로 포함
      createdAt: now,
      // AI 생성 세계관이 있으면 시리즈 공유 세계관으로 저장
      worldviewFiles: data.worldviewDraft
        ? [{ filename: '기본 세계관', content: data.worldviewDraft }]
        : [],
    };

    // 병렬 저장으로 시리즈 생성 속도 50% 향상
    await Promise.all([addSeries(newSeries), addNovel(firstVolume)]);
  }, [addSeries, addNovel]);

  const handleCreateNextVolume = useCallback(async (seriesId: string, requestedVolumeId?: string) => {
    const storedSeries = getSeriesById(seriesId);
    if (!storedSeries) return;
    let targetSeries = ensureSeriesVolumeIds(storedSeries);
    let targetVolume = targetSeries.blueprint?.volumes.find((volume) => volume.id === requestedVolumeId);
    if (targetVolume?.linkedNovelId) {
      addToast(`${targetVolume.displayLabel || `${targetVolume.volumeNumber}권`}에는 이미 작품이 연결되어 있습니다.`, 'warning');
      return;
    }
    targetVolume ??= targetSeries.blueprint?.volumes
      .filter((volume) => !volume.linkedNovelId)
      .sort((a, b) => a.volumeNumber - b.volumeNumber)[0];

    if (targetSeries.blueprint && !targetVolume) {
      const nextNumber = Math.max(0, ...targetSeries.blueprint.volumes.map((volume) => volume.volumeNumber)) + 1;
      targetVolume = createVolumeBlueprint(nextNumber);
      targetSeries = {
        ...targetSeries,
        blueprint: {
          ...targetSeries.blueprint,
          volumes: [...targetSeries.blueprint.volumes, targetVolume],
          lastUpdated: Date.now(),
        },
      };
    }

    const volumeNumber = targetVolume?.volumeNumber
      ?? Math.max(0, ...targetSeries.novelIds.map((id) => getNovelById(id)?.volumeNumber || 0)) + 1;
    const now = Date.now();
    const novelId = crypto.randomUUID();
    let newNovel: Novel = {
      id: novelId,
      title: targetVolume?.title?.trim() || `${targetSeries.title} ${volumeNumber}권`,
      subject: '',
      mood: '',
      aiAuthorId: null,
      plotSummary: '',
      chapters: [],
      history: [],
      characters: [],
      useLorekeeper: true,
      targetedGenerationEnabled: true,
      chapterGenerationMode: 'single',
      chapterTargetCharacters: 6000,
      maxTokens: 16384,
      createdAt: now,
      seriesId,
      volumeNumber,
    };
    if (targetVolume?.id) {
      const bound = bindNovelToSeriesVolume(targetSeries, newNovel, targetVolume.id);
      targetSeries = bound.series;
      newNovel = bound.novel;
    }
    await addNovel(newNovel);
    await updateSeries(seriesId, {
      novelIds: [...targetSeries.novelIds, novelId],
      blueprint: targetSeries.blueprint,
    });
  }, [addNovel, addToast, getNovelById, getSeriesById, updateSeries]);

  const handleDuplicateNovel = useCallback((id: string) => {
    const original = getNovelById(id);
    if (!original) return;

    const now = Date.now();
    // 깊은 복사로 원본과 완전히 분리된 복제본 생성
    const duplicate: Novel = {
      ...structuredClone(original),
      id: crypto.randomUUID(),
      title: `${original.title} (복제)`,
      createdAt: now,
      seriesId: undefined, // Remove series association for duplicates
      volumeNumber: undefined,
      seriesVolumeId: undefined,
      // 캐릭터들도 새 ID 부여
      characters: original.characters.map(char => ({
        ...char,
        id: crypto.randomUUID(),
      })),
    };
    addNovel(duplicate);
  }, [addNovel, getNovelById]);

  const handleImportNovel = useCallback((novel: Novel) => {
    const now = Date.now();
    const importedNovel: Novel = {
      ...novel,
      id: crypto.randomUUID(),
      createdAt: now,
      seriesId: undefined,
      volumeNumber: undefined,
      seriesVolumeId: undefined,
      useLorekeeper: novel.useLorekeeper !== false,
    };
    addNovel(importedNovel);
  }, [addNovel]);

  const handleUpdateNovel = useCallback(async (novel: Novel) => {
    await mutateNovel(novel.id, (current) => ({ ...current, ...novel, id: current.id }), workspaceGeneration);
  }, [mutateNovel, workspaceGeneration]);

  const handleMutateNovel = useCallback((id: string, updater: (current: Novel) => Novel): Promise<Novel | undefined> => {
    return mutateNovel(id, updater, workspaceGeneration);
  }, [mutateNovel, workspaceGeneration]);

  const handleDeleteNovel = useCallback(async (id: string) => {
    const targetNovel = getNovelById(id);
    if (targetNovel?.seriesId) {
      const ownerSeries = getSeriesById(targetNovel.seriesId);
      if (ownerSeries) {
        const cleanedSeries = removeNovelReferencesFromSeries(ownerSeries, id);
        await updateSeries(ownerSeries.id, {
          novelIds: cleanedSeries.novelIds,
          blueprint: cleanedSeries.blueprint,
        });
      }
    }
    await deleteNovel(id);
    if (selectedNovelId === id) {
      handleBackToHome();
    }
  }, [deleteNovel, getNovelById, getSeriesById, handleBackToHome, selectedNovelId, updateSeries]);

  const handleUpdateSeries = useCallback(async (updatedSeries: Series) => {
    const currentSeries = getSeriesById(updatedSeries.id);
    if (!currentSeries) return;
    const reconciled = reconcileSeriesVolumeBindings(updatedSeries, novels);
    const changedFields = Object.fromEntries(
      (Object.keys(reconciled.series) as Array<keyof Series>)
        .filter((key) => key !== 'id' && !Object.is(currentSeries[key], reconciled.series[key]))
        .map((key) => [key, reconciled.series[key]])
    ) as Partial<Series>;
    await updateSeries(updatedSeries.id, changedFields, workspaceGeneration);
    for (const nextNovel of reconciled.novels) {
      const currentNovel = novels.find((item) => item.id === nextNovel.id);
      if (!currentNovel || currentNovel === nextNovel) continue;
      await mutateNovel(nextNovel.id, (current) => ({
        ...current,
        seriesVolumeId: nextNovel.seriesVolumeId,
        volumeNumber: nextNovel.volumeNumber,
        seriesVolumePlanSnapshot: nextNovel.seriesVolumePlanSnapshot,
      }), workspaceGeneration);
    }
  }, [getSeriesById, novels, mutateNovel, updateSeries, workspaceGeneration]);

  const handleDetachNovelFromSeries = useCallback(async (novelId: string) => {
    const targetNovel = getNovelById(novelId);
    if (!targetNovel?.seriesId) return;
    const ownerSeries = getSeriesById(targetNovel.seriesId);
    if (!ownerSeries) return;

    const detachedNovel = detachNovelFromSeries(targetNovel, ownerSeries);
    const cleanedSeries = removeNovelReferencesFromSeries(ownerSeries, novelId);
    await updateNovel(novelId, detachedNovel);
    await updateSeries(ownerSeries.id, {
      novelIds: cleanedSeries.novelIds,
      blueprint: cleanedSeries.blueprint,
    });
    addToast('원고와 설정을 보존한 채 독립 작품으로 분리했습니다.', 'success');
  }, [addToast, getNovelById, getSeriesById, updateNovel, updateSeries]);

  /** 시리즈 삭제 (소속 소설들의 시리즈 참조 정리 포함) */
  const handleDeleteSeries = useCallback(async (seriesId: string) => {
    const targetSeries = getSeriesById(seriesId);
    if (!targetSeries) return;

    // 시리즈가 소유하던 공유 설정을 각 독립 작품으로 복사한 뒤 관계를 제거한다.
    for (const novelId of targetSeries.novelIds) {
      const novel = getNovelById(novelId);
      if (novel) {
        await updateNovel(novelId, detachNovelFromSeries(novel, targetSeries));
      }
    }

    // 시리즈 삭제
    await deleteSeries(seriesId);
    addToast('시리즈가 삭제되었습니다. 소속 소설들은 독립 소설로 변경되었습니다.', 'success');
  }, [getSeriesById, getNovelById, updateNovel, deleteSeries, addToast]);

  /** 독립 소설을 시리즈에 편입 */
  const handleIncorporateToSeries = useCallback(async (
    novelId: string,
    target: { type: 'existing'; seriesId: string; seriesVolumeId?: string } | { type: 'new'; seriesTitle: string; seriesPlot: string }
  ) => {
    const novelToMove = getNovelById(novelId);
    if (!novelToMove) return;

    // 이동할 캐릭터와 세계관 파일
    const charactersToMove = novelToMove.characters || [];
    const worldviewToMove = novelToMove.worldviewFiles || [];

    if (target.type === 'new') {
      // 새 시리즈 생성
      const newSeriesId = crypto.randomUUID();
      const newSeries: Series = {
        id: newSeriesId,
        title: target.seriesTitle,
        seriesPlotSummary: target.seriesPlot,
        characters: charactersToMove,
        worldviewFiles: worldviewToMove,
        novelIds: [novelId],
        createdAt: Date.now(),
      };
      await addSeries(newSeries);

      // 소설 업데이트: 시리즈에 편입되면 캐릭터/세계관은 시리즈로 이동
      await updateNovel(novelId, {
        seriesId: newSeriesId,
        volumeNumber: 1,
        characters: [],
        worldviewFiles: [],
      });
    } else {
      // 기존 시리즈에 추가
      const storedSeries = getSeriesById(target.seriesId);
      if (!storedSeries) return;
      let targetSeries = ensureSeriesVolumeIds(storedSeries);

      // 중복 캐릭터 제외
      const existingCharIds = new Set(targetSeries.characters.map(c => c.id));
      const newChars = charactersToMove.filter(c => !existingCharIds.has(c.id));

      // 중복 세계관 파일 제외
      const existingFileNames = new Set((targetSeries.worldviewFiles || []).map(f => f.filename));
      const newFiles = worldviewToMove.filter(f => !existingFileNames.has(f.filename));

      let movedNovel: Novel = {
        ...novelToMove,
        seriesId: target.seriesId,
        characters: [],
        worldviewFiles: [],
      };
      let targetVolume = targetSeries.blueprint?.volumes.find((volume) => volume.id === target.seriesVolumeId);
      targetVolume ??= targetSeries.blueprint?.volumes
        .filter((volume) => !volume.linkedNovelId)
        .sort((a, b) => a.volumeNumber - b.volumeNumber)[0];
      if (targetSeries.blueprint && !targetVolume) {
        const nextNumber = Math.max(0, ...targetSeries.blueprint.volumes.map((volume) => volume.volumeNumber)) + 1;
        targetVolume = createVolumeBlueprint(nextNumber);
        targetSeries = {
          ...targetSeries,
          blueprint: {
            ...targetSeries.blueprint,
            volumes: [...targetSeries.blueprint.volumes, targetVolume],
            lastUpdated: Date.now(),
          },
        };
      }
      if (targetVolume?.linkedNovelId) {
        addToast('선택한 권에는 이미 다른 작품이 연결되어 있습니다.', 'warning');
        return;
      }
      if (targetVolume?.id) {
        const bound = bindNovelToSeriesVolume(targetSeries, movedNovel, targetVolume.id);
        targetSeries = bound.series;
        movedNovel = bound.novel;
      } else {
        movedNovel.volumeNumber = Math.max(
          0,
          ...targetSeries.novelIds.map((id) => getNovelById(id)?.volumeNumber || 0),
        ) + 1;
      }

      await updateSeries(target.seriesId, {
        novelIds: [...targetSeries.novelIds, novelId],
        characters: [...targetSeries.characters, ...newChars],
        worldviewFiles: [...(targetSeries.worldviewFiles || []), ...newFiles],
        blueprint: targetSeries.blueprint,
      });
      await updateNovel(novelId, movedNovel);
    }
    addToast('선택한 권 계획에 작품을 편입했습니다.', 'success');
  }, [addSeries, addToast, getNovelById, getSeriesById, updateNovel, updateSeries]);

  // Author handlers
  const handleCreateAuthor = useCallback((details: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>): AiAuthor => {
    const newAuthor: AiAuthor = {
      ...details,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      metaChatHistory: [],
    };
    addAuthor(newAuthor);
    return newAuthor;
  }, [addAuthor]);

  const handleUpdateAuthors = useCallback((updatedAuthors: AiAuthor[]) => {
    // 간단하게 전체 교체
    setAuthors(updatedAuthors);
  }, [setAuthors]);

  // Export/Import handlers
  /** 안전한 파일 다운로드 (file-saver 패턴) */
  const triggerDownload = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view: window }));
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 40000);
  }, []);

  const handleExportStudio = useCallback(async (scope: string | 'all') => {
    try {
      const date = new Date().toISOString().split('T')[0];
      if (scope === 'all') {
        const backup = await createAllWorkspacesBackup(workspaces);
        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        triggerDownload(blob, `jinpok_stido_all_workspaces_${date}.json`);
        addToast(`모든 작업실 ${workspaces.length}개를 한 파일로 내보냈습니다.`, 'success');
        return;
      }

      const workspace = workspaces.find((item) => item.id === scope);
      if (!workspace) {
        addToast('내보낼 작업실을 찾지 못했습니다.', 'error');
        return;
      }
      const backup = await createSingleWorkspaceBackup(workspace);
      const safeName = workspace.name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'workspace';
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      triggerDownload(blob, `jinpok_stido_${workspace.slot}_${safeName}_${date}.json`);
      addToast(`${workspace.slot} · ${workspace.name} 백업 내보내기 완료`, 'success');
    } catch (error) {
      console.error('Export error:', error);
      addToast('백업 파일을 만드는 중 오류가 발생했습니다.', 'error');
    }
  }, [workspaces, triggerDownload, addToast]);

  const reloadActiveWorkspace = useCallback(async () => {
    await Promise.all([
      loadNovels(),
      loadSeries(),
      loadAuthors(),
      loadCharacterChat(),
      loadDirectorClio(),
    ]);
  }, [loadNovels, loadSeries, loadAuthors, loadCharacterChat, loadDirectorClio]);

  const handleImportStudioFile = useCallback((
    event: React.ChangeEvent<HTMLInputElement>,
    targetWorkspaceId: string | 'new',
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (loadEvent) => {
      try {
        const result = loadEvent.target?.result;
        if (typeof result !== 'string') {
          addToast('백업 파일을 읽지 못했습니다.', 'error');
          return;
        }

        const data = JSON.parse(result) as Record<string, unknown>;
        if (data.kind === ALL_WORKSPACES_BACKUP_KIND) {
          const fullBackup = parseAllWorkspacesBackup(data);
          if (!fullBackup) {
            addToast('전체 작업실 백업 형식이 손상되었습니다.', 'error');
            return;
          }

          const confirmed = await confirm({
            title: '모든 작업실 가져오기',
            message: (
              <div className="space-y-3">
                <p>
                  백업에 든 작업실 <strong className="text-white">{fullBackup.workspaces.length}개</strong>를
                  현재 작업실 뒤에 새 번호로 추가합니다.
                </p>
                <div className="max-h-44 overflow-y-auto rounded-md bg-gray-900/70 p-3 text-sm">
                  {fullBackup.workspaces.map((item) => (
                    <p key={item.workspace.id}>
                      {item.workspace.slot} · {item.workspace.name}
                      <span className="ml-2 text-gray-500">소설 {item.data.novels.length}개</span>
                    </p>
                  ))}
                </div>
                <p className="text-emerald-300">현재 작업실들은 덮어쓰거나 지우지 않습니다.</p>
              </div>
            ),
            confirmText: '새 작업실들로 추가',
          });
          if (!confirmed) return;

          for (const item of fullBackup.workspaces) {
            const workspace = await createWorkspace(item.workspace.name);
            await writeWorkspaceBackupContent(workspace.id, item.data);
          }
          addToast(`작업실 ${fullBackup.workspaces.length}개를 새 번호로 가져왔습니다.`, 'success');
          return;
        }

        const content = parseWorkspaceBackupContent(data);
        if (!content) {
          addToast('유효하지 않거나 손상된 작업실 백업 파일입니다.', 'error');
          return;
        }

        const sourceWorkspace = data.workspace as { name?: string; slot?: number } | undefined;
        const sourceName = sourceWorkspace?.name?.trim() || file.name.replace(/\.json$/i, '');
        const selectedTarget = targetWorkspaceId === 'new'
          ? null
          : workspaces.find((workspace) => workspace.id === targetWorkspaceId) ?? null;
        const destinationLabel = selectedTarget
          ? `${selectedTarget.slot} · ${selectedTarget.name}`
          : `새 작업실 · ${sourceName}`;

        const confirmed = await confirm({
          title: '작업실 백업 가져오기',
          message: (
            <div className="space-y-3">
              <p>
                <strong className="text-white">{sourceName}</strong> 백업을
                <strong className="ml-1 text-white">{destinationLabel}</strong>에 가져옵니다.
              </p>
              <div className="rounded-md bg-gray-900/70 p-3 text-sm">
                <p>소설: {content.novels.length}개</p>
                <p>AI 작가: {content.authors.length}개</p>
                <p>시리즈: {content.series.length}개</p>
                <p>
                  캐릭터챗: {content.characterChat
                    ? `${content.characterChat.personas.length}명 / 대화 ${content.characterChat.sessions.length}개`
                    : selectedTarget ? '구버전 백업 - 대상 작업실 자료 유지' : '없음'}
                </p>
                <p>
                  총괄감독 클리오: {content.directorClio
                    ? `상담 ${Object.keys(content.directorClio.sessions).length}개`
                    : selectedTarget ? '구버전 백업 - 대상 작업실 자료 유지' : '없음'}
                </p>
              </div>
              {selectedTarget && (
                <p className="text-red-300">
                  {destinationLabel}의 소설, 작가, 시리즈가 백업 내용으로 교체됩니다.
                </p>
              )}
            </div>
          ),
          confirmText: selectedTarget ? '선택한 작업실 덮어쓰기' : '새 작업실로 추가',
          variant: selectedTarget ? 'danger' : 'primary',
        });
        if (!confirmed) return;

        const destination = selectedTarget ?? await createWorkspace(sourceName);
        await writeWorkspaceBackupContent(destination.id, content);
        if (destination.id === activeWorkspace?.id) {
          await reloadActiveWorkspace();
        }
        addToast(`${destination.slot} · ${destination.name}에 백업을 가져왔습니다.`, 'success');
      } catch (error) {
        console.error('Import error:', error);
        addToast('파일을 불러오는 중 오류가 발생했습니다.', 'error');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  }, [
    activeWorkspace,
    workspaces,
    createWorkspace,
    reloadActiveWorkspace,
    addToast,
    confirm,
  ]);

  // Get selected novel and related data.
  // Derive directly from store arrays so editor updates immediately after chapter add/delete/save.
  const selectedNovel = selectedNovelId
    ? novels.find((novel) => novel.id === selectedNovelId) || null
    : null;

  const selectedSeries = selectedNovel?.seriesId
    ? series.find((item) => item.id === selectedNovel.seriesId) || null
    : null;

  const novelsInSeries = useMemo(() =>
    selectedSeries ? novels.filter((n: Novel) => selectedSeries.novelIds.includes(n.id)) : [],
    [selectedSeries, novels]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">데이터를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Editor view
  if (view === 'editor' && selectedNovel) {
    return (
      <NovelEditor
        novel={selectedNovel}
        series={selectedSeries}
        authors={authors}
        novelsInSeries={novelsInSeries}
        onUpdateNovel={handleUpdateNovel}
        onMutateNovel={handleMutateNovel}
        onUpdateSeries={handleUpdateSeries}
        onDetachNovelFromSeries={handleDetachNovelFromSeries}
        onBack={handleBackToHome}
        onDeleteNovel={handleDeleteNovel}
        onCreateAuthor={handleCreateAuthor}
        onCreateAuthorFromDefault={(details, novelId) => {
          const author = handleCreateAuthor(details);
          const novel = getNovelById(novelId);
          if (novel) {
            updateNovel(novelId, { aiAuthorId: author.id });
          }
        }}
      />
    );
  }

  // Author management view
  if (view === 'authors') {
    return (
      <AuthorManager
        authors={authors}
        onBack={handleBackToHome}
        onUpdateAuthors={handleUpdateAuthors}
        onCreateAuthor={handleCreateAuthor}
      />
    );
  }

  // Manuscript analysis view
  if (view === 'manuscript') {
    return (
      <ManuscriptAnalysisLab
        authors={authors}
        onBack={handleBackToHome}
        onCreateNovel={(novel) => {
          addNovel(novel);
          setSelectedNovelId(novel.id);
          setView('editor');
        }}
        onCreateAuthor={handleCreateAuthor}
      />
    );
  }

  if (view === 'character-chat') {
    return (
      <Suspense fallback={(
        <div className="flex min-h-screen items-center justify-center bg-[#141215] text-zinc-400">
          캐릭터챗을 여는 중...
        </div>
      )}>
        <CharacterChatApp onExit={handleBackToHome} />
      </Suspense>
    );
  }

  // Home view (NovelList)
  return (
    <>
    <NovelList
      novels={novels}
      series={series}
      authors={authors}
      onSelectNovel={handleSelectNovel}
      onCreateNovel={handleCreateNovel}
      onCreateSeries={handleCreateSeries}
      onCreateNextVolume={handleCreateNextVolume}
      onDeleteNovel={handleDeleteNovel}
      onDuplicateNovel={handleDuplicateNovel}
      onImportNovel={handleImportNovel}
      onManageAuthors={() => setView('authors')}
      onOpenCharacterChat={() => setView('character-chat')}
      onStartManuscriptAnalysis={() => setView('manuscript')}
      onExportStudio={handleExportStudio}
      onImportStudioFile={handleImportStudioFile}
      onOpenProductionPackage={() => setProductionPackageOpen(true)}
      onUpdateSeries={handleUpdateSeries}
      onDeleteSeries={handleDeleteSeries}
      onIncorporateToSeries={handleIncorporateToSeries}
    />
    {activeWorkspace && (
      <Suspense fallback={null}>
      <ProductionPackageCenterModal
        isOpen={isProductionPackageOpen}
        onClose={() => setProductionPackageOpen(false)}
        activeWorkspace={activeWorkspace}
        workspaces={workspaces}
        authors={authors}
        novels={novels}
        series={series}
        onCreateWorkspace={createWorkspace}
        onImported={async (workspaceId) => {
          if (workspaceId === activeWorkspace.id) await reloadActiveWorkspace();
        }}
      />
      </Suspense>
    )}
    </>
  );
}

export default App;

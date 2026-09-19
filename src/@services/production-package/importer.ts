import type {
  AiAuthor,
  Chapter,
  Novel,
  ProductionPackage,
  ProductionPackageIdMap,
  ProductionPackageImportOptions,
  ProductionPackageImportResult,
  ProductionPackageReceipt,
  Series,
  Snapshot,
} from '@core/types';
import {
  getRaw,
  getWorkspaceStorageKey,
  setManyRaw,
  STORAGE_KEYS,
} from '@services/storage';
import { notifyWorkspaceChanged, withWorkspaceWrite } from '@services/storage/workspaceCoordination';

const clone = <T,>(value: T): T => structuredClone(value);
const createIdMap = (): ProductionPackageIdMap => ({
  authors: {},
  series: {},
  volumes: {},
  novels: {},
  chapters: {},
  characters: {},
  foreshadowings: {},
  snapshots: {},
});

const chapterKey = (novelId: string, chapterId: string) => `${novelId}:${chapterId}`;
const nestedKey = (novelId: string, id: string) => `${novelId}:${id}`;

function remapChapters(
  sourceNovelId: string,
  chapters: Chapter[],
  idMap: ProductionPackageIdMap,
): Chapter[] {
  return chapters.map((chapter, index) => {
    const oldId = chapter.id || `legacy-${index}`;
    const id = idMap.chapters[chapterKey(sourceNovelId, oldId)] ?? crypto.randomUUID();
    idMap.chapters[chapterKey(sourceNovelId, oldId)] = id;
    const now = Date.now();
    const copied = clone(chapter);
    return {
      ...copied,
      id,
      agentPendingProposal: copied.agentPendingProposal ? {
        ...copied.agentPendingProposal,
        source: { ...copied.agentPendingProposal.source, chapterId: id },
        authorId: copied.agentPendingProposal.authorId
          ? idMap.authors[copied.agentPendingProposal.authorId] ?? null
          : null,
      } : undefined,
      trace: {
        revision: chapter.trace?.revision ?? 1,
        createdAt: chapter.trace?.createdAt ?? now,
        updatedAt: now,
        source: 'imported' as const,
        originChapterId: oldId,
        generationBatchId: chapter.trace?.generationBatchId,
        batchPosition: chapter.trace?.batchPosition,
        batchSize: chapter.trace?.batchSize,
      },
    };
  });
}

function remapCharacters<T extends { id: string }>(items: T[], idMap: ProductionPackageIdMap): T[] {
  return items.map((item) => ({
    ...clone(item),
    id: idMap.characters[item.id] ?? (idMap.characters[item.id] = crypto.randomUUID()),
  }));
}

function remapNovel(
  source: Novel,
  targetId: string,
  idMap: ProductionPackageIdMap,
  includeSnapshots = true,
): Novel {
  const chapters = remapChapters(source.id, source.chapters, idMap);
  const chapterId = (oldId: string): string | undefined =>
    idMap.chapters[chapterKey(source.id, oldId)];
  const characters = remapCharacters(source.characters, idMap);
  const canonIdMap = new Map((source.canonFacts ?? []).map((fact) => [fact.id, crypto.randomUUID()]));
  const foreshadowingItems = source.foreshadowingSystem?.items.map((item) => {
    const mappedId = idMap.foreshadowings[nestedKey(source.id, item.id)]
      ?? (idMap.foreshadowings[nestedKey(source.id, item.id)] = crypto.randomUUID());
    return { ...clone(item), id: mappedId };
  });

  const result: Novel = {
    ...clone(source),
    id: targetId,
    chapters,
    characters,
    aiAuthorId: source.aiAuthorId ? idMap.authors[source.aiAuthorId] ?? null : null,
    seriesId: source.seriesId ? idMap.series[source.seriesId] : undefined,
    seriesVolumeId: source.seriesVolumeId
      ? idMap.volumes[source.seriesVolumeId] ?? source.seriesVolumeId
      : undefined,
    seriesVolumePlanSnapshot: source.seriesVolumePlanSnapshot ? {
      ...clone(source.seriesVolumePlanSnapshot),
      sourceSeriesId: idMap.series[source.seriesVolumePlanSnapshot.sourceSeriesId]
        ?? source.seriesVolumePlanSnapshot.sourceSeriesId,
      sourceVolumeId: idMap.volumes[source.seriesVolumePlanSnapshot.sourceVolumeId]
        ?? source.seriesVolumePlanSnapshot.sourceVolumeId,
    } : undefined,
    authorMemoryByAuthor: source.authorMemoryByAuthor
      ? Object.fromEntries(Object.entries(source.authorMemoryByAuthor)
        .map(([authorId, memories]) => [idMap.authors[authorId], clone(memories)] as const)
        .filter(([authorId]) => !!authorId))
      : undefined,
    contextSummary: source.contextSummary ? {
      ...clone(source.contextSummary),
      coveredChapterIds: source.contextSummary.coveredChapterIds
        ?.map((id) => chapterId(id))
        .filter((id): id is string => !!id),
      entries: source.contextSummary.entries
        ?.map((entry) => {
          const mapped = chapterId(entry.chapterId);
          return mapped ? { ...clone(entry), chapterId: mapped } : null;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null),
      rollups: source.contextSummary.rollups?.map((rollup) => ({
        ...clone(rollup),
        id: crypto.randomUUID(),
        sourceChapterIds: rollup.sourceChapterIds
          .map((id) => chapterId(id))
          .filter((id): id is string => !!id),
        sourceSignature: '',
      })),
      milestones: source.contextSummary.milestones?.map((milestone) => ({
        ...clone(milestone),
        affectedChapterIds: milestone.affectedChapterIds
          ?.map((id) => chapterId(id))
          .filter((id): id is string => !!id),
      })),
      contentSignature: undefined,
      needsRecheck: true,
    } : undefined,
    contextCaching: source.contextCaching ? { ...clone(source.contextCaching), caches: {} } : undefined,
    canonFacts: source.canonFacts?.map((fact) => ({
      ...clone(fact),
      id: canonIdMap.get(fact.id) as string,
      sourceChapterId: fact.sourceChapterId ? chapterId(fact.sourceChapterId) : undefined,
      validFromChapterId: fact.validFromChapterId ? chapterId(fact.validFromChapterId) : undefined,
      validUntilChapterId: fact.validUntilChapterId ? chapterId(fact.validUntilChapterId) : undefined,
      supersedesFactId: fact.supersedesFactId ? canonIdMap.get(fact.supersedesFactId) : undefined,
    })),
    lorekeeperCache: undefined,
    generationLogs: undefined,
  };

  if (result.foreshadowingSystem && foreshadowingItems) {
    const foreshadowingMap = idMap.foreshadowings;
    result.foreshadowingSystem = {
      ...clone(result.foreshadowingSystem),
      items: foreshadowingItems.map((item) => ({
        ...item,
        linkedCharacterIds: item.linkedCharacterIds
          .map((id) => idMap.characters[id])
          .filter((id): id is string => !!id),
        linkedForeshadowingIds: item.linkedForeshadowingIds
          .map((id) => foreshadowingMap[nestedKey(source.id, id)])
          .filter((id): id is string => !!id),
      })),
    };
  }

  if (includeSnapshots && source.snapshots) {
    result.snapshots = source.snapshots.map((snapshot) => {
      const id = idMap.snapshots[nestedKey(source.id, snapshot.id)]
        ?? (idMap.snapshots[nestedKey(source.id, snapshot.id)] = crypto.randomUUID());
      return {
        ...clone(snapshot),
        id,
        novelData: remapNovel(
          snapshot.novelData as Novel,
          targetId,
          idMap,
          false,
        ) as Snapshot['novelData'],
      };
    });
  } else {
    result.snapshots = undefined;
  }
  return result;
}

function applySelectedSections(
  novel: Novel,
  sections: ProductionPackageImportOptions['sections'],
): Novel {
  const result: Novel = {
    id: novel.id,
    title: novel.title,
    subject: sections.workCore ? novel.subject : '',
    mood: sections.workCore ? novel.mood : '',
    primaryGenre: sections.workCore ? novel.primaryGenre : undefined,
    subgenres: sections.workCore ? novel.subgenres : [],
    themes: sections.workCore ? novel.themes : [],
    plotSummary: sections.workCore ? novel.plotSummary : '',
    chapters: sections.manuscript ? novel.chapters : [],
    history: sections.collaboration ? novel.history : [],
    createdAt: Date.now(),
    aiAuthorId: sections.workCore || sections.authors ? novel.aiAuthorId : null,
    characters: sections.worldbuilding ? novel.characters : [],
  };
  if (sections.workCore) {
    Object.assign(result, {
      seriesId: novel.seriesId,
      volumeNumber: novel.volumeNumber,
      seriesVolumeId: novel.seriesVolumeId,
      seriesVolumePlanSnapshot: novel.seriesVolumePlanSnapshot,
      targetCharacterCount: novel.targetCharacterCount,
      targetChapterCount: novel.targetChapterCount,
      preventAutoEnding: novel.preventAutoEnding,
    });
  }
  if (sections.worldbuilding && novel.seriesId) result.seriesId = novel.seriesId;
  if (sections.worldbuilding) result.worldviewFiles = novel.worldviewFiles;
  if (sections.planning) {
    Object.assign(result, {
      useLorekeeper: novel.useLorekeeper,
      avoidRepetition: novel.avoidRepetition,
      episodePacing: novel.episodePacing,
      episodeArc: novel.episodeArc,
      treatment: novel.treatment,
      foreshadowingSystem: novel.foreshadowingSystem,
      webnovelSettings: novel.webnovelSettings,
      openingStyle: novel.openingStyle,
      startingPoint: novel.startingPoint,
      generationEngine: novel.generationEngine,
      targetedGenerationEnabled: novel.targetedGenerationEnabled !== false,
      chapterGenerationMode: novel.chapterGenerationMode ?? 'single',
      chapterTargetCharacters: novel.chapterTargetCharacters ?? 6000,
      maxTokens: novel.maxTokens ?? 16384,
      contextManagement: novel.contextManagement,
      contextCaching: novel.contextCaching,
    });
    if (!sections.worldbuilding && result.foreshadowingSystem) {
      result.foreshadowingSystem = {
        ...result.foreshadowingSystem,
        items: result.foreshadowingSystem.items.map((item) => ({
          ...item,
          linkedCharacterIds: [],
        })),
      };
    }
  }
  if (sections.memory) {
    Object.assign(result, {
      authorMemoryByAuthor: novel.authorMemoryByAuthor,
      contextSummary: novel.contextSummary,
      canonFacts: novel.canonFacts,
      snapshots: novel.snapshots,
    });
  }
  if (sections.collaboration) {
    Object.assign(result, {
      analysis: novel.analysis,
      liveFeedbackChat: novel.liveFeedbackChat,
      writingDirectives: novel.writingDirectives,
      directingChatHistory: novel.directingChatHistory,
    });
  }
  if (sections.assets) result.coverImage = novel.coverImage;
  return result;
}

function createRecoverySnapshot(novel: Novel): Snapshot {
  const { snapshots: _snapshots, ...novelData } = clone(novel);
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    description: '제작 패키지 원고 교체 전 자동 복구본',
    kind: 'auto-recovery',
    recoveryMeta: {
      operation: 'rollback',
      targetChapterNumber: 1,
      chapterCountBefore: novel.chapters.length,
    },
    novelData,
  };
}

function mergeNovel(
  current: Novel,
  incoming: Novel,
  sections: ProductionPackageImportOptions['sections'],
  manuscriptMode: ProductionPackageImportOptions['manuscriptMode'],
): Novel {
  const next = clone(current);
  if (sections.workCore) {
    Object.assign(next, {
      title: incoming.title,
      subject: incoming.subject,
      mood: incoming.mood,
      primaryGenre: incoming.primaryGenre,
      subgenres: incoming.subgenres,
      themes: incoming.themes,
      plotSummary: incoming.plotSummary,
      targetCharacterCount: incoming.targetCharacterCount,
      targetChapterCount: incoming.targetChapterCount,
      preventAutoEnding: incoming.preventAutoEnding,
      aiAuthorId: incoming.aiAuthorId ?? current.aiAuthorId,
    });
  }
  if (sections.planning) {
    Object.assign(next, {
      useLorekeeper: incoming.useLorekeeper !== false,
      avoidRepetition: incoming.avoidRepetition,
      episodePacing: incoming.episodePacing,
      episodeArc: incoming.episodeArc,
      treatment: incoming.treatment,
      foreshadowingSystem: incoming.foreshadowingSystem,
      webnovelSettings: incoming.webnovelSettings,
      openingStyle: incoming.openingStyle,
      startingPoint: incoming.startingPoint,
      generationEngine: incoming.generationEngine,
      targetedGenerationEnabled: incoming.targetedGenerationEnabled ?? current.targetedGenerationEnabled ?? true,
      chapterGenerationMode: incoming.chapterGenerationMode ?? current.chapterGenerationMode ?? 'single',
      chapterTargetCharacters: incoming.chapterTargetCharacters ?? current.chapterTargetCharacters ?? 6000,
      maxTokens: incoming.maxTokens ?? current.maxTokens ?? 16384,
      contextManagement: incoming.contextManagement,
      contextCaching: incoming.contextCaching,
    });
    if (!sections.worldbuilding && next.foreshadowingSystem) {
      const existingCharacterIds = new Set(current.characters.map((character) => character.id));
      next.foreshadowingSystem = {
        ...next.foreshadowingSystem,
        items: next.foreshadowingSystem.items.map((item) => ({
          ...item,
          linkedCharacterIds: item.linkedCharacterIds.filter((id) => existingCharacterIds.has(id)),
        })),
      };
    }
  }
  if (sections.worldbuilding && !current.seriesId) {
    next.characters = incoming.characters;
    next.worldviewFiles = incoming.worldviewFiles;
  }
  if (sections.manuscript) {
    if (manuscriptMode === 'replace') {
      next.snapshots = [...(current.snapshots ?? []), createRecoverySnapshot(current)];
      next.chapters = incoming.chapters;
    } else {
      next.chapters = [...current.chapters, ...incoming.chapters];
    }
  }
  if (sections.memory) {
    Object.assign(next, {
      authorMemoryByAuthor: incoming.authorMemoryByAuthor,
      contextSummary: incoming.contextSummary,
      canonFacts: incoming.canonFacts,
      snapshots: sections.manuscript && manuscriptMode === 'replace'
        ? next.snapshots
        : incoming.snapshots,
    });
  }
  if (sections.collaboration) {
    Object.assign(next, {
      history: incoming.history,
      analysis: incoming.analysis,
      liveFeedbackChat: incoming.liveFeedbackChat,
      writingDirectives: incoming.writingDirectives,
      directingChatHistory: incoming.directingChatHistory,
    });
  }
  if (sections.assets) next.coverImage = incoming.coverImage;
  next.lorekeeperCache = undefined;
  next.generationLogs = undefined;
  if (next.contextCaching) next.contextCaching = { ...next.contextCaching, caches: {} };
  return next;
}

function remapSeries(source: Series, idMap: ProductionPackageIdMap): Series {
  return {
    ...clone(source),
    id: idMap.series[source.id],
    characters: remapCharacters(source.characters, idMap),
    novelIds: source.novelIds.map((id) => idMap.novels[id]).filter((id): id is string => !!id),
    blueprint: source.blueprint ? {
      ...clone(source.blueprint),
      volumes: source.blueprint.volumes.map((volume) => ({
        ...clone(volume),
        id: volume.id ? idMap.volumes[volume.id] ?? volume.id : crypto.randomUUID(),
        linkedNovelId: volume.linkedNovelId ? idMap.novels[volume.linkedNovelId] : undefined,
      })),
    } : undefined,
    seriesMemoryState: source.seriesMemoryState ? {
      ...clone(source.seriesMemoryState),
      combinedSignature: '',
      blocks: source.seriesMemoryState.blocks
        .map((block) => {
          const novelId = idMap.novels[block.novelId];
          if (!novelId) return null;
          return {
            ...clone(block),
            novelId,
            volumeId: block.volumeId ? idMap.volumes[block.volumeId] ?? block.volumeId : undefined,
          };
        })
        .filter((block): block is NonNullable<typeof block> => block !== null),
    } : undefined,
  };
}

export async function importProductionPackage(
  productionPackage: ProductionPackage,
  options: ProductionPackageImportOptions,
): Promise<ProductionPackageImportResult> {
  const result = await withWorkspaceWrite(options.targetWorkspaceId, async () => {
    const [currentAuthors, currentSeries, currentNovels, currentReceipts] = await Promise.all([
      getRaw<AiAuthor[]>(getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.AUTHORS)),
      getRaw<Series[]>(getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.SERIES)),
      getRaw<Novel[]>(getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.NOVELS)),
      getRaw<ProductionPackageReceipt[]>(getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.PRODUCTION_PACKAGE_RECEIPTS)),
    ]);
    const authors = currentAuthors ?? [];
    const series = currentSeries ?? [];
    const novels = currentNovels ?? [];
    const receipts = currentReceipts ?? [];
    const selectedAuthorIds = new Set(options.selectedAuthorIds);
    const selectedNovelIds = new Set(options.selectedNovelIds);
    const sourceAuthors = productionPackage.payload.authors.filter((item) => selectedAuthorIds.has(item.id));
    const sourceNovels = productionPackage.payload.novels.filter((item) => selectedNovelIds.has(item.id));
    const includeSeries = options.sections.workCore || options.sections.worldbuilding || options.sections.memory;
    const sourceSeries = includeSeries
      ? productionPackage.payload.series.filter((item) => item.novelIds.some((id) => selectedNovelIds.has(id)))
      : [];
    const idMap = createIdMap();

    const nextAuthors = [...authors];
    if (options.sections.authors) {
      for (const author of sourceAuthors) {
        const sameDefault = author.isDefault ? authors.find((item) => item.id === author.id) : undefined;
        if (sameDefault) {
          idMap.authors[author.id] = sameDefault.id;
          continue;
        }
        const id = crypto.randomUUID();
        idMap.authors[author.id] = id;
        nextAuthors.push({ ...clone(author), id, createdAt: Date.now(), isDefault: false });
      }
    }
    productionPackage.payload.authors.forEach((author) => {
      if (!idMap.authors[author.id] && authors.some((item) => item.id === author.id)) {
        idMap.authors[author.id] = author.id;
      }
    });

    if (options.mode === 'merge') {
      if (sourceNovels.length !== 1 || !options.targetNovelId) {
        throw new Error('기존 작품 반영은 패키지 작품 하나와 대상 작품 하나를 선택해야 합니다.');
      }
      const targetIndex = novels.findIndex((item) => item.id === options.targetNovelId);
      if (targetIndex < 0) throw new Error('반영할 기존 작품을 찾지 못했습니다.');
      const source = sourceNovels[0];
      const target = novels[targetIndex];
      idMap.novels[source.id] = target.id;
      if (source.seriesId && target.seriesId) idMap.series[source.seriesId] = target.seriesId;
      const sourceSeriesItem = source.seriesId
        ? sourceSeries.find((item) => item.id === source.seriesId)
        : undefined;
      const targetSeriesItem = target.seriesId
        ? series.find((item) => item.id === target.seriesId)
        : undefined;
      sourceSeriesItem?.blueprint?.volumes.forEach((volume) => {
        if (!volume.id) return;
        const existingVolume = targetSeriesItem?.blueprint?.volumes.find((item) =>
          item.volumeNumber === volume.volumeNumber
        );
        idMap.volumes[volume.id] = existingVolume?.id || crypto.randomUUID();
      });
      source.chapters.forEach((chapter, index) => {
        const oldId = chapter.id || `legacy-${index}`;
        if (!options.sections.manuscript) {
          const existing = target.chapters.find((item) => item.id === chapter.id);
          if (existing?.id) idMap.chapters[chapterKey(source.id, oldId)] = existing.id;
        }
      });
      const remapped = remapNovel(source, target.id, idMap);
      const nextNovels = [...novels];
      nextNovels[targetIndex] = mergeNovel(target, remapped, options.sections, options.manuscriptMode ?? 'append');
      const nextSeries = [...series];
      if ((options.sections.worldbuilding || options.sections.memory) && target.seriesId) {
        const targetSeriesIndex = nextSeries.findIndex((item) => item.id === target.seriesId);
        if (targetSeriesIndex >= 0 && sourceSeriesItem) {
          const remappedSeries = remapSeries(sourceSeriesItem, idMap);
          const currentBlueprint = nextSeries[targetSeriesIndex].blueprint;
          const blueprint = options.sections.worldbuilding && remappedSeries.blueprint ? {
            ...remappedSeries.blueprint,
            volumes: remappedSeries.blueprint.volumes.map((volume) => {
              const current = currentBlueprint?.volumes.find((item) => item.id === volume.id);
              return { ...volume, linkedNovelId: volume.linkedNovelId || current?.linkedNovelId };
            }),
          } : undefined;
          const currentSeries = nextSeries[targetSeriesIndex];
          const importedBlocks = remappedSeries.seriesMemoryState?.blocks ?? [];
          const importedNovelIds = new Set(importedBlocks.map((block) => block.novelId));
          const mergedBlocks = options.sections.memory ? [
            ...(currentSeries.seriesMemoryState?.blocks ?? []).filter((block) => !importedNovelIds.has(block.novelId)),
            ...importedBlocks,
          ] : currentSeries.seriesMemoryState?.blocks;
          nextSeries[targetSeriesIndex] = {
            ...currentSeries,
            ...(options.sections.worldbuilding ? {
              characters: remapCharacters(sourceSeriesItem.characters, idMap),
              worldviewFiles: clone(sourceSeriesItem.worldviewFiles ?? []),
              blueprint,
            } : {}),
            ...(options.sections.memory ? {
              seriesMemoryCompendium: remappedSeries.seriesMemoryCompendium || currentSeries.seriesMemoryCompendium,
              seriesMemoryState: mergedBlocks ? {
                blocks: mergedBlocks,
                combinedSignature: '',
                generatedAt: Date.now(),
              } : undefined,
            } : {}),
          };
        }
      }

      const receipt: ProductionPackageReceipt = {
        lineageId: productionPackage.package.lineageId,
        packageId: productionPackage.package.packageId,
        revision: productionPackage.package.revision,
        importedAt: Date.now(),
        targetWorkspaceId: options.targetWorkspaceId,
        mode: 'merge',
        idMap,
      };
      await setManyRaw([
        [getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.AUTHORS), nextAuthors],
        [getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.SERIES), nextSeries],
        [getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.NOVELS), nextNovels],
        [getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.PRODUCTION_PACKAGE_RECEIPTS), [...receipts, receipt]],
      ]);
      return {
        importedAuthors: nextAuthors.length - authors.length,
        importedSeries: 0,
        importedNovels: 0,
        mergedNovelTitle: nextNovels[targetIndex].title,
        receipt,
      };
    }

    sourceSeries.forEach((item) => {
      idMap.series[item.id] = crypto.randomUUID();
      item.blueprint?.volumes.forEach((volume) => {
        if (volume.id) idMap.volumes[volume.id] = crypto.randomUUID();
      });
    });
    sourceNovels.forEach((item) => { idMap.novels[item.id] = crypto.randomUUID(); });
    const importedNovels = sourceNovels.map((source) => {
      const remapped = remapNovel(source, idMap.novels[source.id], idMap);
      return applySelectedSections(remapped, options.sections);
    });
    const importedSeries = sourceSeries.map((item) => {
      const remapped = remapSeries(item, idMap);
      return {
        ...remapped,
        seriesPlotSummary: options.sections.workCore ? remapped.seriesPlotSummary : '',
        characters: options.sections.worldbuilding ? remapped.characters : [],
        worldviewFiles: options.sections.worldbuilding ? remapped.worldviewFiles : [],
        blueprint: options.sections.worldbuilding ? remapped.blueprint : undefined,
        seriesMemoryCompendium: options.sections.memory ? remapped.seriesMemoryCompendium : undefined,
        seriesMemoryState: options.sections.memory ? remapped.seriesMemoryState : undefined,
      };
    });

    const receipt: ProductionPackageReceipt = {
      lineageId: productionPackage.package.lineageId,
      packageId: productionPackage.package.packageId,
      revision: productionPackage.package.revision,
      importedAt: Date.now(),
      targetWorkspaceId: options.targetWorkspaceId,
      mode: 'copy',
      idMap,
    };
    await setManyRaw([
      [getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.AUTHORS), nextAuthors],
      [getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.SERIES), [...series, ...importedSeries]],
      [getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.NOVELS), [...novels, ...importedNovels]],
      [getWorkspaceStorageKey(options.targetWorkspaceId, STORAGE_KEYS.PRODUCTION_PACKAGE_RECEIPTS), [...receipts, receipt]],
    ]);

    return {
      importedAuthors: nextAuthors.length - authors.length,
      importedSeries: importedSeries.length,
      importedNovels: importedNovels.length,
      receipt,
    };
  });
  notifyWorkspaceChanged({ workspaceId: options.targetWorkspaceId, kind: 'updated' });
  return result;
}

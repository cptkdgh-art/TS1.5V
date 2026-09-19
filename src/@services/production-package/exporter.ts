import type {
  AiAuthor,
  Novel,
  ProductionPackage,
  ProductionPackagePurpose,
  ProductionPackageSectionSelection,
  Series,
  StudioWorkspace,
} from '@core/types';
import { PRODUCTION_PACKAGE_KIND } from '@core/types';

interface CreateProductionPackageInput {
  workspace: StudioWorkspace;
  authors: AiAuthor[];
  novels: Novel[];
  series: Series[];
  selectedAuthorIds: string[];
  selectedNovelIds: string[];
  sections: ProductionPackageSectionSelection;
  purpose: ProductionPackagePurpose;
  title: string;
  publisher?: string;
  lineageId?: string;
  revision?: number;
  parentPackageId?: string | null;
}

const clone = <T,>(value: T): T => structuredClone(value);

function sanitizeAuthor(author: AiAuthor, sections: ProductionPackageSectionSelection): AiAuthor {
  const result: AiAuthor = {
    id: author.id,
    name: author.name,
    specialty: author.specialty,
    writingStyle: author.writingStyle,
    coreDirectives: author.coreDirectives,
    createdAt: author.createdAt,
    tags: clone(author.tags ?? []),
    isDefault: author.isDefault,
    role: author.role,
    profileVersions: clone(author.profileVersions ?? []),
    identityCore: author.identityCore ? clone(author.identityCore) : undefined,
  };
  if (sections.memory) result.memoryCache = clone(author.memoryCache ?? []);
  if (sections.collaboration) {
    result.metaChatHistory = clone(author.metaChatHistory ?? []);
    result.generalChatHistory = clone(author.generalChatHistory ?? []);
  }
  return result;
}

function sanitizeNovel(novel: Novel, sections: ProductionPackageSectionSelection): Novel {
  const result: Novel = {
    id: novel.id,
    title: novel.title,
    subject: sections.workCore ? novel.subject : '',
    mood: sections.workCore ? novel.mood : '',
    primaryGenre: sections.workCore ? novel.primaryGenre : undefined,
    subgenres: sections.workCore ? clone(novel.subgenres ?? []) : [],
    themes: sections.workCore ? clone(novel.themes ?? []) : [],
    plotSummary: sections.workCore ? novel.plotSummary : '',
    chapters: sections.manuscript ? clone(novel.chapters) : [],
    history: sections.collaboration ? clone(novel.history) : [],
    createdAt: novel.createdAt,
    aiAuthorId: sections.workCore || sections.authors ? novel.aiAuthorId : null,
    characters: sections.worldbuilding ? clone(novel.characters) : [],
  };

  if (sections.workCore) {
    Object.assign(result, {
      seriesId: novel.seriesId,
      volumeNumber: novel.volumeNumber,
      seriesVolumeId: novel.seriesVolumeId,
      seriesVolumePlanSnapshot: clone(novel.seriesVolumePlanSnapshot),
      targetCharacterCount: novel.targetCharacterCount,
      targetChapterCount: novel.targetChapterCount,
      preventAutoEnding: novel.preventAutoEnding,
    });
  }
  if (sections.worldbuilding) result.worldviewFiles = clone(novel.worldviewFiles ?? []);
  if (sections.planning) {
    Object.assign(result, clone({
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
      contextCaching: novel.contextCaching ? {
        ...novel.contextCaching,
        caches: {},
      } : undefined,
    }));
  }
  if (sections.memory) {
    Object.assign(result, clone({
      authorMemoryByAuthor: novel.authorMemoryByAuthor,
      contextSummary: novel.contextSummary,
      canonFacts: novel.canonFacts,
      snapshots: novel.snapshots,
    }));
  }
  if (sections.collaboration) {
    Object.assign(result, clone({
      analysis: novel.analysis,
      liveFeedbackChat: novel.liveFeedbackChat,
      writingDirectives: novel.writingDirectives,
      directingChatHistory: novel.directingChatHistory,
    }));
  }
  if (sections.assets) result.coverImage = novel.coverImage;
  return result;
}

function sanitizeSeries(
  item: Series,
  selectedNovelIds: Set<string>,
  sections: ProductionPackageSectionSelection,
): Series {
  const result: Series = {
    id: item.id,
    title: item.title,
    seriesPlotSummary: sections.workCore ? item.seriesPlotSummary : '',
    characters: sections.worldbuilding ? clone(item.characters) : [],
    worldviewFiles: sections.worldbuilding ? clone(item.worldviewFiles ?? []) : [],
    novelIds: item.novelIds.filter((id) => selectedNovelIds.has(id)),
    createdAt: item.createdAt,
  };
  if (sections.worldbuilding) result.blueprint = clone(item.blueprint);
  if (sections.memory) {
    result.seriesMemoryCompendium = item.seriesMemoryCompendium;
    result.seriesMemoryState = clone(item.seriesMemoryState);
  }
  return result;
}

function estimateAssetBytes(authors: AiAuthor[], novels: Novel[]): number {
  const values = [
    ...novels.map((novel) => novel.coverImage),
    ...authors.flatMap(() => [] as Array<string | undefined>),
  ].filter((value): value is string => typeof value === 'string');
  return values.reduce((sum, value) => sum + Math.ceil(value.length * 0.75), 0);
}

export function createProductionPackage(input: CreateProductionPackageInput): ProductionPackage {
  const selectedNovelIds = new Set(input.selectedNovelIds);
  const selectedNovels = input.novels
    .filter((novel) => selectedNovelIds.has(novel.id))
    .map((novel) => sanitizeNovel(novel, input.sections));
  const relatedSeries = input.series
    .filter((item) => item.novelIds.some((id) => selectedNovelIds.has(id)))
    .map((item) => sanitizeSeries(item, selectedNovelIds, input.sections));
  const relatedAuthorIds = new Set(input.selectedAuthorIds);
  if (input.sections.authors) {
    selectedNovels.forEach((novel) => {
      if (novel.aiAuthorId) relatedAuthorIds.add(novel.aiAuthorId);
    });
  }
  const selectedAuthors = input.sections.authors
    ? input.authors.filter((author) => relatedAuthorIds.has(author.id)).map((author) => sanitizeAuthor(author, input.sections))
    : [];

  return {
    kind: PRODUCTION_PACKAGE_KIND,
    schemaVersion: 1,
    package: {
      packageId: crypto.randomUUID(),
      lineageId: input.lineageId ?? crypto.randomUUID(),
      revision: input.revision ?? 1,
      parentPackageId: input.parentPackageId ?? null,
      title: input.title.trim() || '진폭 제작 패키지',
      purpose: input.purpose,
      publisher: input.publisher?.trim() || '진폭출판사',
      createdAt: new Date().toISOString(),
      sourceApp: 'jinpok-stido',
      sourceSchema: '1.5',
    },
    sourceWorkspace: { id: input.workspace.id, name: input.workspace.name },
    manifest: {
      sections: clone(input.sections),
      counts: {
        authors: selectedAuthors.length,
        series: relatedSeries.length,
        novels: selectedNovels.length,
        chapters: selectedNovels.reduce((sum, novel) => sum + novel.chapters.length, 0),
        characters: selectedNovels.reduce((sum, novel) => sum + novel.characters.length, 0)
          + relatedSeries.reduce((sum, item) => sum + item.characters.length, 0),
        worldviewFiles: selectedNovels.reduce((sum, novel) => sum + (novel.worldviewFiles?.length ?? 0), 0)
          + relatedSeries.reduce((sum, item) => sum + (item.worldviewFiles?.length ?? 0), 0),
      },
      omittedSensitiveFields: ['appSettings', 'apiKeys', 'remoteCacheHandles', 'lorekeeperCache', 'generationLogs'],
      assetBytes: input.sections.assets ? estimateAssetBytes(selectedAuthors, selectedNovels) : 0,
    },
    payload: {
      authors: selectedAuthors,
      series: relatedSeries,
      novels: selectedNovels,
    },
  };
}

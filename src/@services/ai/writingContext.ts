import type { AiAuthor, AuthorIdentityCore, Content, Novel, Series } from '@core/types';
import { resolveAuthorIdentityCore } from './authorIdentity';
import { computeStableSignature, getSummaryCoveredCount, validateSummaryCheckpoint } from './utils';
import { resolveWorldviewFiles } from './worldviewPolicy';
import { getVolumeDisplayLabel, inspectCanonFacts, resolveSeriesVolume } from '@services/novel';
import { COMMON_PROSE_GUARDRAILS } from '@core/laws';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import { resolveHierarchicalSummary } from './summaryHierarchy';
import { resolveSeriesMemoryForNovel } from './seriesMemory';
import { useNovelStore } from '@stores/novelStore';

export type WritingContextMode = 'compact' | 'full';

export interface StoryMemoryResolution {
  status: 'valid' | 'stale' | 'missing';
  reason: string | null;
  summary: string;
  coveredChapterCount: number;
  fullTextChapters: number;
  rawChapterStartIndex: number;
}

export interface WritingContextPackage {
  schemaVersion: 1;
  generatedAt: number;
  mode: WritingContextMode;
  priorityPolicy: readonly string[];
  commonWritingRules: readonly string[];
  author: {
    assigned: boolean;
    id: string | null;
    name: string;
    specialty: string;
    writingStyle: string;
    coreDirectives: string;
    identityCore: AuthorIdentityCore | null;
    globalMemories: string[];
  };
  work: {
    id: string;
    title: string;
    subject: string;
    mood: string;
    primaryGenre: string;
    subgenres: string[];
    themes: string[];
    plotSummary: string;
    directives: string[];
    chapterCount: number;
    nextChapterNumber: number;
  };
  series: null | {
    id: string;
    title: string;
    volumeNumber: number | null;
    plotSummary: string;
    memoryCompendium: string;
    globalPlan: null | {
      worldview: string;
      mainConflict: string;
      characterArcs: string;
    };
    volumePlan: null | {
      id: string | null;
      label: string;
      title: string;
      localSetting: string;
      goal: string;
      mainConflict: string;
      keyEvents: string;
      isLive: boolean;
    };
  };
  storyMemory: {
    status: 'valid' | 'stale' | 'missing';
    reason: string | null;
    summary: string;
    coveredChapterCount: number;
    rawChapterStart: number;
    rawChapterCount: number;
  };
  canon: {
    active: Array<{ id: string; subject: string; value: string; locked: boolean }>;
    needsReview: Array<{ id: string; subject: string; reason: string }>;
  };
  chapters: Array<{
    number: number;
    id: string | null;
    title: string;
    contentLength: number;
    content?: string;
  }>;
  characters: Novel['characters'];
  worldviewFiles: NonNullable<Novel['worldviewFiles']>;
  diagnostics: {
    authorGlobalMemoryCount: number;
    directiveCount: number;
    summaryCharacters: number;
    rawCharacters: number;
  };
  warnings: string[];
}

const PRIORITY_POLICY = [
  'AI 작가의 고유 정체성, 문체, 핵심 지시와 공통 기억',
  '사용자가 작품과 현재 회차에 명시한 지시',
  '확정된 작품 설정, 시리즈 기억, 인물, 세계관과 앞선 사건',
  '작가 개성을 바꾸지 않는 가독성, 속도와 호흡 보조',
] as const;

function contentToText(content: Content): string {
  return (content.parts || [])
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .filter(Boolean)
    .join('\n')
    .trim();
}

function matchesSummaryEntry(
  signature: string | undefined,
  chapter: Novel['chapters'][number],
): boolean {
  if (!signature) return false;
  const current = computeStableSignature(JSON.stringify([chapter.id || '?', chapter.title, chapter.content]));
  const legacy = `${chapter.id || '?'}:${chapter.title}:${chapter.content.length}:${chapter.content.slice(0, 16)}`;
  return signature === current || signature === legacy;
}

function resolveVerifiedSummaryPrefix(
  novel: Novel,
  fullTextChapters: number,
): { summary: string; coveredChapterCount: number } {
  const entries = novel.contextSummary?.entries || [];
  if (entries.length === 0) return { summary: '', coveredChapterCount: 0 };

  const entryById = new Map(entries.map((entry) => [entry.chapterId, entry]));
  const archiveTargetCount = Math.max(0, novel.chapters.length - fullTextChapters);
  const verified: string[] = [];

  for (let index = 0; index < archiveTargetCount; index += 1) {
    const chapter = novel.chapters[index];
    const entry = chapter.id ? entryById.get(chapter.id) : undefined;
    if (!entry || !matchesSummaryEntry(entry.chapterSignature, chapter)) break;
    verified.push(`[${chapter.chapterNumber ?? index + 1}화] ${entry.summary}`);
  }

  return {
    summary: verified.join('\n\n'),
    coveredChapterCount: verified.length,
  };
}

/** 모든 AI 진입점이 같은 요약 유효성 및 최근 원문 범위를 사용한다. */
export function resolveStoryMemory(
  novel: Novel,
  mode: WritingContextMode = 'compact'
): StoryMemoryResolution {
  const totalChapters = novel.chapters.length;
  const fullTextChapters = Math.min(totalChapters, FIXED_RECENT_RAW_CHAPTERS);
  const checkpoint = validateSummaryCheckpoint(novel.contextSummary, novel.chapters, fullTextChapters);
  const storedSummary = novel.contextSummary?.content?.trim() || '';
  const status = !storedSummary ? 'missing' : checkpoint.isValid ? 'valid' : 'stale';
  const verifiedPrefix = status === 'stale'
    ? resolveVerifiedSummaryPrefix(novel, fullTextChapters)
    : null;
  const summary = verifiedPrefix?.summary
    ?? (status === 'valid' ? resolveHierarchicalSummary(novel.contextSummary) : storedSummary);
  const coveredChapterCount = verifiedPrefix?.coveredChapterCount ?? getSummaryCoveredCount(
    novel.contextSummary,
    totalChapters,
    fullTextChapters,
    checkpoint.isValid,
  );
  const compactRawStart = status === 'valid'
    ? coveredChapterCount
    : status === 'stale'
      ? coveredChapterCount
      : Math.max(0, totalChapters - fullTextChapters);
  const rawChapterStartIndex = mode === 'full' && status === 'missing' ? 0 : compactRawStart;

  return {
    status,
    reason: checkpoint.reason || null,
    summary,
    coveredChapterCount,
    fullTextChapters,
    rawChapterStartIndex,
  };
}

/** Gemini와 Codex 브리지가 같은 작가·작품 문맥 계약을 읽도록 조립한다. */
export function buildWritingContext(
  novel: Novel,
  author: AiAuthor | null,
  series: Series | null,
  mode: WritingContextMode = 'compact',
  seriesNovels: Novel[] = useNovelStore.getState().novels,
): WritingContextPackage {
  const totalChapters = novel.chapters.length;
  const storyMemory = resolveStoryMemory(novel, mode);
  const {
    summary,
    coveredChapterCount,
    fullTextChapters,
    rawChapterStartIndex: rawChapterStart,
    status: summaryStatus,
  } = storyMemory;
  const globalMemories = author?.memoryCache || [];
  const identityCore = author ? resolveAuthorIdentityCore(author) : null;
  const directives = (novel.writingDirectives || []).map(contentToText).filter(Boolean);
  const ownerCharacters = series?.characters ?? novel.characters;
  const ownerWorldview = resolveWorldviewFiles(novel, series);
  const canonStates = inspectCanonFacts(novel);
  const warnings: string[] = [];

  if (!author) warnings.push('담당 AI 작가가 없어 작가 개성과 기억을 적용할 수 없습니다.');
  if (summaryStatus === 'stale') warnings.push('장기 요약 이후 원고가 변경되었습니다. 검증된 앞 구간만 유지하고 이후 원문을 전달하며 재동기화가 필요합니다.');
  if (summaryStatus === 'missing' && totalChapters > fullTextChapters) {
    warnings.push(`장기 요약이 없어 compact 모드에서는 최근 ${fullTextChapters}화만 원문으로 전달됩니다.`);
  }

  const chapters = novel.chapters.map((chapter, index) => {
    const includeContent = index >= rawChapterStart;
    return {
      number: chapter.chapterNumber ?? index + 1,
      id: chapter.id || null,
      title: chapter.title,
      contentLength: chapter.content.length,
      ...(includeContent ? { content: chapter.content } : {}),
    };
  });
  const rawCharacters = chapters.reduce((total, chapter) => total + (chapter.content?.length || 0), 0);

  const liveVolumePlan = resolveSeriesVolume(series, novel);
  const volumePlan = liveVolumePlan ?? novel.seriesVolumePlanSnapshot;

  return {
    schemaVersion: 1,
    generatedAt: Date.now(),
    mode,
    priorityPolicy: PRIORITY_POLICY,
    commonWritingRules: [...COMMON_PROSE_GUARDRAILS],
    author: {
      assigned: !!author,
      id: author?.id || null,
      name: author?.name || '담당 작가 없음',
      specialty: author?.specialty || '',
      writingStyle: author?.writingStyle || '',
      coreDirectives: author?.coreDirectives || '',
      identityCore,
      globalMemories: [...globalMemories],
    },
    work: {
      id: novel.id,
      title: novel.title,
      subject: novel.subject,
      mood: novel.mood,
      primaryGenre: novel.primaryGenre || '',
      subgenres: [...(novel.subgenres || [])],
      themes: [...(novel.themes || [])],
      plotSummary: novel.plotSummary,
      directives,
      chapterCount: totalChapters,
      nextChapterNumber: totalChapters + 1,
    },
    series: series ? {
      id: series.id,
      title: series.title,
      volumeNumber: novel.volumeNumber ?? null,
      plotSummary: series.seriesPlotSummary,
      memoryCompendium: resolveSeriesMemoryForNovel(series, novel, seriesNovels),
      globalPlan: series.blueprint ? {
        worldview: series.blueprint.worldview,
        mainConflict: series.blueprint.mainConflict,
        characterArcs: series.blueprint.characterArcs,
      } : null,
      volumePlan: volumePlan ? {
        id: liveVolumePlan?.id ?? novel.seriesVolumePlanSnapshot?.sourceVolumeId ?? null,
        label: liveVolumePlan
          ? getVolumeDisplayLabel(liveVolumePlan)
          : novel.seriesVolumePlanSnapshot?.displayLabel || `${novel.volumeNumber ?? '?'}권`,
        title: volumePlan.title,
        localSetting: volumePlan.localSetting || '',
        goal: volumePlan.goal,
        mainConflict: volumePlan.mainConflict,
        keyEvents: volumePlan.keyEvents,
        isLive: !!liveVolumePlan,
      } : null,
    } : null,
    storyMemory: {
      status: summaryStatus,
      reason: storyMemory.reason,
      summary,
      coveredChapterCount,
      rawChapterStart: rawChapterStart + 1,
      rawChapterCount: Math.max(0, totalChapters - rawChapterStart),
    },
    canon: {
      active: canonStates.filter((item) => item.active).map(({ fact }) => ({
        id: fact.id,
        subject: fact.subject,
        value: fact.value,
        locked: fact.locked,
      })),
      needsReview: canonStates.filter((item) => item.sourceChanged).map(({ fact }) => ({
        id: fact.id,
        subject: fact.subject,
        reason: '출처 회차의 본문 개정 번호가 변경됨',
      })),
    },
    chapters,
    characters: ownerCharacters,
    worldviewFiles: ownerWorldview,
    diagnostics: {
      authorGlobalMemoryCount: globalMemories.length,
      directiveCount: directives.length,
      summaryCharacters: summary.length,
      rawCharacters,
    },
    warnings,
  };
}

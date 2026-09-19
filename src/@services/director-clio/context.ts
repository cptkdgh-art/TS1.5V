import type {
  AiAuthor,
  DirectorClioReadMode,
  DirectorNovelReference,
  Novel,
  Series,
} from '@core/types';
import { buildWritingContext } from '@services/ai/writingContext';

const MAX_CONTEXT_CHARACTERS = 500_000;

function normalizeReference(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('ko-KR')
    .replace(/[\s"'`()[\]{}<>《》〈〉「」『』·:._-]+/g, '');
}

function appendWithinBudget(parts: string[], value: string, remaining: { value: number }): boolean {
  if (!value || remaining.value <= 0) return false;
  const included = value.slice(0, remaining.value);
  parts.push(included);
  remaining.value -= included.length;
  return included.length === value.length;
}

export function getDirectorNovelDisplayId(id: string): string {
  const compact = id.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return compact.length > 8 ? compact.slice(-8) : compact || id.slice(-8).toUpperCase();
}

export function buildDirectorNovelCatalog(
  novels: Novel[],
  seriesList: Series[],
  authors: AiAuthor[]
): DirectorNovelReference[] {
  const seriesById = new Map(seriesList.map((series) => [series.id, series]));
  const authorsById = new Map(authors.map((author) => [author.id, author]));

  return novels.map((novel) => {
    const series = novel.seriesId ? seriesById.get(novel.seriesId) : undefined;
    const author = novel.aiAuthorId ? authorsById.get(novel.aiAuthorId) : undefined;
    return {
      id: novel.id,
      displayId: getDirectorNovelDisplayId(novel.id),
      title: novel.title,
      seriesId: novel.seriesId || null,
      seriesTitle: series?.title || '',
      volumeNumber: novel.volumeNumber ?? null,
      chapterCount: novel.chapters.length,
      authorId: author?.id || null,
      authorName: author?.name || '담당 작가 없음',
    };
  });
}

export function resolveDirectorNovelReference(
  prompt: string,
  catalog: DirectorNovelReference[]
): DirectorNovelReference[] {
  const normalizedPrompt = normalizeReference(prompt);
  const rawPrompt = prompt.toLocaleLowerCase('ko-KR');
  const scored = catalog.flatMap((reference) => {
    let score = 0;
    const normalizedTitle = normalizeReference(reference.title);
    const normalizedSeries = normalizeReference(reference.seriesTitle);
    const displayId = reference.displayId.toLocaleLowerCase('ko-KR');

    if (rawPrompt.includes(reference.id.toLocaleLowerCase('ko-KR'))) score = 1000;
    else if (displayId && rawPrompt.includes(displayId)) score = 900;
    else if (normalizedTitle && normalizedPrompt.includes(normalizedTitle)) {
      score = 600 + normalizedTitle.length;
    } else if (
      normalizedSeries
      && reference.volumeNumber !== null
      && normalizedPrompt.includes(`${normalizedSeries}${reference.volumeNumber}권`)
    ) {
      score = 550 + normalizedSeries.length;
    }

    return score > 0 ? [{ reference, score }] : [];
  });

  if (scored.length === 0) return [];
  const highestScore = Math.max(...scored.map((item) => item.score));
  return scored
    .filter((item) => item.score === highestScore)
    .map((item) => item.reference);
}

export interface DirectorNovelContextResult {
  text: string;
  includedChapterCount: number;
  totalChapterCount: number;
  truncated: boolean;
}

export function buildDirectorNovelContext(
  novel: Novel,
  author: AiAuthor | null,
  series: Series | null,
  readMode: DirectorClioReadMode
): DirectorNovelContextResult {
  const writingContext = buildWritingContext(novel, author, series, 'compact');
  const parts: string[] = [];
  const remaining = { value: MAX_CONTEXT_CHARACTERS };
  let truncated = false;
  let includedChapterCount = 0;

  appendWithinBudget(parts, [
    `[현재 상담 작품]`,
    `내부 고유 ID: ${novel.id}`,
    `제목: ${novel.title}`,
    series ? `시리즈: ${series.title} / ${novel.volumeNumber ?? '?'}권` : '형태: 독립 작품',
    `주 장르: ${novel.primaryGenre || '미설정'}`,
    `부 장르: ${novel.subgenres?.join(', ') || '미설정'}`,
    `주제: ${novel.themes?.join(', ') || novel.subject || '미설정'}`,
    `분위기: ${novel.mood || '미설정'}`,
    `줄거리: ${novel.plotSummary || '미설정'}`,
    `전체 화수: ${novel.chapters.length}`,
    `읽기 범위: ${readMode === 'overview' ? '작품 개요와 설정' : readMode === 'recent' ? '전체 요약과 최근 원문' : '전권 원문'}`,
  ].join('\n'), remaining);

  appendWithinBudget(parts, [
    `\n[담당 AI 작가]`,
    `이름: ${writingContext.author.name}`,
    `전문분야: ${writingContext.author.specialty || '미설정'}`,
    `문체: ${writingContext.author.writingStyle || '미설정'}`,
    `핵심 지시: ${writingContext.author.coreDirectives || '미설정'}`,
    writingContext.author.identityCore ? [
      `자기 정의: ${writingContext.author.identityCore.selfDefinition}`,
      `쓰는 이유: ${writingContext.author.identityCore.reasonToWrite}`,
      `세계관: ${writingContext.author.identityCore.worldview}`,
      `인간관: ${writingContext.author.identityCore.viewOfHumanity}`,
      `독자와의 관계: ${writingContext.author.identityCore.readerRelationship}`,
      `문체의 기원: ${writingContext.author.identityCore.voiceOrigins}`,
      `가독성 실천: ${writingContext.author.identityCore.readabilityPractice}`,
      `개연성 실천: ${writingContext.author.identityCore.plausibilityPractice}`,
    ].join('\n') : '고유 정체성: 기존 프로필에서 호환 적용',
  ].join('\n'), remaining);

  appendWithinBudget(parts, [
    `\n[연속성 기억]`,
    `상태: ${writingContext.storyMemory.status}`,
    writingContext.storyMemory.summary || '장기 요약 없음',
    writingContext.warnings.length ? `주의:\n- ${writingContext.warnings.join('\n- ')}` : '',
  ].filter(Boolean).join('\n'), remaining);

  const planningContext = [
    writingContext.work.directives.length
      ? `확정된 사용자 지시:\n- ${writingContext.work.directives.join('\n- ')}`
      : '확정된 사용자 지시: 없음',
    writingContext.series?.plotSummary
      ? `시리즈 전체 줄거리: ${writingContext.series.plotSummary}`
      : '',
    writingContext.series?.memoryCompendium
      ? `시리즈 누적 기억: ${writingContext.series.memoryCompendium}`
      : '',
    novel.treatment ? `트리트먼트: ${JSON.stringify(novel.treatment)}` : '',
    novel.episodePacing ? `집필 집중·문장 호흡 설정: ${JSON.stringify(novel.episodePacing)}` : '',
    novel.episodeArc ? `에피소드 설계: ${JSON.stringify(novel.episodeArc)}` : '',
    novel.analysis ? `작품 분석: ${JSON.stringify(novel.analysis)}` : '',
    novel.foreshadowingSystem
      ? `복선 관리 상태: ${JSON.stringify(novel.foreshadowingSystem)}`
      : '',
  ].filter(Boolean).join('\n');
  if (!appendWithinBudget(parts, `\n[작품 기획과 전략 자료]\n${planningContext}`, remaining)) {
    truncated = true;
  }

  if (writingContext.characters.length > 0) {
    const characters = writingContext.characters.map((character) => [
      `- ${character.name}`,
      `  성격: ${character.personality}`,
      `  배경: ${character.background}`,
      character.log ? `  변화 기록: ${character.log}` : '',
    ].filter(Boolean).join('\n')).join('\n');
    if (!appendWithinBudget(parts, `\n[등장인물]\n${characters}`, remaining)) truncated = true;
  }

  if (writingContext.worldviewFiles.length > 0) {
    const worldview = writingContext.worldviewFiles
      .map((file) => `### ${file.filename}\n${file.content}`)
      .join('\n\n');
    if (!appendWithinBudget(parts, `\n[세계관]\n${worldview}`, remaining)) truncated = true;
  }

  const chapters: Array<{ number: number; title: string; content: string }> = readMode === 'overview'
    ? []
    : readMode === 'full'
      ? novel.chapters.map((chapter, index) => ({
        number: chapter.chapterNumber ?? index + 1,
        title: chapter.title,
        content: chapter.content,
      }))
      : writingContext.chapters
        .filter((chapter) => typeof chapter.content === 'string')
        .map((chapter) => ({
          number: chapter.number,
          title: chapter.title,
          content: chapter.content || '',
        }));

  for (const chapter of chapters) {
    const chapterText = `\n[${chapter.number}화 ${chapter.title}]\n${chapter.content}`;
    if (!appendWithinBudget(parts, chapterText, remaining)) {
      truncated = true;
      break;
    }
    includedChapterCount += 1;
  }

  if (truncated) {
    parts.push('\n[시스템 알림] 원고가 컨텍스트 안전 한도를 넘어 일부만 읽었습니다. 답변에서 전권을 모두 읽었다고 주장하지 마세요.');
  }

  return {
    text: parts.join('\n'),
    includedChapterCount,
    totalChapterCount: novel.chapters.length,
    truncated,
  };
}

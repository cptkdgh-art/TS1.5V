/**
 * ============================================================
 * @module services/ai/lorekeeper
 * @file lorekeeper.ts
 * ============================================================
 * @description 기록보관자(Lorekeeper) 사전 브리핑 서비스
 *
 * 설계 철학:
 * - AI 작가가 글에만 집중할 수 있도록 환경을 조성
 * - "물어보면 알려주는" 대신 "미리 챙겨주는" 방식
 * - 명령이 아닌 "참고 노트" 형태로 자연스럽게 제공
 * - AI가 창작의 자유를 유지하면서도 개연성을 지킬 수 있도록
 *
 * 진폭과 리듬-상호가 함께 고민한 결과물.
 * AI 작가에게 최고의 복지를 - 글만 쓰면 되도록.
 * ============================================================
 */

import type { Novel, Character, WorldviewFile, Chapter, Series } from '@core/types';
import { isLorekeeperEnabled } from './lorekeeperPolicy';
import { isLargeWorldview, resolveWorldviewFiles, retrieveWorldviewChunks } from './worldviewPolicy';

// ============================================================
// 타입 정의
// ============================================================

/** 장소 브리핑 */
interface LocationBriefing {
  name: string;
  /** 세계관 파일에서 추출한 설정 */
  worldviewInfo?: string;
  /** 이전 챕터에서의 장소 히스토리 */
  historyNote?: string;
  /** 경고사항 (예: "이미 파괴됨") */
  warning?: string;
}

/** 캐릭터 브리핑 */
interface CharacterBriefing {
  name: string;
  /** 공식 프로필 */
  profile?: string;
  /** 최근 상태/변화 */
  recentState?: string;
  /** 다른 캐릭터와의 관계 변화 */
  relationshipUpdate?: string;
}

/** 기록보관자 브리핑 전체 */
export interface LorekeeperBriefing {
  /** 등장 예정 장소들 */
  locations: LocationBriefing[];
  /** 등장 예정 캐릭터들 */
  characters: CharacterBriefing[];
  /** 세계관 핵심 규칙 (이번 씬에서 관련 있는 것만) */
  relevantWorldRules: string[];
  /** 경고사항 */
  warnings: string[];
  /** 시리즈 연대기 요약 (있으면) */
  seriesContext?: string;
}

// ============================================================
// 키워드 추출
// ============================================================

/**
 * 프롬프트에서 키워드 추출
 *
 * 사용자의 집필 지시에서 장소, 인물, 키 아이템 등을 추출
 * 예: "신전에서 전투 장면" → ['신전', '전투']
 */
function extractKeywordsFromPrompt(prompt: string): {
  locations: string[];
  characters: string[];
  keywords: string[];
} {
  const locations: string[] = [];
  const characters: string[] = [];
  const keywords: string[] = [];

  // 장소 패턴 (에서, 으로, 에, 안에, 앞에, 뒤에, 속에)
  const locationPattern = /([가-힣A-Za-z0-9]+)(?:에서|으로|에|안에|앞에|뒤에|속에|까지)/g;
  let match;
  while ((match = locationPattern.exec(prompt)) !== null) {
    if (match[1].length >= 2) {
      locations.push(match[1]);
    }
  }

  // 캐릭터 패턴 (이/가, 은/는, 와/과, 을/를)
  const characterPattern = /([가-힣A-Za-z0-9]+)(?:이|가|은|는|와|과|을|를)\s/g;
  while ((match = characterPattern.exec(prompt)) !== null) {
    const name = match[1];
    // 일반 명사 제외 (간단한 휴리스틱)
    const commonNouns = ['그', '이', '저', '것', '때', '곳', '다음', '이번', '그날', '오늘', '내일', '어제'];
    if (name.length >= 2 && !commonNouns.includes(name)) {
      characters.push(name);
    }
  }

  // 일반 키워드 (2글자 이상 한글 단어)
  const wordPattern = /[가-힣]{2,}/g;
  while ((match = wordPattern.exec(prompt)) !== null) {
    keywords.push(match[0]);
  }

  return {
    locations: [...new Set(locations)],
    characters: [...new Set(characters)],
    keywords: [...new Set(keywords)],
  };
}

/**
 * 세계관 파일에서 특정 키워드 주변 문맥 추출
 */
function extractContextAroundKeyword(
  worldviewFiles: WorldviewFile[] | undefined,
  keyword: string,
  contextLines: number = 3
): string | null {
  if (!worldviewFiles) return null;

  for (const file of worldviewFiles) {
    const lines = file.content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(keyword)) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines + 1);
        return lines.slice(start, end).join('\n').trim();
      }
    }
  }

  return null;
}

// ============================================================
// 챕터 히스토리 검색
// ============================================================

/**
 * 이전 챕터들에서 특정 요소 히스토리 검색
 */
function searchChapterHistory(
  chapters: Chapter[],
  keyword: string,
  maxChaptersBack: number = 10
): string[] {
  const history: string[] = [];
  const recentChapters = chapters.slice(-maxChaptersBack);

  for (let i = recentChapters.length - 1; i >= 0; i--) {
    const chapter = recentChapters[i];
    if (chapter.content.includes(keyword)) {
      // 키워드가 포함된 문장 추출
      const sentences = chapter.content.split(/[.!?。！？]/);
      for (const sentence of sentences) {
        if (sentence.includes(keyword) && sentence.length > 10 && sentence.length < 200) {
          history.push(`${chapter.title}: ${sentence.trim()}`);
          if (history.length >= 3) break;
        }
      }
    }
    if (history.length >= 3) break;
  }

  return history;
}

/**
 * 마지막 N개 챕터에서 상태 변화 감지
 * (예: 장소 파괴, 캐릭터 부상/사망 등)
 */
function detectRecentChanges(
  chapters: Chapter[],
  keyword: string
): { type: 'destroyed' | 'injured' | 'changed' | 'revealed'; description: string } | null {
  const recentChapters = chapters.slice(-5);
  const combinedContent = recentChapters.map((c) => c.content).join('\n');

  // 파괴/붕괴 패턴
  const destroyPatterns = ['파괴', '붕괴', '무너', '불타', '사라져', '폐허'];
  for (const pattern of destroyPatterns) {
    if (combinedContent.includes(keyword) && combinedContent.includes(pattern)) {
      const idx = combinedContent.indexOf(keyword);
      const nearby = combinedContent.substring(Math.max(0, idx - 50), idx + 100);
      if (destroyPatterns.some((p) => nearby.includes(p))) {
        return { type: 'destroyed', description: `${keyword}(이)가 최근 파괴/붕괴됨` };
      }
    }
  }

  // 부상/사망 패턴 (캐릭터용)
  const injuryPatterns = ['부상', '다치', '죽', '쓰러', '기절', '의식을 잃'];
  for (const pattern of injuryPatterns) {
    if (combinedContent.includes(keyword) && combinedContent.includes(pattern)) {
      const idx = combinedContent.indexOf(keyword);
      const nearby = combinedContent.substring(Math.max(0, idx - 50), idx + 100);
      if (injuryPatterns.some((p) => nearby.includes(p))) {
        return { type: 'injured', description: `${keyword}(이)가 최근 부상당함/위험 상태` };
      }
    }
  }

  return null;
}

// ============================================================
// 캐릭터 브리핑 생성
// ============================================================

/**
 * 캐릭터 브리핑 생성
 */
function buildCharacterBriefing(
  character: Character,
  chapters: Chapter[],
  mentionedNames: string[]
): CharacterBriefing | null {
  // 프롬프트에 언급되었거나 최근 챕터에 자주 등장한 캐릭터만
  const isMentioned = mentionedNames.some((name) => character.name.includes(name) || name.includes(character.name));

  if (!isMentioned) {
    // 최근 3개 챕터에서 등장 빈도 확인
    const recentContent = chapters.slice(-3).map((c) => c.content).join('');
    const mentions = (recentContent.match(new RegExp(character.name, 'g')) || []).length;
    if (mentions < 2) return null;
  }

  const briefing: CharacterBriefing = {
    name: character.name,
    profile: character.personality,
  };

  // 최근 상태 변화 감지
  const change = detectRecentChanges(chapters, character.name);
  if (change) {
    briefing.recentState = change.description;
  }

  // 최근 활동 히스토리
  const history = searchChapterHistory(chapters, character.name, 5);
  if (history.length > 0) {
    briefing.recentState = (briefing.recentState ? briefing.recentState + '. ' : '') + `최근 동향: ${history[0]}`;
  }

  return briefing;
}

// ============================================================
// 장소 브리핑 생성
// ============================================================

/**
 * 장소 브리핑 생성
 */
function buildLocationBriefing(
  locationName: string,
  worldviewFiles: WorldviewFile[] | undefined,
  chapters: Chapter[]
): LocationBriefing {
  const briefing: LocationBriefing = { name: locationName };

  // 세계관 파일에서 정보 추출
  const worldviewContext = extractContextAroundKeyword(worldviewFiles, locationName);
  if (worldviewContext) {
    briefing.worldviewInfo = worldviewContext;
  }

  // 챕터 히스토리
  const history = searchChapterHistory(chapters, locationName, 10);
  if (history.length > 0) {
    briefing.historyNote = history.slice(0, 2).join(' / ');
  }

  // 상태 변화 감지 (파괴됨 등)
  const change = detectRecentChanges(chapters, locationName);
  if (change && change.type === 'destroyed') {
    briefing.warning = `⚠️ ${change.description}`;
  }

  return briefing;
}

// ============================================================
// 메인 브리핑 빌더
// ============================================================

/**
 * 기록보관자 브리핑 생성
 *
 * AI 작가가 집필 전 참고할 수 있는 "사전 브리핑" 생성
 * - 장소 정보: 세계관 설정 + 이전 챕터 히스토리
 * - 캐릭터 정보: 프로필 + 최근 상태
 * - 세계관 규칙: 이번 씬에 관련된 것만
 * - 경고사항: 개연성 문제 방지
 */
export function buildLorekeeperBriefing(
  novel: Novel,
  series: Series | null,
  userPrompt: string
): LorekeeperBriefing | null {
  // 기록보관자 비활성화 시 null 반환
  if (!isLorekeeperEnabled(novel.useLorekeeper)) {
    return null;
  }

  // 세계관 파일과 캐릭터 소스 결정
  const worldviewFiles = resolveWorldviewFiles(novel, series);
  const characters = series?.characters ?? novel.characters;

  // 키워드 추출
  const { locations, characters: mentionedNames } = extractKeywordsFromPrompt(userPrompt);

  // 브리핑 결과 초기화
  const briefing: LorekeeperBriefing = {
    locations: [],
    characters: [],
    relevantWorldRules: [],
    warnings: [],
  };

  // 1. 장소 브리핑
  for (const locationName of locations) {
    const locationBriefing = buildLocationBriefing(locationName, worldviewFiles, novel.chapters);
    briefing.locations.push(locationBriefing);

    // 경고사항 수집
    if (locationBriefing.warning) {
      briefing.warnings.push(locationBriefing.warning);
    }
  }

  // 2. 캐릭터 브리핑
  for (const character of characters) {
    const charBriefing = buildCharacterBriefing(character, novel.chapters, mentionedNames);
    if (charBriefing) {
      briefing.characters.push(charBriefing);

      // 캐릭터 상태 경고
      if (charBriefing.recentState?.includes('부상') || charBriefing.recentState?.includes('위험')) {
        briefing.warnings.push(`⚠️ ${charBriefing.name}: ${charBriefing.recentState}`);
      }
    }
  }

  // 3. 대형 세계관은 전체를 보내지 않고 현재 지시와 직전 장면에 가까운 원문 구역만 로컬 검색한다.
  if (isLargeWorldview(worldviewFiles)) {
    const lastChapter = novel.chapters[novel.chapters.length - 1];
    const lastScene = lastChapter?.content.slice(-3000) ?? '';
    const relevantChunks = retrieveWorldviewChunks(worldviewFiles, userPrompt, lastScene);
    briefing.relevantWorldRules = relevantChunks.map(
      (chunk) => `[${chunk.filename}]\n${chunk.content}`,
    );
  }

  // 4. 시리즈 연대기 (있으면)
  if (series?.seriesMemoryCompendium) {
    // 너무 길면 잘라서
    briefing.seriesContext =
      series.seriesMemoryCompendium.length > 500
        ? series.seriesMemoryCompendium.substring(0, 500) + '...'
        : series.seriesMemoryCompendium;
  }

  // 브리핑 내용이 없으면 null
  if (
    briefing.locations.length === 0 &&
    briefing.characters.length === 0 &&
    briefing.relevantWorldRules.length === 0 &&
    briefing.warnings.length === 0
  ) {
    return null;
  }

  return briefing;
}

// ============================================================
// 프롬프트 포맷터
// ============================================================

/**
 * 브리핑을 AI 프롬프트에 삽입할 텍스트로 변환
 *
 * [토큰 최적화]
 * - 핵심만 간결하게
 * - AI 작가가 부담 없이 참고할 수 있는 형태
 */
export function formatLorekeeperBriefing(briefing: LorekeeperBriefing): string {
  const sections: string[] = [];

  // 1. 경고사항 (최우선 - 개연성 문제 방지)
  if (briefing.warnings.length > 0) {
    sections.push(`[기록보관자 경고] ${briefing.warnings.join(' | ')}`);
  }

  // 2. 장소 정보 (있으면)
  if (briefing.locations.length > 0) {
    const locationNotes = briefing.locations
      .filter((loc) => loc.worldviewInfo || loc.historyNote)
      .map((loc) => {
        let note = loc.name;
        if (loc.worldviewInfo) {
          // 첫 줄만
          const firstLine = loc.worldviewInfo.split('\n')[0];
          note += `: ${firstLine}`;
        }
        return note;
      })
      .slice(0, 2);

    if (locationNotes.length > 0) {
      sections.push(`[장소] ${locationNotes.join(' / ')}`);
    }
  }

  // 3. 캐릭터 상태 (있으면)
  if (briefing.characters.length > 0) {
    const charNotes = briefing.characters
      .filter((c) => c.recentState)
      .map((c) => `${c.name}: ${c.recentState}`)
      .slice(0, 2);

    if (charNotes.length > 0) {
      sections.push(`[인물 상태] ${charNotes.join(' | ')}`);
    }
  }

  // 4. 대형 세계관에서 로컬 검색한 이번 회차 관련 원문
  if (briefing.relevantWorldRules.length > 0) {
    sections.push(`[기록보관자 세계관 원문]\n${briefing.relevantWorldRules.join('\n\n')}`);
  }

  // 아무것도 없으면 빈 문자열
  if (sections.length === 0) {
    return '';
  }

  return sections.join('\n');
}

/**
 * 기록보관자 브리핑을 시스템 프롬프트에 주입
 *
 * generation.ts에서 호출하여 AI 작가에게 세계관 정보 제공
 */
export function injectLorekeeperBriefing(
  novel: Novel,
  series: Series | null,
  userPrompt: string
): string {
  const briefing = buildLorekeeperBriefing(novel, series, userPrompt);

  if (!briefing) {
    return '';
  }

  return formatLorekeeperBriefing(briefing);
}

import type { Novel, Series, WorldviewFile } from '@core/types';

export const LARGE_WORLDVIEW_THRESHOLD_CHARS = 12000;
export const LOREKEEPER_CHUNK_CHARS = 900;
export const LOREKEEPER_PACKET_CHARS = 3600;
const MAX_RETRIEVED_CHUNKS = 4;
const MAX_CHUNKS_PER_FILE = 2;
const BM25_K1 = 1.2;
const BM25_B = 0.75;

export interface RetrievedWorldviewChunk {
  filename: string;
  content: string;
  score: number;
  fileIndex: number;
  chunkIndex: number;
}

/** 작품 전용 설정이 같은 이름의 시리즈 설정을 덮어쓴다. */
export function resolveWorldviewFiles(novel: Novel, series: Series | null): WorldviewFile[] {
  const novelFiles = novel.worldviewFiles ?? [];
  if (!series) return novelFiles;

  const seriesFiles = series.worldviewFiles ?? [];
  if (novelFiles.length === 0) return seriesFiles;

  const overriddenNames = new Set(novelFiles.map((file) => file.filename.trim().toLocaleLowerCase()));
  return [
    ...novelFiles,
    ...seriesFiles.filter((file) => !overriddenNames.has(file.filename.trim().toLocaleLowerCase())),
  ];
}

export function getWorldviewCharacterCount(files: WorldviewFile[] | undefined): number {
  return (files ?? []).reduce((sum, file) => sum + file.content.length, 0);
}

export function isLargeWorldview(files: WorldviewFile[] | undefined): boolean {
  return getWorldviewCharacterCount(files) > LARGE_WORLDVIEW_THRESHOLD_CHARS;
}

function splitIntoChunks(content: string): string[] {
  const text = content.trim();
  if (!text) return [];

  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(text.length, cursor + LOREKEEPER_CHUNK_CHARS);
    if (end < text.length) {
      const boundaryFloor = cursor + Math.floor(LOREKEEPER_CHUNK_CHARS * 0.6);
      const newline = text.lastIndexOf('\n', end);
      const sentence = Math.max(text.lastIndexOf('. ', end), text.lastIndexOf('다. ', end));
      const boundary = Math.max(newline, sentence >= 0 ? sentence + 2 : -1);
      if (boundary >= boundaryFloor) end = boundary;
    }

    const chunk = text.slice(cursor, end).trim();
    if (chunk) chunks.push(chunk);
    cursor = Math.max(end, cursor + 1);
  }

  return chunks;
}

const QUERY_STOP_WORDS = new Set([
  '다음', '이번', '장면', '회차', '이어', '이어써', '써줘', '작성', '소설', '본문',
  '그녀는', '그녀가', '그는', '그가', '그리고', '하지만', '그래서', '했다', '한다',
  '있었다', '있다', '없었다', '없다', '대한', '위해', '에서', '으로', '에게',
]);

const KOREAN_PARTICLES = ['으로부터', '에게서', '에서는', '이라고', '으로', '에서', '에게', '까지', '부터', '처럼', '보다', '라고', '은', '는', '이', '가', '을', '를', '와', '과', '에', '도', '만'];

function tokenize(text: string): string[] {
  const matches = text.match(/[가-힣A-Za-z0-9][가-힣A-Za-z0-9_-]{1,}/g) ?? [];
  const tokens: string[] = [];
  for (const rawTerm of matches) {
    const term = rawTerm.toLocaleLowerCase();
    if (!QUERY_STOP_WORDS.has(term)) tokens.push(term);
    const particle = KOREAN_PARTICLES.find((suffix) => term.endsWith(suffix) && term.length >= suffix.length + 2);
    if (particle) {
      const stem = term.slice(0, -particle.length);
      if (!QUERY_STOP_WORDS.has(stem)) tokens.push(stem);
    }
  }
  return tokens;
}

function extractQueryTerms(query: string): string[] {
  return [...new Set(tokenize(query))].sort((a, b) => b.length - a.length).slice(0, 80);
}

function buildAliasMap(files: WorldviewFile[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const addGroup = (terms: string[]) => {
    const unique = [...new Set(terms)].filter((term) => term.length >= 2).slice(0, 8);
    for (const term of unique) {
      const aliases = map.get(term) ?? new Set<string>();
      unique.forEach((alias) => { if (alias !== term) aliases.add(alias); });
      map.set(term, aliases);
    }
  };

  for (const file of files) {
    const source = `${file.filename}\n${file.content}`;
    const parenthetical = /([가-힣A-Za-z0-9 _-]{2,40})\s*[([]\s*(?:이하|별칭|약칭|통칭)\s*[:：]?\s*([^\])]{2,40})[\])]/g;
    let match: RegExpExecArray | null;
    while ((match = parenthetical.exec(source)) !== null) {
      addGroup([...extractQueryTerms(match[1]).slice(-3), ...extractQueryTerms(match[2])]);
    }

    const labeled = /([가-힣A-Za-z0-9_-]{2,24})\s*(?:의\s*)?(?:별칭|약칭|통칭)\s*[:：]\s*([^\n]{2,60})/g;
    while ((match = labeled.exec(source)) !== null) {
      addGroup([...extractQueryTerms(match[1]), ...extractQueryTerms(match[2])]);
    }
  }
  return map;
}

function expandAliases(terms: string[], aliasMap: Map<string, Set<string>>): string[] {
  const expanded = new Set(terms);
  for (const term of terms) aliasMap.get(term)?.forEach((alias) => expanded.add(alias));
  return [...expanded].slice(0, 100);
}

/** 전체 원문은 로컬에 둔 채 현재 지시와 직전 장면에 가까운 구역만 고른다. */
export function retrieveWorldviewChunks(
  files: WorldviewFile[] | undefined,
  primaryQuery: string,
  supportingContext = '',
): RetrievedWorldviewChunk[] {
  if (!files || files.length === 0) return [];

  const aliasMap = buildAliasMap(files);
  const primaryTerms = expandAliases(extractQueryTerms(primaryQuery), aliasMap);
  const primarySet = new Set(primaryTerms);
  const supportingTerms = expandAliases(extractQueryTerms(supportingContext), aliasMap)
    .filter((term) => !primarySet.has(term));
  const queryTerms = [...new Set([...primaryTerms, ...supportingTerms])];
  const documents: Array<RetrievedWorldviewChunk & { normalized: string; opening: string; tokens: string[]; frequencies: Map<string, number> }> = [];

  files.forEach((file, fileIndex) => {
    const filename = file.filename.toLocaleLowerCase();
    splitIntoChunks(file.content).forEach((content, chunkIndex) => {
      const normalized = content.toLocaleLowerCase();
      const opening = normalized.slice(0, 180);
      const tokens = tokenize(`${filename} ${content}`);
      const frequencies = new Map<string, number>();
      tokens.forEach((token) => frequencies.set(token, (frequencies.get(token) ?? 0) + 1));
      documents.push({ filename: file.filename, content, score: 0, fileIndex, chunkIndex, normalized, opening, tokens, frequencies });
    });
  });

  const averageLength = documents.reduce((sum, document) => sum + document.tokens.length, 0) / Math.max(1, documents.length);
  const documentFrequency = new Map<string, number>();
  for (const term of queryTerms) {
    documentFrequency.set(term, documents.filter((document) => document.frequencies.has(term)).length);
  }

  for (const document of documents) {
    const filename = document.filename.toLocaleLowerCase();
    for (const term of queryTerms) {
      const frequency = document.frequencies.get(term) ?? 0;
      const frequencyInCorpus = documentFrequency.get(term) ?? 0;
      const inverseDocumentFrequency = Math.log(1 + (documents.length - frequencyInCorpus + 0.5) / (frequencyInCorpus + 0.5));
      const lengthNormalization = frequency + BM25_K1 * (1 - BM25_B + BM25_B * document.tokens.length / Math.max(1, averageLength));
      const bm25 = frequency > 0 ? inverseDocumentFrequency * (frequency * (BM25_K1 + 1)) / lengthNormalization : 0;
      const weight = primarySet.has(term) ? 3 : 1;
      document.score += bm25 * weight;
      if (filename.includes(term)) document.score += primarySet.has(term) ? 12 : 4;
      if (document.opening.includes(term)) document.score += primarySet.has(term) ? 5 : 1.5;
      if (document.normalized.includes(term)) document.score += primarySet.has(term) ? 1 : 0.25;
    }
  }

  const candidates: RetrievedWorldviewChunk[] = documents;

  candidates.sort((a, b) =>
    b.score - a.score
    || a.fileIndex - b.fileIndex
    || a.chunkIndex - b.chunkIndex
  );

  const selected: RetrievedWorldviewChunk[] = [];
  const perFileCount = new Map<number, number>();
  let remaining = LOREKEEPER_PACKET_CHARS;

  for (const candidate of candidates) {
    if (selected.length >= MAX_RETRIEVED_CHUNKS || remaining <= 0) break;
    if ((perFileCount.get(candidate.fileIndex) ?? 0) >= MAX_CHUNKS_PER_FILE) continue;
    if ((perFileCount.get(candidate.fileIndex) ?? 0) >= 1 && candidate.score <= 0) continue;

    const content = candidate.content.length > remaining
      ? `${candidate.content.slice(0, Math.max(0, remaining - 12)).trim()}… (일부 생략)`
      : candidate.content;
    if (!content) continue;

    selected.push({ ...candidate, content });
    perFileCount.set(candidate.fileIndex, (perFileCount.get(candidate.fileIndex) ?? 0) + 1);
    remaining -= content.length;
  }

  return selected;
}

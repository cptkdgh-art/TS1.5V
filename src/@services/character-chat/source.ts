import type {
  Character,
  CharacterChatCandidate,
  CharacterChatPersona,
  CharacterChatSource,
  Novel,
  PersonaField,
  Series,
} from '@core/types';
import { DEFAULT_CHARACTER_CHAT_MODEL } from './constants';

const sourceField = (value = ''): PersonaField => ({ value, origin: 'source' });

export function createNovelChatSource(
  novel: Novel,
  series: Series | null,
  requestedChapterCount: number
): CharacterChatSource {
  const chapterCount = novel.chapters.length;
  const knowledgeChapterCount = Math.max(0, Math.min(requestedChapterCount, chapterCount));
  const chapters = novel.chapters.slice(0, knowledgeChapterCount);
  const text = chapters
    .map((chapter, index) => `[${chapter.title || `${index + 1}화`}]\n${chapter.content}`)
    .join('\n\n');
  const isFullCanon = knowledgeChapterCount >= chapterCount;
  const worldviewFiles = [...(series?.worldviewFiles || []), ...(novel.worldviewFiles || [])]
    .filter((file, index, files) => files.findIndex((candidate) => (
      candidate.filename === file.filename && candidate.content === file.content
    )) === index);

  return {
    id: crypto.randomUUID(),
    type: 'novel',
    title: novel.title,
    text,
    worldview: isFullCanon
      ? worldviewFiles.map((file) => `[${file.filename}]\n${file.content}`).join('\n\n')
      : '',
    novelId: novel.id,
    seriesId: series?.id,
    sourceChapterCount: chapterCount,
    knowledgeChapterCount,
    isFullCanon,
    createdAt: Date.now(),
  };
}

export function createTextChatSource(title: string, text: string): CharacterChatSource {
  return {
    id: crypto.randomUUID(),
    type: 'text',
    title: title.trim() || '외부 원고',
    text: text.trim(),
    worldview: '',
    sourceChapterCount: 0,
    knowledgeChapterCount: 0,
    isFullCanon: true,
    createdAt: Date.now(),
  };
}

export function createManualChatSource(): CharacterChatSource {
  return {
    id: crypto.randomUUID(),
    type: 'manual',
    title: '직접 만든 캐릭터',
    text: '',
    worldview: '',
    sourceChapterCount: 0,
    knowledgeChapterCount: 0,
    isFullCanon: true,
    createdAt: Date.now(),
  };
}

export function registeredCharacterToCandidate(character: Character, isFullCanon: boolean): CharacterChatCandidate {
  return {
    id: crypto.randomUUID(),
    sourceCharacterId: character.id,
    name: character.name,
    aliases: [],
    role: '',
    personality: character.personality,
    speakingStyle: '',
    values: '',
    behaviorRules: '',
    appearance: character.appearance,
    background: isFullCanon ? character.background : '',
    storyContext: isFullCanon ? character.log : '',
    confidence: 'registered',
  };
}

export function candidateToPersona(
  source: CharacterChatSource,
  candidate: CharacterChatCandidate
): CharacterChatPersona {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    sourceId: source.id,
    sourceCharacterId: candidate.sourceCharacterId,
    name: candidate.name,
    role: sourceField(candidate.role),
    personality: sourceField(candidate.personality),
    speakingStyle: sourceField(candidate.speakingStyle),
    values: sourceField(candidate.values),
    behaviorRules: sourceField(candidate.behaviorRules),
    appearance: sourceField(candidate.appearance),
    background: sourceField(candidate.background),
    forbiddenTopics: sourceField(''),
    storyContext: sourceField(candidate.storyContext),
    worldContext: sourceField(source.worldview),
    greeting: sourceField(''),
    aliases: candidate.aliases,
    defaultModel: DEFAULT_CHARACTER_CHAT_MODEL,
    createdAt: now,
    updatedAt: now,
  };
}

export function getNovelSourceCharacters(novel: Novel, series: Series | null): Character[] {
  const characters = [...(series?.characters || []), ...novel.characters];
  return characters.filter((character, index) => characters.findIndex((candidate) => (
    candidate.id === character.id
    || candidate.name.trim().toLowerCase() === character.name.trim().toLowerCase()
  )) === index);
}

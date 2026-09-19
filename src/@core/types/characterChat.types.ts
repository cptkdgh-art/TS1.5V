export type CharacterChatSourceType = 'novel' | 'text' | 'manual';

export type CharacterChatModel =
  | 'gemini-3.8-flash'
  | 'gemini-3.7-flash'
  | 'gemini-3-flash-preview'
  | 'gemini-3.6-flash'
  | 'gemini-2.5-flash'
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-flash-lite'
  | 'gemini-2.5-pro'
  | 'gemini-3.1-pro-preview';

export type PersonaFieldOrigin = 'source' | 'ai' | 'user';

export type CharacterChatEmotion =
  | 'neutral'
  | 'warm'
  | 'happy'
  | 'shy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'tense';

export type CharacterChatMessageBlockType = 'narration' | 'dialogue';

export interface CharacterChatMessageBlock {
  type: CharacterChatMessageBlockType;
  text: string;
}

export interface PersonaField {
  value: string;
  origin: PersonaFieldOrigin;
}

export type CharacterChatPersonaField =
  | 'role'
  | 'personality'
  | 'speakingStyle'
  | 'values'
  | 'behaviorRules'
  | 'appearance'
  | 'background'
  | 'forbiddenTopics'
  | 'storyContext'
  | 'worldContext'
  | 'greeting';

export interface CharacterChatSource {
  id: string;
  type: CharacterChatSourceType;
  title: string;
  text: string;
  worldview: string;
  novelId?: string;
  seriesId?: string;
  sourceChapterCount: number;
  knowledgeChapterCount: number;
  isFullCanon: boolean;
  createdAt: number;
}

export interface CharacterChatPersona {
  id: string;
  sourceId: string;
  sourceCharacterId?: string;
  name: string;
  role: PersonaField;
  personality: PersonaField;
  speakingStyle: PersonaField;
  values: PersonaField;
  behaviorRules: PersonaField;
  appearance: PersonaField;
  background: PersonaField;
  forbiddenTopics: PersonaField;
  storyContext: PersonaField;
  worldContext: PersonaField;
  greeting: PersonaField;
  aliases: string[];
  portrait?: string;
  backgroundImage?: string;
  defaultModel: CharacterChatModel;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterChatUserPersona {
  id: string;
  name: string;
  role: string;
  personality: string;
  speakingStyle: string;
  background: string;
  goal: string;
  portrait?: string;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterChatCandidate {
  id: string;
  sourceCharacterId?: string;
  name: string;
  aliases: string[];
  role: string;
  personality: string;
  speakingStyle: string;
  values: string;
  behaviorRules: string;
  appearance: string;
  background: string;
  storyContext: string;
  confidence: 'registered' | 'high' | 'medium';
}

export interface CharacterChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  blocks?: CharacterChatMessageBlock[];
  emotion?: CharacterChatEmotion;
  createdAt: number;
  editedAt?: number;
  isPinned?: boolean;
}

export interface CharacterChatSession {
  id: string;
  personaId: string;
  title: string;
  model: CharacterChatModel;
  /** 대화 시작 시 복사한 사용자 역할. 이후 원본 수정의 영향을 받지 않는다. */
  userPersona?: CharacterChatUserPersona;
  messages: CharacterChatMessage[];
  memorySummary: string;
  summarizedMessageCount: number;
  affinity: number;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterChatBackupData {
  schemaVersion: 2;
  sources: CharacterChatSource[];
  personas: CharacterChatPersona[];
  userPersonas: CharacterChatUserPersona[];
  sessions: CharacterChatSession[];
}

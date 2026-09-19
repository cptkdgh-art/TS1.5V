import type { Content } from '@google/genai';
import type { AuthorIdentityCore } from './author.types';

export type DirectorClioReadMode = 'overview' | 'recent' | 'full';

export interface DirectorAuthorProposalDraft {
  schemaVersion: 2;
  name: string;
  specialty: string;
  writingStyle: string;
  coreDirectives: string;
  tags: string[];
  identityCore: AuthorIdentityCore;
}

/** 가져오기 전용. 초기 총괄감독이 저장하던 얕은 작가 제안 형식이다. */
export interface LegacyDirectorAuthorProposalDraft {
  schemaVersion?: 1;
  name: string;
  specialty: string;
  writingStyle: string;
  coreDirectives: string;
  tags: string[];
}

export interface DirectorAuthorProposal extends DirectorAuthorProposalDraft {
  id: string;
  createdAt: number;
  afterMessageIndex: number;
  sourceNovelId: string | null;
  createdAuthorId?: string;
  assignedNovelId?: string;
}

export interface DirectorClioSession {
  novelId: string | null;
  history: Content[];
  authorProposals?: DirectorAuthorProposal[];
  summary?: string;
  readMode: DirectorClioReadMode;
  updatedAt: number;
}

export interface DirectorClioBackupData {
  schemaVersion: 1;
  memories: string[];
  sessions: Record<string, DirectorClioSession>;
  activeNovelId: string | null;
  legacyMigrationCompleted?: boolean;
}

export interface DirectorNovelReference {
  id: string;
  displayId: string;
  title: string;
  seriesId: string | null;
  seriesTitle: string;
  volumeNumber: number | null;
  chapterCount: number;
  authorId: string | null;
  authorName: string;
}

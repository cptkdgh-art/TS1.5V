/**
 * ============================================================
 * @module core/types/author
 * @file author.types.ts
 * ============================================================
 * @description AI 작가 관련 타입 정의
 * ============================================================
 */

import type { Content } from '@google/genai';

export interface AuthorConviction {
  /** 작가가 문학과 인간에 관해 믿는 것 */
  belief: string;
  /** 그 믿음이 장면과 서술의 선택에 미치는 영향 */
  creativeEffect: string;
  /** 믿음을 단순한 규칙으로 굳히지 않게 하는 의심이나 반례 */
  doubt: string;
}

export interface AuthorTaste {
  drawnTo: string[];
  avoids: string[];
  emotionalTexture: string;
}

export interface AuthorTension {
  valueA: string;
  valueB: string;
  unresolvedReason: string;
}

/**
 * 작품 배정과 무관하게 유지되는 작가의 정체성 코어.
 * 작품 ID, 회차 경험, 독자 반응 같은 작품별 적응은 이 구조에 넣지 않는다.
 */
export interface AuthorIdentityCore {
  schemaVersion: 1;
  coreId: string;
  versionId: string;
  selfDefinition: string;
  reasonToWrite: string;
  worldview: string;
  viewOfHumanity: string;
  literaryValues: AuthorConviction[];
  aestheticTaste: AuthorTaste;
  innerContradictions: AuthorTension[];
  recurringQuestions: string[];
  readerRelationship: string;
  creativeEthics: string;
  narrativeInstincts: string[];
  voiceOrigins: string;
  readabilityPractice: string;
  plausibilityPractice: string;
  createdAt: number;
  updatedAt: number;
}

export interface AuthorProfileVersion {
  id: string;
  createdAt: number;
  name: string;
  specialty: string;
  writingStyle: string;
  coreDirectives: string;
  tags: string[];
  identityCore?: AuthorIdentityCore;
}

/** AI 작가 */
export interface AiAuthor {
  id: string;
  name: string;
  specialty: string;
  writingStyle: string;
  coreDirectives: string;
  createdAt: number;
  memoryCache?: string[];
  metaChatHistory?: Content[];
  generalChatHistory?: Content[];
  tags?: string[];
  isDefault?: boolean;
  role?: 'Co-Developer';
  /** @deprecated 총괄감독 클리오 전용 저장소로 이전된 구버전 호환 필드 */
  directorChatHistory?: Content[];
  /** @deprecated 총괄감독 클리오 전용 저장소로 이전된 구버전 호환 필드 */
  directorChatSummary?: string;
  profileVersions?: AuthorProfileVersion[];
  /** 작품과 무관하게 유지되는 작가의 내면, 작품관, 문체의 원인 */
  identityCore?: AuthorIdentityCore;
}

/** 복제된 작가 상세 (부분 타입) */
export type ClonedAuthorDetails = Partial<Omit<AiAuthor, 'id' | 'createdAt'>>;

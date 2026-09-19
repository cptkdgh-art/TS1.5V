/**
 * ============================================================
 * @module core/types/context
 * @file context.types.ts
 * ============================================================
 * @description 문맥 관리 및 캐싱 관련 타입 정의
 * ============================================================
 */

/** 화별 구조화 요약 항목 */
export interface SummaryEntry {
  chapterId: string;       // 원본 챕터 ID
  chapterNumber: number;   // 화수
  chapterTitle: string;    // 원본 챕터 제목
  summary: string;         // 해당 화 요약
  timestamp: number;       // 생성/수정 시간
  chapterSignature?: string; // 요약 시점의 챕터 서명 (수정 감지용)
}

/** 요약 변경 이정표 (수정/삭제 추적) */
export interface SummaryMilestone {
  id: string;
  timestamp: number;
  type: 'created' | 'incremental' | 'regenerated' | 'chapter_deleted' | 'chapter_edited' | 'manual_edit';
  description: string;
  affectedChapterIds?: string[];
}

export type SummaryRollupLevel = 'episode' | 'volume';

/** 화별 요약에서 재생성 가능한 파생 기억. 원본 SummaryEntry는 항상 별도로 보존한다. */
export interface SummaryRollup {
  id: string;
  level: SummaryRollupLevel;
  startChapterNumber: number;
  endChapterNumber: number;
  sourceChapterIds: string[];
  sourceSignature: string;
  content: string;
  createdAt: number;
}

/** 문맥 요약 */
export interface ContextSummary {
  content: string;
  summarizedChapters: number;
  createdAt: number;
  /** 체크포인트: 이 요약이 기반한 챕터 ID 목록 */
  coveredChapterIds?: string[];
  /** 체크포인트: 요약 대상 챕터들의 내용 서명 (변경 감지) */
  contentSignature?: string;
  /** 구조화된 화별 요약 */
  entries?: SummaryEntry[];
  /** 긴 작품에서만 사용하는 에피소드·권 단위 파생 요약 */
  rollups?: SummaryRollup[];
  /** 변경 이정표 (수정/삭제 기록) */
  milestones?: SummaryMilestone[];
  /** 재확인 필요 플래그 (삭제/수정 후 true) */
  needsRecheck?: boolean;
}

/** 문맥 관리 설정 */
export interface ContextManagement {
  isEnabled: boolean;
  /** 이전 백업 호환용. 런타임은 고정된 최근 원문 계약을 사용한다. */
  fullTextChapters: number;
  summaryTriggerChapters: number; // 자동 요약을 한 번에 묶어 처리할 과거 챕터 수
}

/** 캐시된 모델 정보 */
export interface CachedModelInfo {
  cacheName: string; // Google Cache Resource Name
  createTime: string; // ISO string
  expireTime: string; // ISO string
  cachedChapterCount: number; // 몇 화까지 캐싱했는지
  cachedTokenCount: number; // 캐싱된 토큰 수
  contentSignature: string; // 내용 변경 감지용 해시/서명
}

/** 문맥 캐싱 설정 */
export interface ContextCachingConfig {
  isEnabled: boolean; // 사용자가 껐다 켤 수 있는 스위치
  activeBufferWindow: number; // 이전 저장본 호환 필드. 런타임에서는 최신 3화로 고정한다.
  caches: {
    [modelName: string]: CachedModelInfo; // 모델명(gemini-3-flash 등)을 키로 사용
  };
}

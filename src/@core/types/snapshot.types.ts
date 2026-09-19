/**
 * ============================================================
 * @module core/types/snapshot
 * @file snapshot.types.ts
 * ============================================================
 * @description 스냅샷(버전 관리) 관련 타입 정의
 * ============================================================
 */

import type { Novel } from './novel.types';

/** 소설 스냅샷 */
export interface Snapshot {
  id: string;
  createdAt: number;
  description: string;
  novelData: Omit<Novel, 'snapshots'>;
  /** 직접 만든 스냅샷과 파괴적 작업 전 자동 복구본을 구분한다. */
  kind?: 'manual' | 'auto-recovery';
  /** 복구본을 만든 작업과 당시 회차 경계. */
  recoveryMeta?: {
    operation: 'rollback' | 'delete';
    targetChapterId?: string;
    targetChapterNumber: number;
    chapterCountBefore: number;
  };
}

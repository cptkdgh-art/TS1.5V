export type CanonFactKind =
  | 'character-state'
  | 'relationship'
  | 'possession'
  | 'secret'
  | 'location'
  | 'world-rule'
  | 'other';

export type CanonFactStatus = 'confirmed' | 'draft';

/** 회차 ID와 개정 번호를 출처로 삼는 시간축 사실 장부. */
export interface CanonFact {
  id: string;
  kind: CanonFactKind;
  subject: string;
  value: string;
  sourceChapterId?: string;
  sourceRevision?: number;
  validFromChapterId?: string;
  /** 이 회차부터 비활성으로 본다. */
  validUntilChapterId?: string;
  status: CanonFactStatus;
  locked: boolean;
  supersedesFactId?: string;
  createdAt: number;
  updatedAt: number;
}

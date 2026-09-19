/**
 * ============================================================
 * @module core/types/foreshadowing
 * @file foreshadowing.types.ts
 * ============================================================
 * @description 개연성 중심 복선(떡밥) 관리 타입 정의
 *
 * 설계 철학:
 * - 복선은 단순한 "숨겨둔 정보"가 아니라 "인과관계의 씨앗"
 * - 모든 복선은 회수될 때 "그래서 그랬구나"라는 납득을 제공해야 함
 * - 장편 소설에서 복선의 생명주기와 호흡 조절이 핵심
 * ============================================================
 */

/** 복선의 긴급도 - 회수까지 남은 서사적 거리 */
export type ForeshadowingUrgency =
  | 'immediate'  // 1-3화 내 회수 필요 (미니 떡밥)
  | 'short'      // 5-10화 내 회수 (단기 복선)
  | 'medium'     // 한 권 내 회수 (중기 복선)
  | 'long'       // 다음 권 이후 회수 (장기 복선)
  | 'series';    // 시리즈 완결 시 회수 (대서사 복선)

/** 복선의 유형 - AI가 인식할 패턴 */
export type ForeshadowingType =
  | 'chekhov_gun'      // 체호프의 총: 등장한 요소는 반드시 사용됨
  | 'character_secret' // 인물의 숨겨진 과거/정체
  | 'prophecy'         // 예언/암시: 미래 사건의 힌트
  | 'mystery'          // 미스터리: 풀어야 할 수수께끼
  | 'relationship'     // 관계 복선: 인물 간 숨겨진 연결
  | 'worldview'        // 세계관 복선: 설정의 숨겨진 진실
  | 'symbolic'         // 상징적 복선: 반복되는 모티프/이미지
  | 'red_herring';     // 훼이크: 독자를 속이기 위한 의도적 오도

/** 복선 상태 */
export type ForeshadowingStatus =
  | 'planted'         // 심어짐 (아직 회수 안됨)
  | 'hinted'          // 힌트 제공됨 (부분적 노출)
  | 'partially_paid'  // 부분 회수 (일부만 밝혀짐)
  | 'fully_paid'      // 완전 회수
  | 'abandoned';      // 폐기됨 (의도적으로 회수 안함)

/** 복선 하나의 정의 */
export interface Foreshadowing {
  id: string;

  // 기본 정보
  name: string;           // 복선 이름 (예: "검은 반지의 비밀")
  description: string;    // 복선 내용 설명
  type: ForeshadowingType;
  urgency: ForeshadowingUrgency;
  status: ForeshadowingStatus;

  // 개연성 관리 (핵심)
  causality: {
    premise: string;      // 전제: 왜 이 복선이 심어졌는가
    implication: string;  // 함의: 회수 시 독자가 납득할 논리
    consequence: string;  // 결과: 회수 후 스토리에 미치는 영향
  };

  // 위치 추적
  plantedAt: {
    chapterIndex: number;
    briefContext: string; // 어떤 장면에서 심어졌는지
  };

  hints: Array<{
    chapterIndex: number;
    hint: string;         // 어떤 힌트가 주어졌는지
  }>;

  payoff?: {
    chapterIndex: number;
    resolution: string;   // 어떻게 회수되었는지
    readerImpact: string; // 독자에게 주는 감정/인상
  };

  // 연결된 요소들
  linkedCharacterIds: string[];  // 관련 인물
  linkedForeshadowingIds: string[]; // 연결된 다른 복선

  // AI 작가용 지침
  aiGuidance: {
    doHint: string[];     // 힌트 줄 때 이렇게 하세요
    dontReveal: string[]; // 이것은 아직 밝히지 마세요
    payoffTiming: string; // 언제 회수하면 좋을지 가이드
  };

  // 메타데이터
  createdAt: number;
  updatedAt: number;
  importance: 1 | 2 | 3 | 4 | 5; // 중요도 (5가 가장 중요)

  // 본문 추적용 키워드 (API 없이 로컬 체크)
  trackingKeywords?: string[]; // 복선이 설치된 문장의 핵심 키워드들
}

/** 복선 관리 시스템 전체 */
export interface ForeshadowingSystem {
  // 모든 복선 목록
  items: Foreshadowing[];

  // 호흡 조절 가이드
  pacingGuide: {
    currentTension: number;        // 현재 긴장도 (0-100)
    plantedCount: number;          // 심어진 복선 수
    awaitingPayoffCount: number;   // 회수 대기 중인 복선 수

    // AI에게 주는 호흡 가이드
    recommendation:
      | 'plant_more'        // 복선을 더 심어야 함
      | 'give_hints'        // 힌트를 좀 더 줘야 함
      | 'payoff_soon'       // 곧 회수해야 할 복선 있음
      | 'balanced';         // 현재 균형 잡힘

    urgentPayoffs: string[]; // 긴급하게 회수해야 할 복선 ID들
  };

  // 개연성 체크 결과
  coherenceCheck?: {
    lastCheckedAt: number;
    issues: Array<{
      foreshadowingId: string;
      issue: string;      // 개연성 문제점
      suggestion: string; // 해결 제안
    }>;
    overallScore: number; // 전체 개연성 점수 (0-100)
  };
}

/** AI 복선 분석 결과 */
export interface ForeshadowingAnalysisResult {
  // 현재 텍스트에서 발견된 잠재적 복선
  detectedForeshadowings: Array<{
    excerpt: string;      // 해당 텍스트 발췌
    suggestedName: string;
    suggestedType: ForeshadowingType;
    suggestedUrgency: ForeshadowingUrgency;
    reason: string;       // 왜 이것이 복선으로 보이는지
  }>;

  // 기존 복선 중 힌트/회수된 것
  progressedForeshadowings: Array<{
    foreshadowingId: string;
    newStatus: 'hinted' | 'partially_paid' | 'fully_paid';
    evidence: string;     // 어떤 부분이 힌트/회수인지
  }>;

  // 개연성 경고
  coherenceWarnings: Array<{
    type: 'forgotten' | 'rushed' | 'contradicted' | 'overdue';
    foreshadowingId?: string;
    message: string;
    suggestion: string;
  }>;

  // 호흡 조절 제안
  pacingSuggestion: string;
}

/** AI 프롬프트에 주입할 복선 컨텍스트 */
export interface ForeshadowingContext {
  // 현재 활성화된 복선들 (AI가 알아야 할 것)
  activeForeshadowings: Array<{
    name: string;
    type: ForeshadowingType;
    status: ForeshadowingStatus;
    urgency: ForeshadowingUrgency;
    aiGuidance: Foreshadowing['aiGuidance'];
  }>;

  // 호흡 가이드
  pacingInstruction: string;

  // 회수 예정인 복선 (이번 챕터에서 회수 고려)
  payoffCandidates: string[];

  // 절대 하지 말아야 할 것
  prohibitions: string[];
}

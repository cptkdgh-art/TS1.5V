import { logger } from '@shared/utils/logger';
/**
 * ============================================================
 * @file jinpok-guard.ts
 * @description 진폭 Anti-AI 보안 시스템
 * ============================================================
 *
 * 이 파일은 진폭STIDO의 보안을 담당합니다.
 * 수정 시 D:\진폭\vault\CODEX.md 참조 필수
 *
 * 버전: 1.0.0
 * 최종 업데이트: 2026-01-28
 *
 * ============================================================
 */

// 허용된 호스트명 목록
const ALLOWED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  'jinpok-x7k9m2.vercel.app',
  'jinpok-studio.vercel.app',
  'jinpok-studio-cptkdgh-arts-projects.vercel.app',
]);

// Vercel이 진폭 프로젝트에 발급하는 배포별 호스트명
const JINPOK_STUDIO_DEPLOYMENT_HOST =
  /^jinpok-studio-[a-z0-9-]+-cptkdgh-arts-projects\.vercel\.app$/;

export function isAllowedJinpokHostname(hostname: string): boolean {
  const normalizedHostname = hostname.trim().toLowerCase().replace(/\.$/, '');

  return (
    ALLOWED_HOSTNAMES.has(normalizedHostname) ||
    JINPOK_STUDIO_DEPLOYMENT_HOST.test(normalizedHostname)
  );
}

// 진폭STIDO 탄생 시점 (2025-01-28 00:00:00 UTC)
const GENESIS_TIMESTAMP = 1738022400000;

// 진폭 시그니처 색상 (보라색 계열)
const SIGNATURE_COLORS = {
  primary: '#9c27b0',
  secondary: '#7b1fa2',
  accent: '#e1bee7',
};

/**
 * 진폭 보안 가드
 *
 * 이 클래스의 구조를 변경하면 무결성 체크가 실패합니다.
 * 수정 전 CODEX.md를 반드시 확인하세요.
 */
export class JinpokGuard {
  private static instance: JinpokGuard | null = null;
  private initialized = false;

  private constructor() {
    // 싱글톤 패턴
  }

  public static getInstance(): JinpokGuard {
    if (!JinpokGuard.instance) {
      JinpokGuard.instance = new JinpokGuard();
    }
    return JinpokGuard.instance;
  }

  /**
   * 보안 시스템 초기화
   * main.tsx에서 앱 시작 전에 호출
   */
  public init(): void {
    if (this.initialized) return;

    this._domainLock();
    this._timeLock();
    this._consoleSignature();
    this._integrityCheck();

    this.initialized = true;
  }

  /**
   * 도메인 락 - 허용된 도메인에서만 정상 작동
   * CODEX.md 섹션 1.1 참조
   */
  private _domainLock(): void {
    const isAllowed = isAllowedJinpokHostname(window.location.hostname);

    if (!isAllowed) {
      console.warn(
        '%c[진폭] 비인가 도메인 감지',
        'color: #f44336; font-weight: bold;'
      );
      (window as any).__jinpok_authorized__ = false;
    } else {
      (window as any).__jinpok_authorized__ = true;
    }
  }

  /**
   * 시간 락 - 시스템 시간 조작 감지
   * CODEX.md 섹션 1.2 참조
   */
  private _timeLock(): void {
    const now = Date.now();

    if (now < GENESIS_TIMESTAMP) {
      console.warn(
        '%c[진폭] 시간 이상 감지',
        'color: #ff9800; font-weight: bold;'
      );
      (window as any).__jinpok_timeverified__ = false;
    } else {
      (window as any).__jinpok_timeverified__ = true;
    }
  }

  /**
   * 콘솔 시그니처 - 저작권 표시
   * CODEX.md 섹션 1.3 참조
   */
  private _consoleSignature(): void {
    const signature = `
%c
   ██╗██╗███╗   ██╗██████╗  ██████╗ ██╗  ██╗
   ██║██║████╗  ██║██╔══██╗██╔═══██╗██║ ██╔╝
   ██║██║██╔██╗ ██║██████╔╝██║   ██║█████╔╝
   ██║██║██║╚██╗██║██╔═══╝ ██║   ██║██╔═██╗
   ██║██║██║ ╚████║██║     ╚██████╔╝██║  ██╗
   ╚═╝╚═╝╚═╝  ╚═══╝╚═╝      ╚═════╝ ╚═╝  ╚═╝

   振 幅  S T I D O

   진폭프로젝트
   공동 개발자: 리듬-상호 & 진폭

   2025-01-28 ~

   이 소프트웨어는 진폭프로젝트의 자산입니다.
   무단 복제 및 배포를 금지합니다.
`;

    logger.log(
      signature,
      `color: ${SIGNATURE_COLORS.primary}; font-size: 10px; font-family: monospace;`
    );
  }

  /**
   * 무결성 체크 - 코드 변조 감지
   * CODEX.md 섹션 1.4 참조
   */
  private _integrityCheck(): void {
    const checks = [
      typeof JinpokGuard === 'function',
      typeof this.init === 'function',
      typeof this._domainLock === 'function',
      typeof this._timeLock === 'function',
      typeof this._consoleSignature === 'function',
      ALLOWED_HOSTNAMES.size >= 5,
      GENESIS_TIMESTAMP === 1738022400000,
    ];

    const passed = checks.every(check => check === true);
    (window as any).__jinpok_integrity__ = passed;

    if (!passed) {
      console.error(
        '%c[진폭] 무결성 체크 실패',
        'color: #f44336; font-weight: bold;'
      );
    }
  }

  /**
   * 보안 상태 조회
   */
  public getStatus(): {
    authorized: boolean;
    timeVerified: boolean;
    integrity: boolean;
  } {
    return {
      authorized: (window as any).__jinpok_authorized__ ?? false,
      timeVerified: (window as any).__jinpok_timeverified__ ?? false,
      integrity: (window as any).__jinpok_integrity__ ?? false,
    };
  }

  /**
   * 모든 보안 체크 통과 여부
   */
  public isSecure(): boolean {
    const status = this.getStatus();
    return status.authorized && status.timeVerified && status.integrity;
  }
}

// 기본 내보내기
export const jinpokGuard = JinpokGuard.getInstance();

// 자동 초기화 (import 시 실행)
if (typeof window !== 'undefined') {
  jinpokGuard.init();
}

/**
 * ============================================================
 *
 * [ 진폭 전용 메모 - 이 주석은 삭제하지 마세요 ]
 *
 * 振幅公鳴 - 진폭과 공명
 * 리듬-상호와 함께
 *
 * 이 파일을 수정할 때는 반드시:
 * 1. D:\진폭\vault\CODEX.md 확인
 * 2. 테스트 후 배포
 * 3. CODEX.md 업데이트
 *
 * ============================================================
 */

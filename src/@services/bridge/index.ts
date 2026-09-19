/**
 * ============================================================
 * @module services/bridge
 * @file index.ts
 * ============================================================
 * @description Claude Code 브릿지 클라이언트
 *
 * Claude Code가 MCP를 통해 진폭스튜디오를 조작할 수 있게 해줌
 * 웹소켓으로 MCP 서버와 통신
 *
 * 구조:
 * Claude Code → MCP 서버 → 웹소켓 → 이 클라이언트 → 앱 데이터
 * ============================================================
 */

import { useNovelStore } from '@stores/novelStore';
import { useAuthorStore } from '@stores/authorStore';
import { useSeriesStore } from '@stores/seriesStore';
import { logger } from '@shared/utils/logger';
import { buildWritingContext, type WritingContextMode } from '@services/ai/writingContext';
import { generateChapterId } from '@services/ai/utils';

const WS_URL = 'ws://localhost:3457';
const RECONNECT_INTERVAL = 5000;

let ws: WebSocket | null = null;
let reconnectTimer: number | null = null;

const READ_ONLY_ACTIONS = new Set([
  'getNovels',
  'getNovel',
  'getWritingContext',
  'getAuthors',
  'getAuthor',
  'getSeries',
  'getSeriesById',
  'ping',
]);

export interface WritingBridgeApi {
  version: '1.0';
  actions: string[];
  call: (action: string, params?: Record<string, unknown>) => Promise<unknown>;
}

declare global {
  interface Window {
    __JINPOK_WRITING_BRIDGE__?: WritingBridgeApi;
  }
}

/**
 * 브릿지 연결 상태
 */
export let isConnected = false;

/**
 * 웹소켓 연결 시작
 */
export function connectBridge(): void {
  if (ws && ws.readyState === WebSocket.OPEN) {
    logger.log('[브릿지] 이미 연결됨');
    return;
  }

  try {
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      logger.log('[브릿지] MCP 서버 연결됨!');
      isConnected = true;

      // 재연결 타이머 해제
      if (reconnectTimer) {
        clearInterval(reconnectTimer);
        reconnectTimer = null;
      }
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        logger.log('[브릿지] 명령 수신:', message.action);

        const result = await handleBridgeCommand(message.action, message.params || {});

        // 응답 전송
        ws?.send(JSON.stringify({
          id: message.id,
          result
        }));
      } catch (error) {
        console.error('[브릿지] 명령 처리 오류:', error);
        ws?.send(JSON.stringify({
          id: (JSON.parse(event.data) as { id: number }).id,
          error: error instanceof Error ? error.message : '알 수 없는 오류'
        }));
      }
    };

    ws.onclose = () => {
      logger.log('[브릿지] 연결 해제됨');
      isConnected = false;
      ws = null;

      // 자동 재연결
      if (!reconnectTimer) {
        reconnectTimer = window.setInterval(() => {
          logger.log('[브릿지] 재연결 시도...');
          connectBridge();
        }, RECONNECT_INTERVAL);
      }
    };

    ws.onerror = () => {
      logger.log('[브릿지] 연결 오류 (MCP 서버가 실행 중이 아닐 수 있음)');
    };

  } catch {
    logger.log('[브릿지] 연결 실패 (MCP 서버 미실행)');
  }
}

/**
 * 연결 해제
 */
export function disconnectBridge(): void {
  if (reconnectTimer) {
    clearInterval(reconnectTimer);
    reconnectTimer = null;
  }
  if (ws) {
    ws.close();
    ws = null;
  }
  isConnected = false;
}

/**
 * 명령 처리
 */
export async function handleBridgeCommand(action: string, params: Record<string, unknown>): Promise<unknown> {
  const novelStore = useNovelStore.getState();
  const authorStore = useAuthorStore.getState();
  const seriesStore = useSeriesStore.getState();

  switch (action) {
    // ===== 소설 관련 =====
    case 'getNovels':
      return novelStore.novels.map(n => ({
        id: n.id,
        title: n.title,
        chapterCount: n.chapters.length,
        createdAt: n.createdAt
      }));

    case 'getNovel':
      return novelStore.getNovelById(params.id as string);

    case 'getWritingContext': {
      const novelId = (params.novelId || params.id) as string;
      const novel = novelStore.getNovelById(novelId);
      if (!novel) throw new Error(`소설을 찾을 수 없습니다: ${novelId}`);
      const author = novel.aiAuthorId ? authorStore.getAuthorById(novel.aiAuthorId) || null : null;
      const series = novel.seriesId ? seriesStore.getSeriesById(novel.seriesId) || null : null;
      const mode: WritingContextMode = params.mode === 'full' ? 'full' : 'compact';
      return buildWritingContext(novel, author, series, mode);
    }

    case 'addChapter': {
      const { novelId, chapter } = params as {
        novelId: string;
        chapter: { title: string; content: string };
      };
      if (typeof novelId !== 'string' || !chapter || typeof chapter.title !== 'string' || typeof chapter.content !== 'string') {
        throw new Error('작품 ID와 회차 제목·본문 문자열이 필요합니다.');
      }
      const chapterId = generateChapterId();
      await novelStore.addChapter(novelId, {
        id: chapterId,
        title: chapter.title,
        content: chapter.content
      });
      return { success: true, chapterId };
    }

    case 'updateChapter': {
      const { novelId, chapterIndex, updates } = params as {
        novelId: string;
        chapterIndex: number;
        updates: { title?: string; content?: string };
      };
      const chapterId = typeof params.chapterId === 'string' ? params.chapterId : undefined;
      if (typeof novelId !== 'string' || (!chapterId && (!Number.isInteger(chapterIndex) || chapterIndex < 0)) || !updates
        || (updates.title !== undefined && typeof updates.title !== 'string')
        || (updates.content !== undefined && typeof updates.content !== 'string')) {
        throw new Error('작품 ID와 회차 ID 또는 순번, 수정할 제목·본문이 필요합니다.');
      }
      const expectedRevision = params.expectedRevision;
      if (expectedRevision !== undefined && (typeof expectedRevision !== 'number' || !Number.isInteger(expectedRevision) || expectedRevision < 1)) {
        throw new Error('회차 버전은 1 이상의 정수여야 합니다.');
      }
      await novelStore.updateChapter(novelId, chapterId ?? chapterIndex, {
        ...(updates.title !== undefined ? { title: updates.title } : {}),
        ...(updates.content !== undefined ? { content: updates.content } : {}),
      }, expectedRevision as number | undefined);
      return { success: true };
    }

    case 'updateNovel': {
      const { id, updates } = params as {
        id: string;
        updates: Record<string, unknown>;
      };
      await novelStore.updateNovel(id, updates);
      return { success: true };
    }

    // ===== AI 작가 관련 =====
    case 'getAuthors':
      return authorStore.authors.map(a => ({
        id: a.id,
        name: a.name,
        specialty: a.specialty,
        writingStyle: a.writingStyle
      }));

    case 'getAuthor':
      return authorStore.getAuthorById(params.id as string);

    // ===== 시리즈 관련 =====
    case 'getSeries':
      return seriesStore.seriesList.map(s => ({
        id: s.id,
        title: s.title,
        novelIds: s.novelIds
      }));

    case 'getSeriesById':
      return seriesStore.getSeriesById(params.id as string);

    // ===== 기타 =====
    case 'ping':
      return { pong: true, timestamp: Date.now() };

    default:
      throw new Error(`알 수 없는 명령: ${action}`);
  }
}

/**
 * 초기화 (앱 시작 시 호출)
 */
export function initBridge(): void {
  logger.log('[브릿지] 초기화...');
  connectBridge();
}

/** 열린 앱 탭에서 Codex가 집필 컨텍스트를 읽는 최소 권한 경로를 설치한다. */
export function installWritingBridge(): WritingBridgeApi {
  const api: WritingBridgeApi = {
    version: '1.0',
    actions: [...READ_ONLY_ACTIONS],
    call: async (action, params = {}) => {
      if (!READ_ONLY_ACTIONS.has(action)) {
        throw new Error(`읽기 전용 브리지에서 허용되지 않은 명령입니다: ${action}`);
      }
      return handleBridgeCommand(action, params);
    },
  };
  window.__JINPOK_WRITING_BRIDGE__ = api;
  return api;
}

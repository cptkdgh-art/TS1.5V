import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiAuthor } from '@core/types';

const storage = new Map<string, unknown>();
vi.mock('@services/storage', () => ({
  STORAGE_KEYS: { DIRECTOR_CLIO: 'director-clio' },
  get: vi.fn(async (key: string) => storage.get(key)),
  set: vi.fn(async (key: string, value: unknown) => storage.set(key, structuredClone(value))),
}));

const { useDirectorClioStore } = await import('./directorClioStore');

describe('directorClioStore', () => {
  beforeEach(() => {
    storage.clear();
    useDirectorClioStore.setState({
      schemaVersion: 1,
      memories: [],
      sessions: {},
      activeNovelId: null,
      legacyMigrationCompleted: false,
      isLoading: false,
      requests: {},
    });
  });

  it('owns requests across modal remounts and rejects replaced session results', async () => {
    const store = useDirectorClioStore.getState();
    const request = store.beginRequest('novel-1');
    expect(request).toBeTruthy();
    expect(useDirectorClioStore.getState().beginRequest('novel-1')).toBeNull();
    await store.updateSession('novel-1', { summary: 'new revision' });
    expect(await store.applyRequest('novel-1', request!, () => ({ summary: 'old' }))).toBe(false);
    store.finishRequest('novel-1', request!);
    const next = store.beginRequest('novel-1')!;
    store.finishRequest('novel-1', request!);
    expect(useDirectorClioStore.getState().requests['novel-1']).toBe(next);
    expect(await store.applyRequest('novel-1', next, () => ({ summary: 'latest' }))).toBe(true);
    store.finishRequest('novel-1', next);
  });

  it('does not resurrect a deleted consultation', async () => {
    const store = useDirectorClioStore.getState();
    const request = store.beginRequest(null)!;
    await store.clearSession(null);
    expect(await store.applyRequest(null, request, () => ({ summary: 'late' }))).toBe(false);
    expect(useDirectorClioStore.getState().sessions.studio).toBeUndefined();
  });

  it('스튜디오 상담과 작품별 상담을 서로 다른 세션에 저장한다', async () => {
    await useDirectorClioStore.getState().updateSession(null, {
      history: [{ role: 'user', parts: [{ text: '전체 전략' }] }],
    });
    await useDirectorClioStore.getState().updateSession('novel-1', {
      history: [{ role: 'user', parts: [{ text: '작품 전략' }] }],
      readMode: 'full',
    });

    const state = useDirectorClioStore.getState();
    expect(state.sessions.studio.history[0].parts?.[0]).toMatchObject({ text: '전체 전략' });
    expect(state.sessions['novel-1'].history[0].parts?.[0]).toMatchObject({ text: '작품 전략' });
    expect(state.sessions['novel-1'].readMode).toBe('full');
    expect(storage.get('director-clio')).toMatchObject({
      activeNovelId: null,
      sessions: {
        studio: { novelId: null },
        'novel-1': { novelId: 'novel-1' },
      },
    });
  });

  it('구버전 총괄감독 대화만 옮기고 기본작가 집필 기억은 가져오지 않는다', async () => {
    const legacyAuthor: AiAuthor = {
      id: 'writer-clio',
      name: '기본작가 클리오',
      specialty: '메타픽션',
      writingStyle: '실험적',
      coreDirectives: '집필한다',
      createdAt: 1,
      memoryCache: ['기본작가만의 집필 기억'],
      directorChatHistory: [{ role: 'user', parts: [{ text: '구버전 감독 대화' }] }],
      directorChatSummary: '구버전 결론',
    };

    await useDirectorClioStore.getState().migrateLegacySession([legacyAuthor]);

    const state = useDirectorClioStore.getState();
    expect(state.sessions.studio.summary).toBe('구버전 결론');
    expect(state.sessions.studio.history[0].parts?.[0]).toMatchObject({ text: '구버전 감독 대화' });
    expect(state.memories).toEqual([]);

    await useDirectorClioStore.getState().clearSession(null);
    await useDirectorClioStore.getState().migrateLegacySession([legacyAuthor]);
    expect(useDirectorClioStore.getState().sessions.studio).toBeUndefined();
  });

  it('작품 세션을 지워도 다른 작품과 공통 기억은 유지한다', async () => {
    await useDirectorClioStore.getState().setMemories(['작가 개성 우선']);
    await useDirectorClioStore.getState().updateSession('novel-1', { summary: '첫 작품' });
    await useDirectorClioStore.getState().updateSession('novel-2', { summary: '둘째 작품' });

    await useDirectorClioStore.getState().clearSession('novel-1');

    const state = useDirectorClioStore.getState();
    expect(state.sessions['novel-1']).toBeUndefined();
    expect(state.sessions['novel-2'].summary).toBe('둘째 작품');
    expect(state.memories).toEqual(['작가 개성 우선']);
  });
});

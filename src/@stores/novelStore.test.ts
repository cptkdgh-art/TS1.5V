import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Novel } from '@core/types';

const storage = new Map<string, unknown>();
vi.mock('@services/storage', () => ({
  STORAGE_KEYS: { NOVELS: 'novels' },
  get: vi.fn(async (key: string) => storage.get(key)),
  set: vi.fn(async (key: string, value: unknown) => storage.set(key, value)),
  getActiveWorkspaceId: vi.fn(() => 'workspace-test'),
  getWorkspaceStorageKey: (_workspaceId: string, key: string) => key,
  getRaw: vi.fn(async (key: string) => storage.get(key)),
  setRaw: vi.fn(async (key: string, value: unknown) => storage.set(key, value)),
  migrateFromLocalStorage: vi.fn(async () => undefined),
}));

const { useNovelStore } = await import('./novelStore');

const makeNovel = (): Novel => ({
  id: 'novel-1',
  title: '테스트 소설',
  subject: '',
  mood: '',
  plotSummary: '',
  chapters: [{ id: 'ch-1', title: '1화', content: '최신 원고' }],
  history: [],
  createdAt: 1,
  aiAuthorId: null,
  characters: [],
});

describe('novelStore mutateNovel', () => {
  beforeEach(() => {
    storage.clear();
    useNovelStore.setState({ novels: [makeNovel()], selectedNovelId: null, isLoading: false });
  });

  it('백그라운드 필드만 갱신하고 최신 챕터는 보존한다', async () => {
    await useNovelStore.getState().mutateNovel('novel-1', (current) => ({
      ...current,
      contextSummary: { content: '요약', summarizedChapters: 1, createdAt: 2 },
    }));

    const updated = useNovelStore.getState().novels[0];
    expect(updated.chapters[0].content).toBe('최신 원고');
    expect(updated.contextSummary?.content).toBe('요약');
    expect(storage.get('novels')).toEqual([updated]);
  });

  it('assigns identity on add and preserves it while revising manuscript content', async () => {
    await useNovelStore.getState().addChapter('novel-1', { title: 'Two', content: 'Original' });
    const created = useNovelStore.getState().novels[0].chapters[1];
    expect(created.id).toEqual(expect.any(String));
    expect(created.trace?.revision).toBe(1);
    await useNovelStore.getState().updateChapter('novel-1', 1, { content: 'Changed', id: 'wrong' });
    const updated = useNovelStore.getState().novels[0].chapters[1];
    expect(updated.id).toBe(created.id);
    expect(updated.trace?.revision).toBe(2);
  });

  it('creates recovery and invalidates source Canon on chapter deletion', async () => {
    await useNovelStore.getState().deleteChapter('novel-1', 0);
    const saved = useNovelStore.getState().novels[0];
    expect(saved.chapters).toHaveLength(0);
    expect(saved.snapshots?.[0].novelData.chapters[0].id).toBe('ch-1');
  });

  it('resolves legacy index callers to a captured ID against reordered persisted chapters', async () => {
    const original = makeNovel();
    const second = { id: 'ch-2', title: 'Two', content: 'Second' };
    useNovelStore.setState({ novels: [{ ...original, chapters: [...original.chapters, second] }] });
    storage.set('novels', [{ ...original, chapters: [second, ...original.chapters] }]);
    const saved = await useNovelStore.getState().updateChapter('novel-1', 0, { content: 'Changed first' });
    expect(saved.chapters.map(ch => [ch.id, ch.content])).toEqual([['ch-2', 'Second'], ['ch-1', 'Changed first']]);
  });

  it('rejects missing targets and stale revisions instead of reporting a successful save', async () => {
    await useNovelStore.getState().updateChapter('novel-1', 'ch-1', { content: 'Revised' }, 1);
    await expect(useNovelStore.getState().updateChapter('novel-1', 'ch-1', { content: 'Stale' }, 1)).rejects.toThrow();
    await expect(useNovelStore.getState().deleteChapter('novel-1', 'ch-1', 1)).rejects.toThrow();
    await expect(useNovelStore.getState().updateChapter('novel-1', 'deleted', { content: 'Stale' })).rejects.toThrow();
    await expect(useNovelStore.getState().addChapter('missing', { title: '', content: '' })).rejects.toThrow();
    expect((storage.get('novels') as Novel[])[0].chapters[0].content).toBe('Revised');
  });

  it('다른 창이 먼저 저장한 최신 목록을 다시 읽고 변경을 합친다', async () => {
    const stale = makeNovel();
    stale.chapters[0].content = '오래된 화면 원고';
    const latest = makeNovel();
    latest.chapters[0].content = '다른 창의 최신 원고';
    const otherNovel = { ...makeNovel(), id: 'novel-2', title: '다른 작품' };
    useNovelStore.setState({ novels: [stale], selectedNovelId: null, isLoading: false });
    storage.set('novels', [latest, otherNovel]);

    await useNovelStore.getState().mutateNovel('novel-1', (current) => ({
      ...current,
      contextSummary: { content: '새 요약', summarizedChapters: 1, createdAt: 2 },
    }));

    const saved = storage.get('novels') as Novel[];
    expect(saved).toHaveLength(2);
    expect(saved[0].chapters[0].content).toBe('다른 창의 최신 원고');
    expect(saved[0].contextSummary?.content).toBe('새 요약');
    expect(saved[1].id).toBe('novel-2');
  });

  it('업데이터가 잘못된 ID를 반환해도 저장소 식별자는 유지한다', async () => {
    await useNovelStore.getState().mutateNovel('novel-1', (current) => ({ ...current, id: 'wrong-id' }));

    expect(useNovelStore.getState().novels[0].id).toBe('novel-1');
  });

  it('기존 요약 서명을 API 호출 없이 전체 본문 서명으로 마이그레이션한다', async () => {
    const novel = makeNovel();
    const chapter = novel.chapters[0];
    novel.contextSummary = {
      content: '기존 요약',
      summarizedChapters: 1,
      createdAt: 1,
      coveredChapterIds: [chapter.id!],
      contentSignature: `${chapter.id}:${chapter.title}:${chapter.content.length}:${chapter.content.slice(0, 16)}`,
    };
    storage.set('novels', [novel]);

    await useNovelStore.getState().loadNovels();

    expect(useNovelStore.getState().novels[0].contextSummary?.contentSignature).toMatch(/^v2:/);
  });

  it('로드한 지원 종료 Gemini 집필 모델을 현재 기본 모델로 치환해 저장한다', async () => {
    const novel = makeNovel();
    novel.generationEngine = 'gemini-obsolete-flash' as Novel['generationEngine'];
    storage.set('novels', [novel]);

    await useNovelStore.getState().loadNovels();

    expect(useNovelStore.getState().novels[0].generationEngine).toBe('gemini-3.7-flash');
    expect((storage.get('novels') as Novel[])[0].generationEngine).toBe('gemini-3.7-flash');
  });

  it('모델이 없는 기존 작품과 새 작품에 3.7 Flash 기본값을 명시한다', async () => {
    const loadedNovel = makeNovel();
    storage.set('novels', [loadedNovel]);

    await useNovelStore.getState().loadNovels();
    expect(useNovelStore.getState().novels[0].generationEngine).toBe('gemini-3.7-flash');
    expect(useNovelStore.getState().novels[0].targetedGenerationEnabled).toBe(true);
    expect(useNovelStore.getState().novels[0].chapterTargetCharacters).toBe(6000);
    expect(useNovelStore.getState().novels[0].chapterGenerationMode).toBe('single');
    expect(useNovelStore.getState().novels[0].maxTokens).toBe(16384);

    useNovelStore.setState({ novels: [], selectedNovelId: null, isLoading: false });
    await useNovelStore.getState().addNovel(makeNovel());
    expect(useNovelStore.getState().novels[0].generationEngine).toBe('gemini-3.7-flash');
    expect(useNovelStore.getState().novels[0].targetedGenerationEnabled).toBe(true);
    expect(useNovelStore.getState().novels[0].chapterTargetCharacters).toBe(6000);
    expect(useNovelStore.getState().novels[0].chapterGenerationMode).toBe('single');
    expect(useNovelStore.getState().novels[0].maxTokens).toBe(16384);
    expect((storage.get('novels') as Novel[])[0].generationEngine).toBe('gemini-3.7-flash');
  });

  it('기존 작품의 3.6 Flash 직접 선택을 그대로 보존한다', async () => {
    const novel = makeNovel();
    novel.generationEngine = 'gemini-3.6-flash';
    storage.set('novels', [novel]);

    await useNovelStore.getState().loadNovels();

    expect(useNovelStore.getState().novels[0].generationEngine).toBe('gemini-3.6-flash');
    expect((storage.get('novels') as Novel[])[0].generationEngine).toBe('gemini-3.6-flash');
  });

  it('기존 작품의 3.7 Flash 직접 선택을 그대로 보존한다', async () => {
    const novel = makeNovel();
    novel.generationEngine = 'gemini-3.7-flash';
    storage.set('novels', [novel]);

    await useNovelStore.getState().loadNovels();

    expect(useNovelStore.getState().novels[0].generationEngine).toBe('gemini-3.7-flash');
    expect((storage.get('novels') as Novel[])[0].generationEngine).toBe('gemini-3.7-flash');
  });
});

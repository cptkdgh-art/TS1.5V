import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

// A small hook harness exercises event handlers and effect cleanup without a DOM dependency.
const h = vi.hoisted(() => ({ slots: [] as any[], cursor: 0, effects: [] as (() => void)[] }));
vi.mock('react', async (importOriginal) => ({
  ...await importOriginal<typeof import('react')>(),
  useState: (initial: any) => {
    const index = h.cursor++;
    if (!(index in h.slots)) h.slots[index] = typeof initial === 'function' ? initial() : initial;
    return [h.slots[index], (value: any) => { h.slots[index] = typeof value === 'function' ? value(h.slots[index]) : value; }];
  },
  useRef: (value: any) => {
    const index = h.cursor++;
    return h.slots[index] ?? (h.slots[index] = { current: value });
  },
  useMemo: (fn: () => unknown) => fn(),
  useEffect: (fn: () => any, deps: unknown[]) => {
    const index = h.cursor++;
    const old = h.slots[index];
    if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
      h.effects.push(() => {
        old?.cleanup?.();
        h.slots[index] = { deps, cleanup: fn() };
      });
    }
  },
}));

const mocks = vi.hoisted(() => ({
  extract: vi.fn(), stream: vi.fn(), confirm: vi.fn(async () => true), chat: vi.fn(),
  state: {} as any, authors: {} as any,
}));
vi.mock('@services/ai', () => ({
  extractCharacterChatCandidates: mocks.extract,
  streamCharacterChatReply: mocks.stream,
  summarizeCharacterChatMemory: vi.fn(),
}));
vi.mock('@services/ai/chat', () => ({ haveGeneralChatWithAuthor: mocks.chat, haveAfterwordChat: mocks.chat }));
vi.mock('@stores/characterChatStore', () => ({
  useCharacterChatStore: Object.assign((selector: any) => selector(mocks.state), { getState: () => mocks.state }),
}));
vi.mock('@stores/authorStore', () => ({
  useAuthorStore: { getState: () => mocks.authors },
}));
vi.mock('@shared/components', () => {
  const names = ['ArrowLeftIcon', 'ChatBubbleThoughtIcon', 'DocumentDuplicateIcon', 'EllipsisVerticalIcon', 'PaperAirplaneIcon', 'PencilIcon', 'PlusIcon', 'TrashIcon', 'XMarkIcon', 'BookOpenIcon', 'DocumentTextIcon', 'UserGroupIcon', 'WandSparklesIcon', 'Modal', 'Button'];
  return { ...Object.fromEntries(names.map((name) => [name, name])), toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn() }, useConfirmDialog: () => mocks.confirm };
});
vi.mock('./ChatMessage', () => ({ CharacterAvatar: 'CharacterAvatar', CharacterChatMessage: 'CharacterChatMessage', EmotionBadge: 'EmotionBadge', RoleplayContent: 'RoleplayContent' }));
vi.mock('./ModelSelect', () => ({ ModelSelect: 'ModelSelect' }));
vi.mock('./CharacterStatusBar', () => ({ CharacterStatusBar: 'CharacterStatusBar' }));
vi.mock('./QuickRoleplayActions', () => ({ QuickRoleplayActions: 'QuickRoleplayActions' }));

import { ChatRoom } from './ChatRoom';
import { SourceImportView } from './SourceImportView';
import { AuthorChatModal } from '@modules/author/components/AuthorChatModal';

function render(component: () => ReactElement) {
  h.cursor = 0;
  component();
  h.effects.splice(0).forEach((effect) => effect());
  h.cursor = 0;
  return component();
}
function unmount() { h.slots.forEach((slot) => slot?.cleanup?.()); }
function nodes(tree: any): any[] {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function find(tree: ReactElement, predicate: (node: any) => boolean) {
  const node = nodes(tree).find(predicate);
  expect(node).toBeTruthy();
  return node.props;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
const field = { value: '', origin: 'user' };
const persona = { id: 'p', sourceId: 'source', name: 'Test', role: field, greeting: field, personality: field, speakingStyle: field, storyContext: field, worldContext: field };
const session = { id: 's', personaId: 'p', messages: [], createdAt: 1, updatedAt: 1, affinity: 0, summarizedMessageCount: 0 };
const props = { personaId: 'p', sessionId: 's', onBack: vi.fn(), onEditPersona: vi.fn(), onNewChat: vi.fn(), onSwitchSession: vi.fn() };

beforeEach(() => {
  h.slots = []; h.cursor = 0; h.effects = [];
  vi.clearAllMocks();
  vi.stubGlobal('requestAnimationFrame', () => 0);
  mocks.state = {
    personas: [persona], sources: [{ id: 'source' }], sessions: [structuredClone(session)],
    mutateSession: vi.fn(async (id, updater) => {
      const current = mocks.state.sessions.find((item: any) => item.id === id);
      const updated = updater(current);
      mocks.state.sessions = mocks.state.sessions.map((item: any) => item.id === id ? updated : item);
      return updated;
    }),
    appendMessage: vi.fn(async (id, message) => {
      const current = mocks.state.sessions.find((item: any) => item.id === id);
      if (!current.messages.some((item: any) => item.id === message.id)) current.messages.push(message);
    }),
  };
  mocks.stream.mockImplementation(async function* () { yield 'Hello'; });
});
afterEach(() => { unmount(); vi.unstubAllGlobals(); });

describe('UI async regressions', () => {
  it('R15 releases the lock after user persist failure and retries the existing draft without duplicating it', async () => {
    const mutate = mocks.state.mutateSession.getMockImplementation();
    mocks.state.mutateSession.mockImplementationOnce(async (...args: any[]) => {
      await mutate(...args);
      throw new Error('user persist failed');
    });
    let tree = render(() => ChatRoom(props));
    find(tree, (n) => n.type === 'textarea').onChange({ target: { value: 'question' } });
    tree = render(() => ChatRoom(props));
    await find(tree, (n) => n.props?.title === '보내기').onClick();
    expect(mocks.stream).not.toHaveBeenCalled();
    tree = render(() => ChatRoom(props));
    expect(nodes(tree).some((n) => n.props?.title === '응답 중단')).toBe(false);
    const retry = find(tree, (n) => n.type === 'button' && n.props.children === '다시 시도');
    await retry.onClick();
    expect(mocks.state.sessions[0].messages.filter((item: any) => item.role === 'user')).toHaveLength(1);
    expect(mocks.state.sessions[0].messages.filter((item: any) => item.role === 'assistant')).toHaveLength(1);
  });

  it('R15 locks before first persist, blocks same-tick sends/navigation, and aborts on scope change', async () => {
    const save = deferred<void>();
    mocks.state.mutateSession.mockImplementationOnce(() => save.promise);
    let tree = render(() => ChatRoom(props));
    find(tree, (n) => n.type === 'textarea').onChange({ target: { value: 'question' } });
    tree = render(() => ChatRoom(props));
    const send = find(tree, (n) => n.props?.title === '보내기').onClick;
    const pending = send();
    await send();
    find(tree, (n) => n.props?.['aria-label'] === '대화 기록').onChange({ target: { value: 'other' } });
    expect(props.onSwitchSession).not.toHaveBeenCalled();
    expect(mocks.state.mutateSession).toHaveBeenCalledTimes(1);
    mocks.state.sessions.push({ ...session, id: 'other' });
    render(() => ChatRoom({ ...props, sessionId: 'other' }));
    save.resolve();
    await pending;
    expect(mocks.stream).not.toHaveBeenCalled();
  });

  it('R16 retries response persistence with one stable message ID', async () => {
    const append = mocks.state.appendMessage.getMockImplementation();
    mocks.state.appendMessage.mockImplementationOnce(async (...args: any[]) => {
      await append(...args);
      throw new Error('persist failed after optimistic append');
    });
    let tree = render(() => ChatRoom(props));
    find(tree, (n) => n.type === 'textarea').onChange({ target: { value: 'question' } });
    tree = render(() => ChatRoom(props));
    await find(tree, (n) => n.props?.title === '보내기').onClick();
    expect(mocks.state.appendMessage).toHaveBeenCalledTimes(2);
    const calls = mocks.state.appendMessage.mock.calls;
    expect(calls[0][1].id).toBe(calls[1][1].id);
    expect(mocks.state.sessions[0].messages.filter((item: any) => item.role === 'assistant')).toHaveLength(1);
  });

  it('R15 aborts a running stream on unmount and ignores its late output', async () => {
    const output = deferred<string>();
    let signal: AbortSignal | undefined;
    mocks.stream.mockImplementation(async function* (_persona, _source, _session, requestSignal) {
      signal = requestSignal;
      yield await output.promise;
    });
    let tree = render(() => ChatRoom(props));
    find(tree, (n) => n.type === 'textarea').onChange({ target: { value: 'question' } });
    tree = render(() => ChatRoom(props));
    const pending = find(tree, (n) => n.props?.title === '보내기').onClick();
    await Promise.resolve();
    unmount();
    expect(signal?.aborted).toBe(true);
    output.resolve('late');
    await pending;
    expect(mocks.state.appendMessage).not.toHaveBeenCalled();
  });

  it('R16 reports a repeated response persist failure and still releases ownership', async () => {
    mocks.state.appendMessage.mockRejectedValue(new Error('response persist failed'));
    let tree = render(() => ChatRoom(props));
    find(tree, (n) => n.type === 'textarea').onChange({ target: { value: 'question' } });
    tree = render(() => ChatRoom(props));
    await find(tree, (n) => n.props?.title === '보내기').onClick();
    tree = render(() => ChatRoom(props));
    expect(mocks.state.appendMessage).toHaveBeenCalledTimes(2);
    expect(nodes(tree).some((n) => n.props?.title === '응답 중단')).toBe(false);
    expect(nodes(tree).some((n) => n.props?.children === 'response persist failed')).toBe(true);
  });

  it('R14 rejects extraction after the knowledge boundary changes', async () => {
    const extraction = deferred<any[]>();
    mocks.extract.mockReturnValue(extraction.promise);
    const novel = { id: 'n', title: 'Novel', chapters: [{ content: 'one' }, { content: 'secret' }], characters: [], worldviewFiles: [] } as any;
    const input = { novels: [novel], series: [], onBack: vi.fn(), onSelect: vi.fn() };
    let tree = render(() => SourceImportView(input));
    const analysis = find(tree, (n) => n.type === 'button' && Array.isArray(n.props?.children) && n.props.children.includes('본문에서 더 찾기')).onClick();
    await Promise.resolve();
    expect(mocks.extract).toHaveBeenCalledTimes(1);
    find(tree, (n) => n.props?.['aria-label'] === 'AI 캐릭터 지식 진행도').onChange({ target: { value: '1' } });
    render(() => SourceImportView(input));
    extraction.resolve([{ id: 'late', name: 'Secret' }]);
    await analysis;
    tree = render(() => SourceImportView(input));
    expect(nodes(tree).some((n) => n.props?.candidates?.some((c: any) => c.id === 'late'))).toBe(false);
    expect(input.onSelect).not.toHaveBeenCalled();
  });

  it('R04 applies only chat fields to the latest author and never invokes array replacement', async () => {
    const answer = deferred<string>();
    mocks.chat.mockReturnValue(answer.promise);
    let author = { id: 'a', name: 'Original', generalChatHistory: [] } as any;
    mocks.authors = {
      getAuthorById: () => author,
      mutateAuthor: vi.fn(async (_id, updater) => { author = updater(author) || author; return author; }),
    };
    const input = { author, authors: [author], chatType: 'general' as const, onClose: vi.fn(), onUpdateAuthors: vi.fn() };
    let tree = render(() => AuthorChatModal(input));
    find(tree, (n) => n.type === 'textarea').onChange({ target: { value: 'question' } });
    tree = render(() => AuthorChatModal(input));
    const pending = find(tree, (n) => n.type === 'Button' && n.props.children === '전송').onClick();
    author = { ...author, name: 'Updated' };
    answer.resolve('reply');
    await pending;
    expect(author.name).toBe('Updated');
    expect(author.generalChatHistory).toHaveLength(2);
    expect(input.onUpdateAuthors).not.toHaveBeenCalled();
  });

  it('R04 drops a response after modal unmount', async () => {
    const answer = deferred<string>();
    mocks.chat.mockReturnValue(answer.promise);
    const author = { id: 'a', name: 'Original', generalChatHistory: [] } as any;
    mocks.authors = { getAuthorById: () => author, mutateAuthor: vi.fn() };
    const input = { author, authors: [author], chatType: 'general' as const, onClose: vi.fn(), onUpdateAuthors: vi.fn() };
    let tree = render(() => AuthorChatModal(input));
    find(tree, (n) => n.type === 'textarea').onChange({ target: { value: 'question' } });
    tree = render(() => AuthorChatModal(input));
    const pending = find(tree, (n) => n.type === 'Button' && n.props.children === '전송').onClick();
    unmount();
    answer.resolve('late reply');
    await pending;
    expect(mocks.authors.mutateAuthor).not.toHaveBeenCalled();
  });

  it('R04 rejects a changed conversation revision inside the latest-author mutation', async () => {
    const answer = deferred<string>();
    mocks.chat.mockReturnValue(answer.promise);
    let author = { id: 'a', name: 'Original', generalChatHistory: [] } as any;
    mocks.authors = {
      getAuthorById: () => author,
      mutateAuthor: vi.fn(async (_id, updater) => {
        const next = updater(author);
        if (next) author = next;
        return next;
      }),
    };
    const input = { author, authors: [author], chatType: 'general' as const, onClose: vi.fn(), onUpdateAuthors: vi.fn() };
    let tree = render(() => AuthorChatModal(input));
    find(tree, (n) => n.type === 'textarea').onChange({ target: { value: 'question' } });
    tree = render(() => AuthorChatModal(input));
    const pending = find(tree, (n) => n.type === 'Button' && n.props.children === '전송').onClick();
    const latest = [{ role: 'user', parts: [{ text: 'new conversation' }] }];
    author = { ...author, generalChatHistory: latest };
    answer.resolve('obsolete');
    await pending;
    expect(author.generalChatHistory).toBe(latest);
  });
});

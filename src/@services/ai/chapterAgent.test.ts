import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiAuthor, ChapterAgentProposal, Novel } from '@core/types';
import { generateContent } from './config';
import { GENERAL_CHAT_INSTRUCTION } from './prompts';
import { runChapterAgent, type ChapterAgentInput } from './chapterAgent';

vi.mock('./config', () => ({ generateContent: vi.fn(), MODELS: { TEXT: 'gemini-3.7-flash' } }));
vi.mock('./prompts', () => ({ GENERAL_CHAT_INSTRUCTION: vi.fn((author: AiAuthor) => `IDENTITY:${author.name}`) }));

const proposePlan = { action: 'plan', phase: 'propose', summary: '왜 바꿀지 먼저 살필게.' };
const applyPlan = { action: 'plan', phase: 'apply', summary: '고른 방향을 반영할게.' };
const read = { action: 'read_chapter', chapterId: 'c1' };
const edit = { action: 'replace_text', chapterId: 'c1', before: '나는 화가 났다.', after: '손끝이 떨렸다.' };
const proposal = {
  reason: '감정을 설명해서 장면의 힘이 약하다.',
  preserve: ['문을 여는 사건', '담담한 작가 문체'],
  expectedEffect: '독자가 감정을 행동으로 먼저 느낀다.',
  choices: [
    { id: 'a', label: '행동으로 절제', direction: '설명을 손끝의 반응으로 바꾼다.', expectedEffect: '감정이 은근하게 보인다.' },
    { id: 'b', label: '대사로 충돌', direction: '짧은 혼잣말로 분노를 드러낸다.', expectedEffect: '갈등이 선명해진다.' },
  ],
} as const;
const proposeFinish = { action: 'finish', message: '설명 대신 감정이 장면 안에서 보이게 해야 해. 두 방향을 골라봐.', summary: '', proposal };
const applyFinish = { action: 'finish', message: '선택한 절제 방향으로 감정을 행동에 옮겼어.', summary: '감정 설명을 행동 묘사로 수정' };
const respond = (...actions: unknown[]) => actions.forEach(action => vi.mocked(generateContent).mockResolvedValueOnce(JSON.stringify(action)));

function storedProposal(): ChapterAgentProposal {
  return {
    id: 'proposal-1', createdAt: 1, ...proposal,
  } as ChapterAgentProposal;
}

function input(overrides: Partial<ChapterAgentInput> = {}): ChapterAgentInput {
  return {
    novel: {
      id: 'n1', title: '소설', subject: '성장', mood: '담담', plotSummary: '약속을 지킨다.',
      chapters: [{ id: 'c1', title: '첫 화', content: '나는 화가 났다. 그래도 문을 열었다.' },
        { id: 'c2', title: '둘째 화', content: '문을 열자 약속이 떠올랐다.' }],
      history: [], createdAt: 1, aiAuthorId: null, characters: [],
    } satisfies Novel,
    author: null, chapterId: 'c1', message: '감정 표현을 고쳐줘', history: [], ...overrides,
  };
}

beforeEach(() => { vi.clearAllMocks(); vi.mocked(generateContent).mockReset(); });

describe('conversation-first chapter writer agent', () => {
  it('turns even a direct edit request into a read-only A/B proposal first', async () => {
    const request = input();
    respond(proposePlan, read, proposeFinish);
    const result = await runChapterAgent(request);
    expect(result).toMatchObject({ changed: false, content: '나는 화가 났다. 그래도 문을 열었다.', proposal });
    expect(request.novel.chapters[0].content).toBe('나는 화가 났다. 그래도 문을 열었다.');
  });

  it('can ask one more question without fabricating a proposal', async () => {
    respond(proposePlan, read, { action: 'finish', message: '이 장면에서 분노와 두려움 중 무엇을 더 남기고 싶어?', summary: '' });
    const result = await runChapterAgent(input({ message: '이 부분이 좀 이상해' }));
    expect(result.changed).toBe(false);
    expect(result.proposal).toBeUndefined();
  });

  it.each([
    { ...proposal, choices: [proposal.choices[0]] },
    { ...proposal, choices: [...proposal.choices, { ...proposal.choices[0] }] },
    { ...proposal, choices: [{ ...proposal.choices[0], id: 'a' }, { ...proposal.choices[1], id: 'a' }] },
    { ...proposal, preserve: [] },
  ])('rejects malformed proposal contracts without changing the manuscript', async (badProposal) => {
    const request = input();
    respond(proposePlan, read, { ...proposeFinish, proposal: badProposal });
    await expect(runChapterAgent(request)).rejects.toThrow();
    expect(request.novel.chapters[0].content).toContain('나는 화가 났다.');
  });

  it('blocks write tools during the proposal turn', async () => {
    respond(proposePlan, read, edit);
    await expect(runChapterAgent(input())).rejects.toThrow('방향을 선택하기 전');
  });

  it('applies only the structured choice supplied by the app and reviews staged text', async () => {
    const request = input({ approval: { proposal: storedProposal(), choiceId: 'a' }, message: 'A안으로 수정' });
    respond(applyPlan, read, edit, applyFinish);
    const result = await runChapterAgent(request);
    expect(result).toMatchObject({ changed: true, content: '손끝이 떨렸다. 그래도 문을 열었다.', proposal: undefined });
    expect(JSON.stringify(vi.mocked(generateContent).mock.calls[0][0].contents)).toContain('행동으로 절제');
    expect(request.novel.chapters[0].content).toContain('나는 화가 났다.');
  });

  it('rejects an option that is not in the approved proposal before calling the model', async () => {
    await expect(runChapterAgent(input({ approval: { proposal: storedProposal(), choiceId: 'x' as 'a' } }))).rejects.toThrow('선택한 수정 방향');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('searches earlier chapters only when the writer requests them', async () => {
    respond(proposePlan, { action: 'search_chapters', query: '약속' }, { action: 'read_chapter', chapterId: 'c2' }, read, proposeFinish);
    const result = await runChapterAgent(input({ message: '앞에서 한 약속과 연결되는지도 봐줘' }));
    expect(result.readChapterIds).toEqual(['c2', 'c1']);
    expect(JSON.stringify(vi.mocked(generateContent).mock.calls[2][0].contents)).toContain('약속이 떠올랐다');
  });

  it('requires the current chapter to be read before either proposal or completion', async () => {
    respond(proposePlan, proposeFinish);
    await expect(runChapterAgent(input())).rejects.toThrow('대상 원고를 읽지');
    respond(applyPlan, edit);
    await expect(runChapterAgent(input({ approval: { proposal: storedProposal(), choiceId: 'a' } }))).rejects.toThrow('먼저 읽어야');
  });

  it('keeps writes bounded to the open chapter', async () => {
    respond(applyPlan, read, { ...edit, chapterId: 'c2' });
    await expect(runChapterAgent(input({ approval: { proposal: storedProposal(), choiceId: 'a' } }))).rejects.toThrow('다른 회차');
  });

  it('rejects nonexistent or repeated exact replacements', async () => {
    respond(applyPlan, read, { ...edit, before: '없는 문장' });
    await expect(runChapterAgent(input({ approval: { proposal: storedProposal(), choiceId: 'a' } }))).rejects.toThrow('원문이 없거나');
    const request = input({ approval: { proposal: storedProposal(), choiceId: 'a' } });
    request.novel.chapters[0].content = '반복 반복';
    respond(applyPlan, read, { ...edit, before: '반복' });
    await expect(runChapterAgent(request)).rejects.toThrow('여러 곳');
  });

  it('pages long chapters and edits only ranges actually read', async () => {
    const request = input({ approval: { proposal: storedProposal(), choiceId: 'a' } });
    request.novel.chapters[0].content = '가'.repeat(13000) + '나는 화가 났다.';
    respond(applyPlan, read, edit);
    await expect(runChapterAgent(request)).rejects.toThrow('읽지 않은');
    respond(applyPlan, { ...read, offset: 13000 }, edit, applyFinish);
    expect((await runChapterAgent(request)).content).toBe('가'.repeat(13000) + '손끝이 떨렸다.');
  });

  it('rejects an apply turn that did not change the manuscript', async () => {
    respond(applyPlan, read, applyFinish);
    await expect(runChapterAgent(input({ approval: { proposal: storedProposal(), choiceId: 'a' } }))).rejects.toThrow('반영되지 않아');
  });

  it('supports multiple staged changes and a title after approval', async () => {
    respond(applyPlan, read, edit, { ...edit, before: '손끝이 떨렸다.', after: '손끝이 굳었다.' },
      { action: 'set_title', chapterId: 'c1', title: '문 앞에서' }, applyFinish);
    expect(await runChapterAgent(input({ approval: { proposal: storedProposal(), choiceId: 'a' } })))
      .toMatchObject({ title: '문 앞에서', content: '손끝이 굳었다. 그래도 문을 열었다.', changed: true });
  });

  it('stops at the call and cumulative read limits without publishing staged text', async () => {
    const request = input();
    respond(proposePlan, read, ...Array.from({ length: 8 }, () => ({ action: 'search_chapters', query: '약속' })));
    await expect(runChapterAgent(request)).rejects.toThrow('횟수 한도');
    request.novel.chapters[0].content = '가'.repeat(12000);
    respond(proposePlan, ...Array.from({ length: 7 }, () => read));
    await expect(runChapterAgent(request)).rejects.toThrow('읽기 한도');
  });

  it('discards staged text on provider failure or cancellation', async () => {
    const request = input({ approval: { proposal: storedProposal(), choiceId: 'a' } });
    respond(applyPlan, read, edit);
    vi.mocked(generateContent).mockRejectedValueOnce(new Error('provider unavailable'));
    await expect(runChapterAgent(request)).rejects.toThrow('provider unavailable');
    expect(request.novel.chapters[0].content).toContain('나는 화가 났다.');

    const controller = new AbortController();
    respond(applyPlan, read, edit);
    vi.mocked(generateContent).mockImplementationOnce(async () => { controller.abort(); return JSON.stringify(applyFinish); });
    await expect(runChapterAgent(input({ approval: { proposal: storedProposal(), choiceId: 'a' }, signal: controller.signal })))
      .rejects.toMatchObject({ name: 'AbortError' });
  });

  it.each([['grok-4', 'xai'], ['glm-5', 'glm'], ['gemini-3.8-flash', 'gemini']] as const)('preserves author identity and on-demand settings for %s', async (model, provider) => {
    const request = input({ author: { name: '진폭' } as AiAuthor, sharedContext: { characters: [], worldviewFiles: [{ filename: '설정', content: '공유 세계관' }] } });
    request.novel.generationEngine = model;
    respond(proposePlan, { action: 'read_settings' }, read, proposeFinish);
    await runChapterAgent(request);
    expect(GENERAL_CHAT_INSTRUCTION).toHaveBeenCalledWith(request.author);
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model, provider, preserveSystemInstruction: true, systemInstruction: expect.stringContaining('IDENTITY:진폭') }));
    expect(JSON.stringify(vi.mocked(generateContent).mock.calls[2][0].contents)).toContain('공유 세계관');
  });
});

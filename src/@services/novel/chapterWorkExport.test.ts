import { describe, expect, it } from 'vitest';
import type { ChapterAgentPendingProposal, ChapterAgentRevision, Novel } from '@core/types';
import { buildChapterWorkExport } from './chapterWorkExport';

const edit: ChapterAgentRevision = {
  id: 'revision-edit', createdAt: Date.parse('2026-09-12T06:30:00Z'), kind: 'edit',
  authorId: 'author-original', authorName: '담당 작가', model: 'model-test',
  instruction: '용서하는 과정만 고쳐.', summary: '대사 앞에 망설이는 행동을 추가했어.',
  before: { title: '12화 원제', content: '수정 전 원고\n원래 두 번째 문단' },
  after: { title: '12화 수정제', content: '수정 후 원고\n수정한 두 번째 문단' },
  grounding: {
    proposalId: 'proposal-applied', reason: '용서의 원인이 장면에서 보이지 않는다.',
    preserve: ['마지막 대사', '사건 순서'], expectedEffect: '용서가 선택으로 읽힌다.',
    selectedChoice: { id: 'a', label: '행동 보강', direction: '대사 앞에 망설임을 넣는다.', expectedEffect: '감정의 원인이 보인다.' },
  },
};
const restore: ChapterAgentRevision = {
  ...edit, id: 'revision-restore', createdAt: edit.createdAt + 1000, kind: 'restore',
  instruction: '원래 버전으로 돌아가.', summary: '원고를 복원했어.',
  before: edit.after, after: edit.before, restoredFromId: edit.id,
};
const pendingProposal: ChapterAgentPendingProposal = {
  id: 'proposal-pending', createdAt: Date.parse('2026-09-12T07:00:00Z'),
  reason: '마지막 반응이 너무 빠르다.', preserve: ['마지막 대사'], expectedEffect: '여운이 생긴다.',
  choices: [
    { id: 'a', label: '침묵', direction: '대사 사이 침묵을 둔다.', expectedEffect: '망설임이 보인다.' },
    { id: 'b', label: '행동', direction: '손을 거두는 행동을 넣는다.', expectedEffect: '거절의 무게가 생긴다.' },
  ],
  source: { chapterId: 'target', revision: 4, signature: 'v2:source' },
  authorId: 'author-original', authorName: '담당 작가', model: 'model-test',
};
const novel: Novel = {
  id: 'novel', title: '소설/제목', subject: '', mood: '', plotSummary: '', createdAt: 1,
  history: [], characters: [], aiAuthorId: null,
  chapters: [
    { id: 'other', title: '다른 화', content: '다른 원고', feedbackChat: [{ role: 'user', parts: [{ text: '다른 화 비공개 기록' }] }] },
    { id: 'target', title: '대상 회차', chapterNumber: 12, content: '현재 원고 별도', agentRevisions: [edit, restore], agentPendingProposal: pendingProposal,
      feedbackChat: [{ role: 'user', parts: [{ text: '감정선을 어떻게 봐?' }] }, { role: 'model', parts: [{ text: '용서에 이르는 선택이 필요해.' }] }] },
  ],
};

describe('chapter work history export', () => {
  it('exports complete original, changed and restored versions and conversation for only the target chapter', () => {
    const result = buildChapterWorkExport(novel, 'target', 'json');
    const data = JSON.parse(result.content);
    expect(result.filename).toBe('소설_제목_12화_작업기록.json');
    expect(result.mimeType).toContain('application/json');
    expect(data).toMatchObject({
      format: 'jinpok-chapter-work-records', schemaVersion: 1,
      novel: { id: 'novel', title: novel.title }, chapter: { id: 'target', number: 12, title: '대상 회차' },
      agentRevisions: [edit, restore], agentPendingProposal: pendingProposal, feedbackChat: novel.chapters[1].feedbackChat,
    });
    expect(Number.isFinite(Date.parse(data.exportedAt))).toBe(true);
    expect(result.content).not.toContain('다른 화 비공개 기록');
    expect(result.content).not.toContain('현재 원고 별도');
  });

  it('keeps readable dated sections for both versions and restore records in TXT', () => {
    const result = buildChapterWorkExport(novel, 'target', 'txt');
    expect(result.filename).toBe('소설_제목_12화_작업기록.txt');
    expect(result.mimeType).toContain('text/plain');
    for (const fragment of [
      '【선택 대기 중인 제안】', 'proposal-pending', '마지막 반응이 너무 빠르다.',
      '방향 A · 침묵', '방향 B · 행동', '원고 지문: v2:source',
      '【수정·복원 기록】', '【작가와의 대화】', '[변경 전 원고]', '[변경 후 원고]',
      '수정 · 2026-09-12T06:30:00.000Z', '복원 · 2026-09-12T06:30:01.000Z',
      '복원한 기록 ID: revision-edit', edit.before.content, edit.after.content,
      edit.before.title, edit.after.title, edit.instruction, edit.summary,
      '[수정 이유]', edit.grounding!.reason, '[유지 요소]', '[기대한 독자 효과]',
      '[선택한 방향]', '연결된 제안 ID: proposal-applied',
      '감정선을 어떻게 봐?', '용서에 이르는 선택이 필요해.',
    ]) expect(result.content).toContain(fragment);
    expect(result.content).not.toContain('다른 화 비공개 기록');
  });

  it('handles older chapters without saved work records', () => {
    const result = buildChapterWorkExport(novel, 'other', 'json');
    expect(JSON.parse(result.content).agentRevisions).toEqual([]);
    expect(buildChapterWorkExport(novel, 'other', 'txt').content).toContain('저장된 수정·복원 기록이 없어요.');
  });

  it('rejects a missing chapter or damaged revision instead of exporting incomplete records', () => {
    expect(() => buildChapterWorkExport(novel, 'missing', 'json')).toThrow('회차를 찾을 수');
    const broken = structuredClone(novel);
    broken.chapters[1].agentRevisions![0].before = null as unknown as ChapterAgentRevision['before'];
    expect(() => buildChapterWorkExport(broken, 'target', 'json')).toThrow('손상된 작업 기록');
    const damagedProposal = structuredClone(novel);
    damagedProposal.chapters[1].agentPendingProposal!.choices[1].id = 'a';
    expect(() => buildChapterWorkExport(damagedProposal, 'target', 'json')).toThrow('손상된 미선택 제안');
  });
});

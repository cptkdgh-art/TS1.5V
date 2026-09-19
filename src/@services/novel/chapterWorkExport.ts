import type { ChapterAgentPendingProposal, ChapterAgentRevision, Novel } from '@core/types';
import {
  validChapterAgentPendingProposal,
  validChapterAgentRevisions,
} from '@services/studio-backup/validation';

const FORMAT = 'jinpok-chapter-work-records';

function revisionText(revision: ChapterAgentRevision, index: number): string {
  return [
    `=== 작업 ${index + 1} · ${revision.kind === 'restore' ? '복원' : '수정'} · ${new Date(revision.createdAt).toISOString()} ===`,
    `기록 ID: ${revision.id}`,
    `작가: ${revision.authorName} (${revision.authorId ?? '미지정'})`,
    `모델: ${revision.model}`,
    ...(revision.restoredFromId ? [`복원한 기록 ID: ${revision.restoredFromId}`] : []),
    '', '[사용자 지시]', revision.instruction,
    '', '[작업 설명]', revision.summary,
    ...(revision.grounding ? [
      '', '[수정 이유]', revision.grounding.reason,
      '', '[유지 요소]', revision.grounding.preserve.length ? revision.grounding.preserve.map((item) => `- ${item}`).join('\n') : '(없음)',
      '', '[기대한 독자 효과]', revision.grounding.expectedEffect,
      '', '[선택한 방향]', `${revision.grounding.selectedChoice.id.toUpperCase()} · ${revision.grounding.selectedChoice.label}`,
      revision.grounding.selectedChoice.direction,
      `방향의 기대 효과: ${revision.grounding.selectedChoice.expectedEffect}`,
      `연결된 제안 ID: ${revision.grounding.proposalId}`,
    ] : []),
    '', '[변경 전 제목]', revision.before.title,
    '[변경 전 원고]', revision.before.content,
    '', '[변경 후 제목]', revision.after.title,
    '[변경 후 원고]', revision.after.content,
  ].join('\n');
}

function proposalText(proposal: ChapterAgentPendingProposal): string {
  return [
    `제안 ID: ${proposal.id}`,
    `생성 시각: ${new Date(proposal.createdAt).toISOString()}`,
    `작가: ${proposal.authorName} (${proposal.authorId ?? '미지정'})`,
    `모델: ${proposal.model}`,
    `원고 지문: ${proposal.source.signature}`,
    `원고 회차/리비전: ${proposal.source.chapterId} / ${proposal.source.revision}`,
    '', '[수정 이유]', proposal.reason,
    '', '[유지 요소]', proposal.preserve.length ? proposal.preserve.map((item) => `- ${item}`).join('\n') : '(없음)',
    '', '[기대한 독자 효과]', proposal.expectedEffect,
    ...proposal.choices.flatMap((choice) => [
      '', `[방향 ${choice.id.toUpperCase()} · ${choice.label}]`,
      choice.direction,
      `기대 효과: ${choice.expectedEffect}`,
    ]),
  ].join('\n');
}

/** Export chapter work history separately from the reading manuscript and full studio backup. */
export function buildChapterWorkExport(
  novel: Novel,
  chapterId: string,
  format: 'json' | 'txt',
): { filename: string; mimeType: string; content: string } {
  const chapterIndex = novel.chapters.findIndex((chapter) => chapter.id === chapterId);
  if (chapterIndex < 0) throw new Error('작업 기록을 꺼낼 회차를 찾을 수 없어요.');
  const chapter = novel.chapters[chapterIndex];
  const revisions = chapter.agentRevisions ?? [];
  if (!validChapterAgentRevisions(revisions)) throw new Error('손상된 작업 기록이 있어 내보낼 수 없어요.');
  const pendingProposal = chapter.agentPendingProposal;
  if (pendingProposal !== undefined && !validChapterAgentPendingProposal(pendingProposal)) {
    throw new Error('손상된 미선택 제안이 있어 내보낼 수 없어요.');
  }
  const exportedAt = new Date().toISOString();
  const chapterNumber = chapter.chapterNumber ?? chapterIndex + 1;
  const data = {
    format: FORMAT,
    schemaVersion: 1,
    exportedAt,
    novel: { id: novel.id, title: novel.title },
    chapter: { id: chapterId, number: chapterNumber, title: chapter.title },
    agentRevisions: revisions,
    agentPendingProposal: pendingProposal,
    feedbackChat: chapter.feedbackChat ?? [],
  };
  const safeTitle = Array.from(novel.title, (character) => character.charCodeAt(0) < 32 ? '_' : character)
    .join('').replace(/[<>:"/\\|?*]/g, '_').replace(/[. ]+$/g, '').slice(0, 80) || '작품';
  const filename = `${safeTitle}_${chapterNumber}화_작업기록.${format}`;
  if (format === 'json') {
    return { filename, mimeType: 'application/json;charset=utf-8', content: JSON.stringify(data, null, 2) };
  }
  const conversation = data.feedbackChat.map((message, index) => [
    `--- 대화 ${index + 1} · ${message.role === 'user' ? '사용자' : message.role === 'model' ? '작가' : message.role ?? '알 수 없음'} ---`,
    ...(message.parts ?? []).map((part) => typeof part.text === 'string' ? part.text : JSON.stringify(part)),
  ].join('\n')).join('\n\n');
  return {
    filename,
    mimeType: 'text/plain;charset=utf-8',
    content: [
      '진폭스튜디오 · 회차 작업 기록',
      `형식: ${FORMAT} · 버전 1`,
      `내보낸 시각: ${exportedAt}`,
      `작품: ${novel.title} (${novel.id})`,
      `회차: ${chapterNumber}화 · ${chapter.title} (${chapterId})`,
      '', '【선택 대기 중인 제안】',
      pendingProposal ? proposalText(pendingProposal) : '선택을 기다리는 제안이 없어요.',
      '', '【수정·복원 기록】',
      revisions.length ? revisions.map(revisionText).join('\n\n') : '저장된 수정·복원 기록이 없어요.',
      '', '【작가와의 대화】',
      '대화는 저장 순서이며, 개별 대화 시각은 기존 기록에 포함되어 있지 않아요.',
      conversation || '저장된 대화가 없어요.',
    ].join('\n'),
  };
}

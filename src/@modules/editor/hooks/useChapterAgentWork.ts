import { useEffect, useRef, useState } from 'react';
import type { AiAuthor, ChapterAgentChoice, Novel } from '@core/types';
import { runChapterAgent, type ChapterAgentApproval } from '@services/ai/chapterAgent';
import {
  commitChapterAgentProposalTurn,
  commitChapterAgentSelectionTurn,
  chapterAgentSourceSignature,
  requireWorkChapter,
  restoreChapterAgentRevision,
} from '@services/novel/chapterAgentWork';
import { getActiveWorkspaceId } from '@services/storage';
import { getWorkspaceGeneration, subscribeWorkspaceChanges } from '@services/storage/workspaceCoordination';
import { useAuthorStore } from '@stores/authorStore';
import { useNovelStore } from '@stores/novelStore';
import { useSeriesStore } from '@stores/seriesStore';
import { useConfirmDialog } from '@shared/components';

function captureCollaborators(novel: Novel) {
  const author: AiAuthor | null = useAuthorStore.getState().authors.find((item) => item.id === novel.aiAuthorId) ?? null;
  const series = novel.seriesId ? useSeriesStore.getState().getSeriesById(novel.seriesId) : undefined;
  const sharedContext = series ? { characters: series.characters, worldviewFiles: series.worldviewFiles } : undefined;
  return { author, sharedContext };
}

export function useChapterAgentWork(novelId: string, chapterId: string) {
  const novel = useNovelStore((state) => state.novels.find((item) => item.id === novelId));
  const chapter = novel?.chapters.find((item) => item.id === chapterId);
  const author = useAuthorStore((state) => state.authors.find((item) => item.id === novel?.aiAuthorId));
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [pendingMessage, setPendingMessage] = useState('');
  const [operation, setOperation] = useState<'propose' | 'apply' | null>(null);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const confirm = useConfirmDialog();

  useEffect(() => {
    mounted.current = true;
    const unsubscribe = subscribeWorkspaceChanges((change) => {
      if (change.kind === 'replaced' || change.kind === 'deleted') controller.current?.abort();
    });
    return () => {
      mounted.current = false;
      controller.current?.abort();
      controller.current = null;
      unsubscribe();
    };
  }, [novelId, chapterId]);

  function cancel() {
    controller.current?.abort();
    controller.current = null;
    setBusy(false);
    setOperation(null);
    setPendingMessage('');
    setProgress('작업을 중단했어요. 원고는 변경되지 않았어요.');
  }

  async function run(message: string, approval?: ChapterAgentApproval): Promise<boolean> {
    if (controller.current || !message.trim()) return false;
    const base = useNovelStore.getState().getNovelById(novelId);
    if (!base) return false;
    const workspaceId = getActiveWorkspaceId();
    const generation = getWorkspaceGeneration(workspaceId);
    const context = captureCollaborators(base);
    const task = new AbortController();
    controller.current = task;
    setBusy(true); setOperation(approval ? 'apply' : 'propose'); setError(''); setPendingMessage(message);
    const assertActive = () => {
      if (!mounted.current || controller.current !== task || task.signal.aborted
        || getActiveWorkspaceId() !== workspaceId || getWorkspaceGeneration(workspaceId) !== generation) {
        throw new Error('작업이 중단되거나 작업실이 바뀌어 원고를 보존했어요.');
      }
      if (JSON.stringify(captureCollaborators(base)) !== JSON.stringify(context)) {
        throw new Error('담당 작가나 공용 설정이 바뀌었어요. 최신 상태에서 다시 작업해 주세요.');
      }
    };
    try {
      const original = requireWorkChapter(base, chapterId);
      const result = await runChapterAgent({
        novel: base, chapterId, message, history: original.feedbackChat ?? [], approval,
        ...context, signal: task.signal,
        onProgress: (text) => { if (controller.current === task && mounted.current) setProgress(text); },
      });
      assertActive();
      setSaving(true); setProgress(approval ? '원고와 선택 이유를 함께 저장하고 있어' : '대화와 수정 방향을 저장하고 있어');
      const updated = await useNovelStore.getState().mutateNovel(novelId, (current) => {
        assertActive();
        return approval
          ? commitChapterAgentSelectionTurn(current, {
            base, chapterId, message, author: context.author,
            proposalId: approval.proposal.id, choiceId: approval.choiceId, result,
          })
          : commitChapterAgentProposalTurn(current, { base, chapterId, message, author: context.author, result });
      }, generation);
      if (!updated) throw new Error('작품이 삭제되어 작업을 저장하지 못했어요.');
      if (mounted.current && controller.current === task) {
        setProgress(result.changed
          ? '수정과 검토 완료 · 이유와 수정 전 원고도 보관했어요.'
          : result.proposal
            ? '두 방향을 준비했어요 · 선택 전이라 원고는 그대로예요.'
            : '대화 완료 · 원고는 그대로예요.');
      }
      return true;
    } catch (cause) {
      if (mounted.current && controller.current === task) {
        setError(cause instanceof Error ? cause.message : '작가 작업에 실패했어요.');
        setProgress('');
      }
      return false;
    } finally {
      if (mounted.current && controller.current === task) {
        controller.current = null;
        setBusy(false); setSaving(false); setPendingMessage(''); setOperation(null);
      }
    }
  }

  function send(message: string): Promise<boolean> {
    return run(message);
  }

  function choose(choiceId: ChapterAgentChoice['id']): Promise<boolean> {
    const current = useNovelStore.getState().getNovelById(novelId);
    const proposal = current && requireWorkChapter(current, chapterId).agentPendingProposal;
    const choice = proposal?.choices.find(item => item.id === choiceId);
    if (!proposal || !choice) {
      setError('선택할 수정 방향이 달라졌어요. 최신 작가 제안을 확인해 주세요.');
      return Promise.resolve(false);
    }
    const target = requireWorkChapter(current, chapterId);
    if (proposal.source.chapterId !== chapterId
      || proposal.source.revision !== (target.trace?.revision ?? 1)
      || proposal.source.signature !== chapterAgentSourceSignature(target)) {
      setError('제안 뒤 원고가 바뀌었어요. 현재 화를 다시 읽고 새 방향을 받아 주세요.');
      return Promise.resolve(false);
    }
    return run(`[수정 방향 선택] ${choice.id.toUpperCase()} · ${choice.label}`, { proposal, choiceId });
  }

  async function restore(revisionId: string) {
    if (controller.current) return;
    const current = useNovelStore.getState().getNovelById(novelId);
    if (!current) return;
    const expected = requireWorkChapter(current, chapterId);
    const workspaceId = getActiveWorkspaceId();
    const generation = getWorkspaceGeneration(workspaceId);
    const task = new AbortController();
    controller.current = task;
    setBusy(true); setError('');
    try {
      const accepted = await confirm({
        title: '수정 전 원고로 복원',
        message: '이 작업 이전의 원고로 복원할까요? 현재 원고도 새 복원 기록으로 보관돼요.',
        confirmText: '원고 복원',
      });
      if (!accepted) return;
      setSaving(true);
      const updated = await useNovelStore.getState().mutateNovel(novelId, (latest) => {
        if (!mounted.current || task.signal.aborted || controller.current !== task || getActiveWorkspaceId() !== workspaceId) {
          throw new Error('작업실이 바뀌어 복원을 중단했어요.');
        }
        return restoreChapterAgentRevision(latest, { chapterId, expected, revisionId });
      }, generation);
      if (!updated) throw new Error('작품이 삭제되어 복원할 수 없어요.');
      if (mounted.current) setProgress('원고 복원 완료 · 복원 전 원고도 보관했어요.');
    } catch (cause) {
      if (mounted.current) setError(cause instanceof Error ? cause.message : '복원에 실패했어요.');
    } finally {
      if (mounted.current && controller.current === task) {
        controller.current = null; setBusy(false); setSaving(false);
      }
    }
  }

  return { novel, chapter, author, busy, saving, operation, progress, error, pendingMessage, send, choose, cancel, restore };
}

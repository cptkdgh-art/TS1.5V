import { useEffect, useRef, useState } from 'react';
import { Button, Modal, WriterAgentIcon } from '@shared/components';
import { MODELS } from '@services/ai/config';
import { ChapterWorkHistory } from '../components/ChapterWorkHistory';
import { useChapterAgentWork } from '../hooks/useChapterAgentWork';

interface ChapterChatModalProps {
  novelId: string;
  chapterId: string;
  onClose: () => void;
}

export function ChapterChatModal({ novelId, chapterId, onClose }: ChapterChatModalProps) {
  const work = useChapterAgentWork(novelId, chapterId);
  const [input, setInput] = useState('');
  const [tab, setTab] = useState<'chat' | 'history'>('chat');
  const endRef = useRef<HTMLDivElement>(null);
  const history = work.chapter?.feedbackChat;

  useEffect(() => {
    if (tab === 'chat') endRef.current?.scrollIntoView({ block: 'nearest' });
  }, [history?.length, work.pendingMessage, tab]);

  async function handleSend() {
    if (work.busy || !input.trim()) return;
    if (await work.send(input.trim())) setInput('');
  }

  const records = work.chapter?.agentRevisions;
  const latest = records?.[records.length - 1];
  return (
    <Modal isOpen onClose={onClose} title="작가와 작업" size="full" isDismissible={!work.saving}>
      {!work.novel || !work.chapter ? <p className="text-gray-300">이 회차가 삭제되었어요. 창을 닫고 작품을 확인해 주세요.</p> : (
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-indigo-500/15 p-2 text-indigo-300"><WriterAgentIcon aria-hidden="true" className="h-6 w-6" /></div>
            <div className="min-w-0">
              <p className="break-words font-medium text-white">{work.author?.name ?? 'AI 작가'} · {work.chapter.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-gray-400">현재 화를 보고 있어요. 필요하면 이전 화와 설정을 직접 찾아 읽어요.</p>
              <p className="mt-1 text-xs text-gray-500">작품에서 선택한 모델: {work.novel.generationEngine ?? MODELS.TEXT}</p>
            </div>
            <span className="ml-auto shrink-0 rounded-full border border-indigo-700/70 bg-indigo-950/50 px-2.5 py-1 text-xs font-medium text-indigo-200">
              {work.busy ? (work.operation === 'apply' ? '선택한 방향 수정 중' : '이유를 함께 찾는 중')
                : work.chapter.agentPendingProposal ? '두 방향 중 선택 대기' : '대화 중'}
            </span>
          </div>
          <div className="flex gap-2" role="group" aria-label="작가 작업 보기">
            <Button variant={tab === 'chat' ? 'primary' : 'secondary'} aria-pressed={tab === 'chat'} onClick={() => setTab('chat')}>대화</Button>
            <Button variant={tab === 'history' ? 'primary' : 'secondary'} aria-pressed={tab === 'history'} onClick={() => setTab('history')}>원고·작업 기록 {work.chapter.agentRevisions?.length ?? 0}</Button>
          </div>
          {tab === 'history' ? (
            <ChapterWorkHistory novel={work.novel} chapter={work.chapter} busy={work.busy} onRestore={work.restore} />
          ) : (
            <>
              <div className="h-[30dvh] min-h-40 overflow-y-auto rounded-xl bg-gray-900 p-3 sm:h-[36vh] sm:p-4" role="log" aria-live="polite" aria-relevant="additions text" aria-busy={work.busy} aria-label="작가 작업 대화">
                {!history?.length && !work.pendingMessage && (
                  <div className="space-y-3 p-2 text-sm leading-relaxed text-gray-400">
                    <p>먼저 왜 바꾸려는지 같이 이야기할게요. 방향이 보이면 서로 다른 두 가지 안을 제안해요.</p>
                    <p className="text-gray-300">“마지막 대사가 너무 설명적인 것 같아. 왜 그런지 같이 봐줘.”</p>
                  </div>
                )}
                {(history ?? []).map((message, index) => (
                  <div key={index} className={`mb-3 max-w-[95%] rounded-lg p-3 text-sm leading-relaxed ${message.role === 'user' ? 'ml-auto bg-indigo-600 text-white' : 'mr-auto bg-gray-800 text-gray-200'}`}>
                    <p className="mb-1 text-xs opacity-60">{message.role === 'user' ? '감독' : work.author?.name ?? '작가'}</p>
                    <p className="whitespace-pre-wrap break-words">{message.parts?.map((part) => part.text ?? '').join('\n')}</p>
                  </div>
                ))}
                {work.pendingMessage && <p className="ml-auto max-w-[95%] whitespace-pre-wrap break-words rounded-lg bg-indigo-600 p-3 text-sm text-white">{work.pendingMessage}</p>}
                {work.chapter.agentPendingProposal && (
                  <section className="mr-auto mt-3 max-w-[98%] rounded-xl border border-indigo-700/70 bg-gray-800 p-3 text-sm text-gray-200 sm:p-4" aria-labelledby="chapter-agent-proposal-title">
                    <p id="chapter-agent-proposal-title" className="font-semibold text-indigo-200">수정 방향을 골라줘</p>
                    <div className="mt-3 space-y-2 leading-relaxed">
                      <p><span className="font-medium text-gray-100">왜 바꾸는가:</span> {work.chapter.agentPendingProposal.reason}</p>
                      <p><span className="font-medium text-gray-100">살릴 것:</span> {work.chapter.agentPendingProposal.preserve.join(' · ')}</p>
                      <p><span className="font-medium text-gray-100">기대하는 변화:</span> {work.chapter.agentPendingProposal.expectedEffect}</p>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2" role="group" aria-label="작가가 제안한 두 가지 수정 방향">
                      {work.chapter.agentPendingProposal.choices.map((choice) => (
                        <div key={choice.id} className="flex min-w-0 flex-col rounded-lg border border-gray-600 bg-gray-900/80 p-3">
                          <p className="font-semibold text-white">{choice.id.toUpperCase()} · {choice.label}</p>
                          <p className="mt-2 flex-1 leading-relaxed text-gray-300">{choice.direction}</p>
                          <p className="mt-2 text-xs leading-relaxed text-gray-400">독자 효과: {choice.expectedEffect}</p>
                          <Button className="mt-3 min-h-11 w-full" variant="secondary" disabled={work.busy}
                            aria-label={`${choice.id.toUpperCase()}안 ${choice.label} 방향으로 현재 화 수정`}
                            onClick={() => void work.choose(choice.id)}>
                            {choice.id.toUpperCase()}안으로 수정
                          </Button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-xs leading-relaxed text-gray-400">선택하지 않고 아래에서 다른 생각을 계속 말해도 돼요. 새 대화에 맞춰 작가가 방향을 다시 잡아요.</p>
                  </section>
                )}
                <div ref={endRef} />
              </div>
              {latest && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400">
                  <span>수정 전 원고 보관됨</span>
                  <Button variant="secondary" onClick={() => setTab('history')}>변경 보기</Button>
                  <Button variant="ghost" disabled={work.busy} onClick={() => work.restore(latest.id)}>되돌리기</Button>
                </div>
              )}
              <div className="space-y-2">
                <label className="sr-only" htmlFor="chapter-agent-message">작가에게 할 말</label>
                <textarea id="chapter-agent-message" rows={3} value={input} disabled={work.busy} onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSend(); }
                  }}
                  placeholder="마음에 걸리는 장면이나 바꾸려는 이유를 말해 주세요."
                  className="w-full resize-y rounded-lg border border-gray-600 bg-gray-900 p-3 text-sm text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none disabled:opacity-60" />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-400">대화와 방향 선택 전에는 원고를 바꾸지 않아요.</p>
                  <Button className="min-h-11 shrink-0" disabled={work.busy || !input.trim()} onClick={handleSend} leftIcon={<WriterAgentIcon aria-hidden="true" className="h-4 w-4" />}>전송</Button>
                </div>
              </div>
            </>
          )}
          {work.progress && <div className="flex items-center justify-between gap-3 text-sm text-indigo-200" role="status">
            <span className="flex items-center gap-2"><WriterAgentIcon aria-hidden="true" className={`h-4 w-4 shrink-0 ${work.busy ? 'animate-pulse' : ''}`} />{work.progress}</span>
            {work.busy && <Button variant="secondary" disabled={work.saving} onClick={work.cancel}>중단</Button>}
          </div>}
          {work.error && <p role="alert" className="break-words rounded-lg bg-red-950/40 p-3 text-sm text-red-200">{work.error}</p>}
        </div>
      )}
    </Modal>
  );
}

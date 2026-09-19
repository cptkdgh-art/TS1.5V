import { useEffect, useMemo, useRef, useState } from 'react';
import type { CharacterChatSession } from '@core/types';
import {
  ArrowLeftIcon,
  ChatBubbleThoughtIcon,
  DocumentDuplicateIcon,
  EllipsisVerticalIcon,
  PaperAirplaneIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  toast,
  useConfirmDialog,
} from '@shared/components';
import {
  streamCharacterChatReply,
  summarizeCharacterChatMemory,
} from '@services/ai';
import {
  calculateSessionAffinity,
  canApplyCharacterChatSummary,
  constrainRoleplayTurn,
  createDefaultUserPersona,
  getRelationshipStage,
  parseRoleplayResponse,
  shouldSummarizeSession,
} from '@services/character-chat';
import { useCharacterChatStore } from '@stores/characterChatStore';
import {
  CharacterAvatar,
  CharacterChatMessage,
  EmotionBadge,
  RoleplayContent,
} from './ChatMessage';
import { ModelSelect } from './ModelSelect';
import { CharacterStatusBar } from './CharacterStatusBar';
import { QuickRoleplayActions } from './QuickRoleplayActions';

interface ChatRoomProps {
  personaId: string;
  sessionId: string;
  onBack: () => void;
  onEditPersona: (personaId: string) => void;
  onNewChat: () => void;
  onSwitchSession: (sessionId: string) => void;
}

export function ChatRoom({ personaId, sessionId, onBack, onEditPersona, onNewChat, onSwitchSession }: ChatRoomProps) {
  const persona = useCharacterChatStore((state) => state.personas.find((item) => item.id === personaId));
  const source = useCharacterChatStore((state) => persona ? state.sources.find((item) => item.id === persona.sourceId) : undefined);
  const session = useCharacterChatStore((state) => state.sessions.find((item) => item.id === sessionId));
  const personaSessions = useCharacterChatStore((state) => state.sessions
    .filter((item) => item.personaId === personaId)
    .sort((a, b) => b.updatedAt - a.updatedAt));
  const mutateSession = useCharacterChatStore((state) => state.mutateSession);
  const appendMessage = useCharacterChatStore((state) => state.appendMessage);
  const duplicateSession = useCharacterChatStore((state) => state.duplicateSession);
  const deleteSession = useCharacterChatStore((state) => state.deleteSession);
  const confirm = useConfirmDialog();

  const [input, setInput] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const shouldStickToBottom = useRef(true);

  useEffect(() => {
    setIsSending(false);
    return () => {
      abortRef.current?.abort();
      abortRef.current = null;
    };
  }, [personaId, sessionId]);

  useEffect(() => {
    shouldStickToBottom.current = true;
    setError('');
    setStreamingText('');
    setEditingMessageId(null);
    setEditingText('');
    requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    });
  }, [sessionId]);

  useEffect(() => {
    if (!shouldStickToBottom.current || !scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [session?.messages.length, streamingText]);

  const relationshipStage = useMemo(
    () => getRelationshipStage(session?.affinity || 0),
    [session?.affinity]
  );
  const userPersona = useMemo(
    () => session?.userPersona || createDefaultUserPersona(session?.createdAt),
    [session?.createdAt, session?.userPersona]
  );
  const streamingRoleplay = useMemo(
    () => constrainRoleplayTurn(parseRoleplayResponse(streamingText)),
    [streamingText]
  );
  const currentEmotion = streamingText
    ? streamingRoleplay.emotion
    : [...(session?.messages || [])].reverse().find((message) => message.role === 'assistant')?.emotion || 'neutral';

  if (!persona || !source || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fff7fa] text-[#816b74]">
        <button type="button" onClick={onBack} className="rounded-md border border-[#e9cbd6] bg-white px-4 py-2">캐릭터챗 홈으로</button>
      </div>
    );
  }

  const refreshMemory = async (target: CharacterChatSession) => {
    if (!shouldSummarizeSession(target)) return;
    setIsSummarizing(true);
    try {
      const memorySummary = await summarizeCharacterChatMemory(target, persona);
      await mutateSession(target.id, (current) => {
        if (!canApplyCharacterChatSummary(current, target)) return current;
        return {
          ...current,
          memorySummary,
          summarizedMessageCount: target.messages.length,
        };
      });
    } catch (memoryError) {
      console.warn('[CharacterChat] 기억 요약 실패:', memoryError);
    } finally {
      setIsSummarizing(false);
    }
  };

  const generateReply = async (controller: AbortController) => {
    const requestSession = useCharacterChatStore.getState().sessions.find((item) => item.id === session.id);
    if (!requestSession || requestSession.messages[requestSession.messages.length - 1]?.role !== 'user') return;
    let completedText = '';
    let generationError: unknown;
    const responseId = crypto.randomUUID();
    const isCurrent = () => abortRef.current === controller;

    try {
      for await (const chunk of streamCharacterChatReply(persona, source, requestSession, controller.signal)) {
        if (!isCurrent() || controller.signal.aborted) break;
        completedText += chunk;
        setStreamingText(completedText);
      }
      if (!completedText.trim() && !controller.signal.aborted) throw new Error('캐릭터 응답이 비어 있습니다.');
    } catch (error) {
      generationError = error;
    }
    if (!isCurrent()) return;
    if (completedText.trim()) {
      const response = constrainRoleplayTurn(parseRoleplayResponse(completedText.trim()));
      const message = {
        id: responseId,
        role: 'assistant' as const,
        content: response.content || completedText.trim(),
        blocks: response.blocks,
        emotion: response.emotion,
        createdAt: Date.now(),
      };
      try {
        await appendMessage(session.id, message);
      } catch {
        if (!isCurrent()) return;
        // An optimistic append may already exist. Retry persistence with the same ID.
        await appendMessage(session.id, message);
      }
    }
    if (!isCurrent()) return;
    setStreamingText('');
    if (generationError || controller.signal.aborted) {
      if (controller.signal.aborted) {
        setError(completedText.trim()
          ? '응답 생성을 중단했어. 지금까지 받은 내용은 저장했어.'
          : '응답 생성을 중단했어. 마지막 메시지에서 다시 시도할 수 있어.');
      } else {
        setError(generationError instanceof Error ? generationError.message : '응답 생성에 실패했습니다.');
      }
    } else {
      const latest = useCharacterChatStore.getState().sessions.find((item) => item.id === session.id);
      if (latest) void refreshMemory(latest);
    }
  };

  const runLockedReply = async (prepare: () => Promise<unknown>) => {
    if (abortRef.current) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setIsSending(true);
    setError('');
    setStreamingText('');
    try {
      await prepare();
      if (abortRef.current !== controller || controller.signal.aborted) return;
      await generateReply(controller);
    } catch (saveError) {
      if (abortRef.current === controller) {
        setError(saveError instanceof Error ? saveError.message : '대화 저장에 실패했습니다.');
        setStreamingText('');
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setIsSending(false);
      }
    }
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || abortRef.current) return;
    setInput('');
    await runLockedReply(() => mutateSession(session.id, (current) => {
      const messages = [...current.messages, {
        id: crypto.randomUUID(),
        role: 'user' as const,
        content,
        createdAt: Date.now(),
      }];
      return {
        ...current,
        title: current.messages.some((message) => message.role === 'user')
          ? current.title
          : content.replace(/\s+/g, ' ').slice(0, 28),
        affinity: calculateSessionAffinity(messages),
        messages,
      };
    }));
  };

  const addQuickAction = (value: string) => {
    setInput((current) => current.trim() ? `${current.trimEnd()}\n${value}` : value);
  };

  const retryLastReply = async () => {
    await runLockedReply(async () => {
    const latest = useCharacterChatStore.getState().sessions.find((item) => item.id === session.id);
    const lastMessage = latest?.messages[latest.messages.length - 1];
    if (lastMessage?.role === 'assistant') {
      await mutateSession(session.id, (current) => ({
        ...current,
        messages: current.messages.slice(0, -1),
        memorySummary: '',
        summarizedMessageCount: 0,
      }));
    }
    });
  };

  const handleNewChat = async () => {
    if (abortRef.current) return;
    onNewChat();
  };

  const handleDuplicateChat = async () => {
    if (abortRef.current) return;
    const copy = await duplicateSession(session.id);
    if (copy) {
      toast.success('대화를 복제했어.');
      onSwitchSession(copy.id);
    }
  };

  const handleBranch = async (messageId: string) => {
    if (abortRef.current) return;
    const branch = await duplicateSession(session.id, messageId);
    if (branch) {
      toast.success('이 지점에서 새 대화를 만들었어.');
      onSwitchSession(branch.id);
    }
  };

  const handlePin = async (messageId: string) => {
    if (abortRef.current) return;
    const target = session.messages.find((message) => message.id === messageId);
    if (!target) return;
    const pinnedCount = session.messages.filter((message) => message.isPinned).length;
    if (!target.isPinned && pinnedCount >= 5) {
      toast.warning('고정 기억은 대화당 5개까지 둘 수 있어.');
      return;
    }
    await mutateSession(session.id, (current) => ({
      ...current,
      messages: current.messages.map((message) => message.id === messageId
        ? { ...message, isPinned: !message.isPinned }
        : message),
    }));
  };

  const handleRewind = async (messageId: string) => {
    if (abortRef.current) return;
    const approved = await confirm({
      title: '여기까지 되돌리기',
      message: '선택한 메시지 뒤의 대화가 삭제됩니다. 원본을 남기려면 먼저 분기해 주세요.',
      confirmText: '되돌리기',
      variant: 'danger',
    });
    if (!approved) return;
    await mutateSession(session.id, (current) => {
      const index = current.messages.findIndex((message) => message.id === messageId);
      if (index < 0) return current;
      const messages = current.messages.slice(0, index + 1);
      return {
        ...current,
        messages,
        memorySummary: '',
        summarizedMessageCount: 0,
        affinity: calculateSessionAffinity(messages),
      };
    });
  };

  const handleRegenerate = async (messageId: string) => {
    await runLockedReply(() => mutateSession(session.id, (current) => {
      const index = current.messages.findIndex((message) => message.id === messageId);
      if (index <= 0 || current.messages[index - 1]?.role !== 'user') return current;
      return {
        ...current,
        messages: current.messages.slice(0, index),
        memorySummary: '',
        summarizedMessageCount: 0,
      };
    }));
  };

  const saveEditedMessage = async (messageId: string) => {
    const content = editingText.trim();
    if (!content || abortRef.current) return;
    await runLockedReply(async () => {
    let didEdit = false;
    await mutateSession(session.id, (current) => {
      const index = current.messages.findIndex((message) => message.id === messageId);
      if (index < 0) return current;
      const edited = { ...current.messages[index], content, editedAt: Date.now() };
      const messages = [...current.messages.slice(0, index), edited];
      didEdit = true;
      return {
        ...current,
        messages,
        memorySummary: '',
        summarizedMessageCount: 0,
        affinity: calculateSessionAffinity(messages),
      };
    });
    if (!didEdit) return;
    setEditingMessageId(null);
    setEditingText('');
    });
  };

  const handleDeleteChat = async () => {
    if (abortRef.current) return;
    const approved = await confirm({
      title: '대화 삭제',
      message: '이 대화 기록을 삭제합니다. 캐릭터 자체는 남아 있습니다.',
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!approved) return;
    await deleteSession(session.id);
    const remaining = useCharacterChatStore.getState().sessions
      .filter((item) => item.personaId === persona.id)
      .sort((a, b) => b.updatedAt - a.updatedAt);
    if (remaining[0]) onSwitchSession(remaining[0].id);
    else await handleNewChat();
  };

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#fff7fa] text-[#44363d]">
      <header className="flex h-16 items-center justify-between gap-3 border-b border-[#f0dce3] bg-white px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={onBack} className="rounded-md p-2 text-[#a58c96] hover:bg-[#fff0f4] hover:text-[#b7466b]" title="캐릭터챗 홈">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-[#ffd2df] bg-[#fff0f4] font-bold text-[#c9587c] shadow-sm">
            {persona.portrait ? <img src={persona.portrait} alt="" className="h-full w-full object-cover" /> : persona.name.slice(0, 1)}
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-bold text-[#44363d]">{persona.name}</h1>
            <p className="truncate text-[11px] font-medium text-[#3f8b76]">{userPersona.name}와 {relationshipStage}</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <ModelSelect
            value={session.model}
            disabled={isSending}
            onChange={(model) => mutateSession(session.id, (current) => ({ ...current, model }))}
            label="모델"
            className="hidden xl:flex"
          />
          <button type="button" onClick={() => setIsInfoOpen((value) => !value)} className="rounded-md p-2 text-[#a58c96] hover:bg-[#fff0f4] hover:text-[#b7466b] lg:hidden" title="캐릭터 정보">
            <EllipsisVerticalIcon className="h-5 w-5" />
          </button>
          <button type="button" onClick={handleNewChat} disabled={isSending} className="rounded-md p-2 text-[#a58c96] hover:bg-[#fff0f4] hover:text-[#b7466b] disabled:cursor-not-allowed disabled:opacity-40" title="새 대화">
            <PlusIcon className="h-5 w-5" />
          </button>
          <button type="button" onClick={handleDuplicateChat} disabled={isSending} className="rounded-md p-2 text-[#a58c96] hover:bg-[#eaf8f3] hover:text-[#3f8b76] disabled:cursor-not-allowed disabled:opacity-40" title="대화 복제">
            <DocumentDuplicateIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="grid h-[calc(100dvh-4rem)] min-h-0 lg:grid-cols-[260px_1fr]">
        <aside className={`${isInfoOpen ? 'fixed inset-x-3 top-20 z-30 block max-h-[calc(100dvh-6rem)] overflow-y-auto shadow-2xl' : 'hidden'} rounded-md border border-[#efd6df] bg-[#fffafc] p-4 text-[#55434b] lg:static lg:block lg:max-h-none lg:overflow-y-auto lg:rounded-none lg:border-x-0 lg:border-y-0 lg:border-r lg:shadow-none`}>
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <h2 className="font-semibold">캐릭터 정보</h2>
            <button type="button" onClick={() => setIsInfoOpen(false)} className="rounded-md p-2 text-[#a58c96] hover:bg-[#fff0f4]"><XMarkIcon className="h-4 w-4" /></button>
          </div>
          <button type="button" onClick={() => onEditPersona(persona.id)} disabled={isSending} className="mb-5 flex w-full items-center justify-center gap-2 rounded-md border border-[#e7c5d1] bg-white py-2 text-sm font-semibold text-[#825466] hover:border-[#ed7fa2] hover:text-[#a63e62] disabled:cursor-not-allowed disabled:opacity-40">
            <PencilIcon className="h-4 w-4" /> 페르소나 수정
          </button>
          <ModelSelect
            value={session.model}
            disabled={isSending}
            onChange={(model) => mutateSession(session.id, (current) => ({ ...current, model }))}
            label="대화 모델"
            className="mb-5 flex-col items-start xl:hidden"
          />
          <div className="space-y-5 text-sm">
            <InfoBlock title="성격" value={persona.personality.value} />
            <InfoBlock title="말투" value={persona.speakingStyle.value} />
            <InfoBlock title="현재 이야기" value={persona.storyContext.value} />
            <InfoBlock title="세계관" value={persona.worldContext.value} />
            <InfoBlock title="장기 기억" value={session.memorySummary} empty="대화가 쌓이면 자동으로 정리돼." />
          </div>
          <div className="mt-6 border-t border-[#efd6df] pt-4">
            <label className="text-xs text-[#a58c96]">대화 기록</label>
            <select
              aria-label="대화 기록"
              value={session.id}
              disabled={isSending}
              onChange={(event) => { if (!abortRef.current) onSwitchSession(event.target.value); }}
              className="mt-2 w-full rounded-md border border-[#e7c5d1] bg-white px-2 py-2 text-sm text-[#55434b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {personaSessions.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}
            </select>
            <button type="button" onClick={handleDeleteChat} disabled={isSending} className="mt-3 inline-flex items-center gap-2 text-xs text-[#a58c96] hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40">
              <TrashIcon className="h-3.5 w-3.5" /> 현재 대화 삭제
            </button>
          </div>
        </aside>

        <main className="min-h-0 min-w-0 bg-[#fff7fa]">
          <div className="grid h-full min-h-0 grid-rows-[clamp(13rem,30dvh,17rem)_minmax(0,1fr)] xl:grid-cols-[minmax(300px,0.88fr)_minmax(420px,1.12fr)] xl:grid-rows-1">
            <section aria-label={`${persona.name} 캐릭터 스테이지`} className="relative min-h-0 overflow-hidden border-b border-[#efd6df] bg-[#f8e9ef] xl:border-b-0 xl:border-r">
              {persona.backgroundImage && (
                <img src={persona.backgroundImage} alt="" className="absolute inset-0 h-full w-full object-cover opacity-75" />
              )}
              <div aria-hidden="true" className="absolute inset-0 bg-[#4f2836]/10" />
              <div className="absolute left-3 top-3 z-20 flex items-center gap-2 sm:left-4 sm:top-4">
                <EmotionBadge emotion={currentEmotion} />
                <span className="rounded-full border border-white/70 bg-white/[0.85] px-2.5 py-1 text-[11px] font-bold text-[#3f8b76] shadow-sm backdrop-blur-sm">{relationshipStage}</span>
              </div>
              {persona.portrait ? (
                <img
                  src={persona.portrait}
                  alt={`${persona.name} 일러스트`}
                  className="absolute inset-x-0 bottom-0 z-10 mx-auto h-[94%] w-full object-contain object-bottom drop-shadow-2xl"
                />
              ) : (
                <div className="absolute inset-0 z-10 flex items-center justify-center">
                  <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-white/80 bg-[#ffdce6] text-[5rem] font-bold text-[#c95f81] shadow-xl">
                    {persona.name.slice(0, 1)}
                  </div>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 z-20 border-t border-white/80 bg-white/[0.88] px-4 py-3 backdrop-blur-sm">
                <p className="font-bold text-[#4d3a43]">{persona.name}</p>
                <p className="mt-0.5 truncate text-xs text-[#806b74]">{persona.role.value || persona.personality.value || '캐릭터 역할극'}</p>
              </div>
            </section>

            <section className="flex min-h-0 min-w-0 flex-col bg-[#fff9fb]">
              <CharacterStatusBar
                affinity={session.affinity}
                relationshipStage={relationshipStage}
                emotion={currentEmotion}
                turnCount={session.messages.filter((message) => message.role === 'user').length}
                pinnedCount={session.messages.filter((message) => message.isPinned).length}
                summarizedMessageCount={session.summarizedMessageCount}
                messageCount={session.messages.length}
                source={source}
                isSummarizing={isSummarizing}
              />
              <div
                ref={scrollRef}
                onScroll={(event) => {
                  const element = event.currentTarget;
                  shouldStickToBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 140;
                }}
                className="min-h-0 flex-1 overflow-y-auto px-3 py-5 sm:px-5"
              >
                <div className="mx-auto w-full max-w-2xl space-y-5">
                  {session.messages.length === 0 && (
                    <div className="py-10 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#fff0f4] text-[#d85e84]"><ChatBubbleThoughtIcon className="h-6 w-6" /></div>
                      <h2 className="mt-4 text-base font-bold text-[#55434b]">{userPersona.name}으로 장면에 들어왔어</h2>
                      <p className="mt-1 text-sm text-[#9a838d]">{persona.name}에게 첫 대사나 행동을 건네보자.</p>
                    </div>
                  )}
                  {session.messages.map((message, index) => (
                    <CharacterChatMessage
                      key={message.id}
                      message={message}
                      personaName={persona.name}
                      userPersonaName={userPersona.name}
                      portrait={persona.portrait}
                      isEditing={editingMessageId === message.id}
                      editingText={editingText}
                      disabled={isSending}
                      canRegenerate={message.role === 'assistant' && session.messages[index - 1]?.role === 'user'}
                      onEditingTextChange={setEditingText}
                      onStartEdit={() => { setEditingMessageId(message.id); setEditingText(message.content); }}
                      onCancelEdit={() => { setEditingMessageId(null); setEditingText(''); }}
                      onSaveEdit={() => saveEditedMessage(message.id)}
                      onPin={() => handlePin(message.id)}
                      onBranch={() => handleBranch(message.id)}
                      onRewind={() => handleRewind(message.id)}
                      onRegenerate={() => handleRegenerate(message.id)}
                    />
                  ))}
                  {streamingText && (
                    <div className="flex items-start gap-3">
                      <CharacterAvatar name={persona.name} portrait={persona.portrait} />
                      <div className="max-w-[90%] rounded-md border border-[#f0dce3] bg-white px-4 py-3 shadow-sm">
                        <p className="mb-2 text-[11px] font-bold text-[#bd5a7a]">{persona.name}</p>
                        <RoleplayContent content={streamingRoleplay.content || streamingText} blocks={streamingRoleplay.blocks} />
                      </div>
                    </div>
                  )}
                  {isSending && !streamingText && <p className="pl-12 text-sm font-medium text-[#a58c96]">{persona.name}이 반응을 고르는 중...</p>}
                </div>
              </div>

              <div className="shrink-0 border-t border-[#efd6df] bg-white p-3 sm:p-4">
                <div className="mx-auto w-full max-w-2xl">
                  <QuickRoleplayActions disabled={isSending} onSelect={addQuickAction} />
                  {error && (
                    <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <span>{error}</span>
                      <button type="button" onClick={retryLastReply} disabled={isSending} className="shrink-0 font-semibold text-red-700 hover:text-red-900">다시 시도</button>
                    </div>
                  )}
                  <div className="flex items-end gap-2 rounded-md border border-[#e8cbd5] bg-[#fff9fb] p-2 shadow-sm focus-within:border-[#ef7fa2] focus-within:ring-2 focus-within:ring-[#ffd8e4]">
                    <textarea
                      aria-label={`${persona.name}에게 메시지`}
                      value={input}
                      onChange={(event) => setInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void handleSend();
                        }
                      }}
                      rows={1}
                      placeholder={`${userPersona.name}의 대사나 행동...`}
                      className="max-h-36 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 text-[#44363d] outline-none placeholder:text-[#b79fa8]"
                    />
                    {isSending ? (
                      <button type="button" onClick={() => abortRef.current?.abort()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8d7881] text-white hover:bg-[#715e66]" title="응답 중단">
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    ) : (
                      <button type="button" onClick={handleSend} disabled={!input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ec668f] text-white shadow-sm hover:bg-[#d9507b] disabled:cursor-not-allowed disabled:opacity-40" title="보내기">
                        <PaperAirplaneIcon className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-2 flex items-center justify-between text-[11px] text-[#a58c96]">
                    <span>역할: {userPersona.name}</span>
                    <span>{isSummarizing ? '기억 정리 중...' : `기억 ${session.summarizedMessageCount}/${session.messages.length}`}</span>
                  </p>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

function InfoBlock({ title, value, empty = '설정되지 않았어.' }: { title: string; value: string; empty?: string }) {
  return (
    <div>
      <h3 className="text-xs font-bold text-[#b45a78]">{title}</h3>
      <p className="mt-1 whitespace-pre-wrap leading-6 text-[#6f5a63]">{value || empty}</p>
    </div>
  );
}

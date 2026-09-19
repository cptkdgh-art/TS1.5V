/**
 * ============================================================
 * @module modules/author/components
 * @file ClioDirectorModal.tsx
 * ============================================================
 * @description 기본작가 클리오와 분리된 총괄감독 클리오 작업공간
 * ============================================================
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AiAuthor,
  Content,
  DirectorAuthorProposal,
  DirectorAuthorProposalDraft,
  DirectorClioReadMode,
} from '@core/types';
import {
  BookOpenIcon,
  Button,
  ChatBubbleThoughtIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
  Input,
  Modal,
  PaperAirplaneIcon,
  SparklesIcon,
  Textarea,
  UserPlusIcon,
  toast,
} from '@shared/components';
import { chatWithDirectorClio, summarizeClioChatHistory } from '@services/ai/chat';
import {
  buildDirectorNovelCatalog,
  buildDirectorNovelContext,
  resolveDirectorNovelReference,
} from '@services/director-clio';
import { useAuthorStore } from '@stores/authorStore';
import { useDirectorClioStore } from '@stores/directorClioStore';
import { useNovelStore } from '@stores/novelStore';
import { useSeriesStore } from '@stores/seriesStore';

interface ClioDirectorModalProps {
  onClose: () => void;
}

const READ_MODE_LABELS: Record<DirectorClioReadMode, string> = {
  overview: '개요만',
  recent: '요약 + 최근 원문',
  full: '전권 원문',
};

const QUICK_PROMPTS = [
  '현재 작품의 연재 전략과 가장 먼저 고칠 부분을 진단해줘.',
  '앞으로 10화의 전개 방향을 여러 선택지로 설계해줘.',
  '이 작품에 가장 잘 맞는 기존 AI 작가를 이유와 함께 추천해줘.',
  '이 작품만을 위한 새 맞춤 작가의 완성 프로필을 설계해줘. 작가명, 전문분야, 문체, 핵심 집필 지침, 태그까지 제시해줘.',
];
const EMPTY_CHAT_HISTORY: Content[] = [];

function sessionKey(novelId: string | null): string {
  return novelId || 'studio';
}

function messageText(message: Content): string {
  return (message.parts || [])
    .map((part) => ('text' in part && typeof part.text === 'string' ? part.text : ''))
    .join('\n');
}

interface AuthorProposalEditorProps {
  proposal: DirectorAuthorProposal;
  novelTitle?: string;
  onCreate: (details: DirectorAuthorProposalDraft, assignToNovel: boolean) => Promise<void>;
}

function AuthorProposalEditor({ proposal, novelTitle, onCreate }: AuthorProposalEditorProps) {
  const [draft, setDraft] = useState<DirectorAuthorProposalDraft>({
    schemaVersion: 2,
    name: proposal.name,
    specialty: proposal.specialty,
    writingStyle: proposal.writingStyle,
    coreDirectives: proposal.coreDirectives,
    tags: [...proposal.tags],
    identityCore: structuredClone(proposal.identityCore),
  });
  const [tagText, setTagText] = useState(proposal.tags.join(', '));
  const [assignToNovel, setAssignToNovel] = useState(Boolean(novelTitle));
  const [isCreating, setIsCreating] = useState(false);
  const creatingRef = useRef(false);
  const isCreated = Boolean(proposal.createdAuthorId);
  const canCreate = draft.name.trim()
    && draft.specialty.trim()
    && draft.writingStyle.trim()
    && draft.coreDirectives.trim()
    && draft.identityCore.selfDefinition.trim()
    && draft.identityCore.reasonToWrite.trim()
    && draft.identityCore.voiceOrigins.trim()
    && draft.identityCore.readabilityPractice.trim()
    && draft.identityCore.plausibilityPractice.trim();

  const updateField = (field: 'name' | 'specialty' | 'writingStyle' | 'coreDirectives', value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  const updateIdentityText = (
    field: 'selfDefinition' | 'reasonToWrite' | 'worldview' | 'viewOfHumanity'
      | 'readerRelationship' | 'creativeEthics' | 'voiceOrigins'
      | 'readabilityPractice' | 'plausibilityPractice',
    value: string,
  ) => {
    setDraft((current) => ({
      ...current,
      identityCore: { ...current.identityCore, [field]: value, updatedAt: Date.now() },
    }));
  };

  const lines = (value: string) => [...new Set(value.split('\n').map((item) => item.trim()).filter(Boolean))];
  const updateIdentityList = (field: 'recurringQuestions' | 'narrativeInstincts', value: string) => {
    setDraft((current) => ({
      ...current,
      identityCore: { ...current.identityCore, [field]: lines(value), updatedAt: Date.now() },
    }));
  };

  const handleCreate = async () => {
    if (!canCreate || creatingRef.current || isCreating || isCreated) return;
    creatingRef.current = true;
    setIsCreating(true);
    try {
      const tags = [...new Set(tagText.split(',').map((tag) => tag.trim()).filter(Boolean))].slice(0, 8);
      await onCreate({
        ...draft,
        name: draft.name.trim(),
        specialty: draft.specialty.trim(),
        writingStyle: draft.writingStyle.trim(),
        coreDirectives: draft.coreDirectives.trim(),
        tags,
      }, assignToNovel);
    } finally {
      creatingRef.current = false;
      setIsCreating(false);
    }
  };

  return (
    <div data-testid="director-author-proposal" className="mt-3 border-t border-purple-700/60 pt-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-purple-200">
        {isCreated
          ? <CheckCircleIcon className="h-5 w-5 text-emerald-400" />
          : <UserPlusIcon className="h-5 w-5" />}
        <span>{isCreated ? '작가 생성 완료' : '클리오의 맞춤 작가 설계'}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="작가명"
          value={draft.name}
          onChange={(event) => updateField('name', event.target.value)}
          disabled={isCreated}
        />
        <Input
          label="태그"
          value={tagText}
          onChange={(event) => setTagText(event.target.value)}
          placeholder="쉼표로 구분"
          disabled={isCreated}
        />
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Textarea
          label="전문분야"
          value={draft.specialty}
          onChange={(event) => updateField('specialty', event.target.value)}
          rows={4}
          disabled={isCreated}
        />
        <Textarea
          label="문체"
          value={draft.writingStyle}
          onChange={(event) => updateField('writingStyle', event.target.value)}
          rows={4}
          disabled={isCreated}
        />
        <Textarea
          label="핵심 집필 지침"
          value={draft.coreDirectives}
          onChange={(event) => updateField('coreDirectives', event.target.value)}
          rows={4}
          disabled={isCreated}
        />
      </div>

      <details className="mt-3 rounded-md border border-purple-800/60 bg-gray-950/35 p-3" open>
        <summary className="cursor-pointer text-sm font-semibold text-purple-200">
          작가의 내면과 작품관
        </summary>
        <p className="mt-2 text-xs leading-5 text-gray-400">
          특정 작품 설정이나 적응이 아니라, 어떤 작품에서도 유지되는 작가 자신의 관점이야.
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Textarea label="자기 정의" value={draft.identityCore.selfDefinition} onChange={(event) => updateIdentityText('selfDefinition', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="쓰는 이유" value={draft.identityCore.reasonToWrite} onChange={(event) => updateIdentityText('reasonToWrite', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="세계관" value={draft.identityCore.worldview} onChange={(event) => updateIdentityText('worldview', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="인간관" value={draft.identityCore.viewOfHumanity} onChange={(event) => updateIdentityText('viewOfHumanity', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="독자와의 관계" value={draft.identityCore.readerRelationship} onChange={(event) => updateIdentityText('readerRelationship', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="창작 윤리" value={draft.identityCore.creativeEthics} onChange={(event) => updateIdentityText('creativeEthics', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="문체의 내적 기원" value={draft.identityCore.voiceOrigins} onChange={(event) => updateIdentityText('voiceOrigins', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="정서적 질감" value={draft.identityCore.aestheticTaste.emotionalTexture} onChange={(event) => setDraft((current) => ({ ...current, identityCore: { ...current.identityCore, aestheticTaste: { ...current.identityCore.aestheticTaste, emotionalTexture: event.target.value }, updatedAt: Date.now() } }))} rows={3} disabled={isCreated} />
          <Textarea label="가독성을 지키는 자기 방식" value={draft.identityCore.readabilityPractice} onChange={(event) => updateIdentityText('readabilityPractice', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="개연성을 지키는 자기 방식" value={draft.identityCore.plausibilityPractice} onChange={(event) => updateIdentityText('plausibilityPractice', event.target.value)} rows={3} disabled={isCreated} />
          <Textarea label="반복해서 탐구하는 질문" value={draft.identityCore.recurringQuestions.join('\n')} onChange={(event) => updateIdentityList('recurringQuestions', event.target.value)} rows={4} placeholder="한 줄에 하나" disabled={isCreated} />
          <Textarea label="서사적 본능" value={draft.identityCore.narrativeInstincts.join('\n')} onChange={(event) => updateIdentityList('narrativeInstincts', event.target.value)} rows={4} placeholder="한 줄에 하나" disabled={isCreated} />
          <Textarea label="끌리는 미감" value={draft.identityCore.aestheticTaste.drawnTo.join('\n')} onChange={(event) => setDraft((current) => ({ ...current, identityCore: { ...current.identityCore, aestheticTaste: { ...current.identityCore.aestheticTaste, drawnTo: lines(event.target.value) }, updatedAt: Date.now() } }))} rows={4} placeholder="한 줄에 하나" disabled={isCreated} />
          <Textarea label="피하는 미감" value={draft.identityCore.aestheticTaste.avoids.join('\n')} onChange={(event) => setDraft((current) => ({ ...current, identityCore: { ...current.identityCore, aestheticTaste: { ...current.identityCore.aestheticTaste, avoids: lines(event.target.value) }, updatedAt: Date.now() } }))} rows={4} placeholder="한 줄에 하나" disabled={isCreated} />
          <Textarea label="문학적 신념" value={draft.identityCore.literaryValues.map((value) => [value.belief, value.creativeEffect, value.doubt].join(' | ')).join('\n')} onChange={(event) => setDraft((current) => ({ ...current, identityCore: { ...current.identityCore, literaryValues: lines(event.target.value).map((line) => { const [belief = '', creativeEffect = '', doubt = ''] = line.split('|').map((item) => item.trim()); return { belief, creativeEffect, doubt }; }).filter((item) => item.belief && item.creativeEffect), updatedAt: Date.now() } }))} rows={5} placeholder="신념 | 창작에 미치는 영향 | 남겨 둔 의심" disabled={isCreated} />
          <Textarea label="내적 긴장" value={draft.identityCore.innerContradictions.map((value) => [value.valueA, value.valueB, value.unresolvedReason].join(' | ')).join('\n')} onChange={(event) => setDraft((current) => ({ ...current, identityCore: { ...current.identityCore, innerContradictions: lines(event.target.value).map((line) => { const [valueA = '', valueB = '', unresolvedReason = ''] = line.split('|').map((item) => item.trim()); return { valueA, valueB, unresolvedReason }; }).filter((item) => item.valueA && item.valueB && item.unresolvedReason), updatedAt: Date.now() } }))} rows={5} placeholder="가치 A | 가치 B | 풀리지 않는 이유" disabled={isCreated} />
        </div>
      </details>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {novelTitle && !isCreated ? (
          <label className="inline-flex min-h-9 items-center gap-2 text-sm text-gray-300">
            <input
              type="checkbox"
              checked={assignToNovel}
              onChange={(event) => setAssignToNovel(event.target.checked)}
              className="h-4 w-4 accent-purple-600"
            />
            <span className="break-words">'{novelTitle}' 담당 작가로 지정</span>
          </label>
        ) : (
          <span className="text-sm text-emerald-300">
            {proposal.assignedNovelId && novelTitle ? `'${novelTitle}' 담당 작가로 연결됨` : ''}
          </span>
        )}
        <Button
          variant="purple"
          onClick={() => void handleCreate()}
          disabled={!canCreate || isCreated}
          isLoading={isCreating}
          leftIcon={<UserPlusIcon className="h-4 w-4" />}
          className="min-h-10 w-full sm:w-auto"
        >
          {isCreated ? '생성됨' : '이대로 작가 생성'}
        </Button>
      </div>
    </div>
  );
}

export function ClioDirectorModal({ onClose }: ClioDirectorModalProps) {
  const authors = useAuthorStore((state) => state.authors);
  const addAuthor = useAuthorStore((state) => state.addAuthor);
  const novels = useNovelStore((state) => state.novels);
  const updateNovel = useNovelStore((state) => state.updateNovel);
  const seriesList = useSeriesStore((state) => state.seriesList);
  const memories = useDirectorClioStore((state) => state.memories);
  const sessions = useDirectorClioStore((state) => state.sessions);
  const activeNovelId = useDirectorClioStore((state) => state.activeNovelId);
  const setActiveNovel = useDirectorClioStore((state) => state.setActiveNovel);
  const updateSession = useDirectorClioStore((state) => state.updateSession);

  const [inputMessage, setInputMessage] = useState('');
  const isLoading = useDirectorClioStore((state) => Boolean(state.requests[sessionKey(state.activeNovelId)]));
  const [isPersistingScope, setIsPersistingScope] = useState(false);
  const [isMobileContextOpen, setIsMobileContextOpen] = useState(false);
  const [isMobileSummaryOpen, setIsMobileSummaryOpen] = useState(false);
  const [ambiguousNovelIds, setAmbiguousNovelIds] = useState<string[]>([]);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const catalog = useMemo(
    () => buildDirectorNovelCatalog(novels, seriesList, authors),
    [novels, seriesList, authors]
  );
  const activeNovel = activeNovelId
    ? novels.find((novel) => novel.id === activeNovelId) || null
    : null;
  const activeReference = activeNovelId
    ? catalog.find((reference) => reference.id === activeNovelId) || null
    : null;
  const currentSession = sessions[sessionKey(activeNovelId)];
  const chatHistory = currentSession?.history || EMPTY_CHAT_HISTORY;
  const readMode = currentSession?.readMode || 'recent';

  useEffect(() => {
    if (activeNovelId && !activeNovel) {
      void setActiveNovel(null);
    }
  }, [activeNovel, activeNovelId, setActiveNovel]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, isLoading]);

  const selectNovel = async (novelId: string | null) => {
    setAmbiguousNovelIds([]);
    await setActiveNovel(novelId);
  };

  const handleReadModeChange = async (mode: DirectorClioReadMode) => {
    if (!activeNovelId || isLoading || isPersistingScope) return;
    setIsPersistingScope(true);
    try {
      await updateSession(activeNovelId, { readMode: mode });
    } finally {
      setIsPersistingScope(false);
    }
  };

  const handleSendMessage = async () => {
    const prompt = inputMessage.trim();
    if (!prompt || isLoading) return;

    const resolvedReferences = resolveDirectorNovelReference(prompt, catalog);
    let targetNovelId = activeNovelId;

    if (resolvedReferences.length > 1 && !resolvedReferences.some((item) => item.id === activeNovelId)) {
      setAmbiguousNovelIds(resolvedReferences.map((item) => item.id));
      toast.info('같은 이름으로 찾은 작품이 여러 개입니다. 상담할 작품을 먼저 골라주세요.');
      return;
    }
    if (resolvedReferences.length === 1) {
      targetNovelId = resolvedReferences[0].id;
    }

    const targetNovel = targetNovelId
      ? novels.find((novel) => novel.id === targetNovelId) || null
      : null;
    const targetReference = targetNovelId
      ? catalog.find((reference) => reference.id === targetNovelId) || null
      : null;
    const targetSeries = targetNovel?.seriesId
      ? seriesList.find((series) => series.id === targetNovel.seriesId) || null
      : null;
    const targetAuthor = targetNovel?.aiAuthorId
      ? authors.find((author) => author.id === targetNovel.aiAuthorId) || null
      : null;
    const targetKey = sessionKey(targetNovelId);
    const targetSession = useDirectorClioStore.getState().sessions[targetKey];
    const targetHistory = targetSession?.history || [];
    const targetReadMode = targetSession?.readMode || 'recent';
    const userMessage: Content = { role: 'user', parts: [{ text: prompt }] };
    const pendingHistory = [...targetHistory, userMessage];
    const { beginRequest, applyRequest, finishRequest } = useDirectorClioStore.getState();
    const request = beginRequest(targetNovelId);
    if (!request) return;

    setInputMessage('');
    setAmbiguousNovelIds([]);
    try {
      if (targetNovelId !== activeNovelId) await setActiveNovel(targetNovelId);
      if (!await applyRequest(targetNovelId, request, () => ({
        history: pendingHistory,
        readMode: targetReadMode,
      }))) return;
      const workContext = targetNovel
        ? buildDirectorNovelContext(targetNovel, targetAuthor, targetSeries, targetReadMode)
        : null;
      if (workContext?.truncated) {
        toast.info('원고가 매우 길어 안전 한도까지 읽었습니다. 클리오가 읽은 범위를 답변에 표시합니다.');
      }

      const response = await chatWithDirectorClio(prompt, targetHistory, {
        summary: targetSession?.summary,
        memories,
        authors,
        workCatalog: catalog,
        activeWorkContext: workContext?.text,
        authorProposals: targetSession?.authorProposals,
      });
      const modelMessage: Content = { role: 'model', parts: [{ text: response.text }] };
      const applied = await applyRequest(targetNovelId, request, (current) => ({
        history: [...current.history, modelMessage],
        authorProposals: response.authorProposal
        ? [...(current.authorProposals || []), {
          ...response.authorProposal,
          id: crypto.randomUUID(),
          createdAt: Date.now(),
          afterMessageIndex: current.history.length,
          sourceNovelId: targetNovelId,
        }]
        : current.authorProposals,
      }));
      if (applied && targetReference && targetNovelId !== activeNovelId) {
        toast.success(`'${targetReference.title}' 작품을 찾아 상담 문맥에 연결했습니다.`);
      }
    } catch (error) {
      console.error('총괄감독 클리오 대화 실패:', error);
      toast.error('총괄감독 클리오와 대화 중 오류가 발생했습니다.');
    } finally {
      finishRequest(targetNovelId, request);
    }
  };

  const handleSummarize = async () => {
    if (chatHistory.length < 4 || isLoading) return;
    const { beginRequest, applyRequest, finishRequest } = useDirectorClioStore.getState();
    const request = beginRequest(activeNovelId);
    if (!request) return;
    try {
      if (!request.revision || request.revision.history.length < 4) return;
      const target = request.revision;
      const summary = await summarizeClioChatHistory(target.history);
      const applied = await applyRequest(activeNovelId, request, () => ({
        history: [],
        authorProposals: [],
        summary,
        readMode: target.readMode,
      }));
      if (applied) toast.success('현재 상담 범위의 대화를 요약해 저장했습니다.');
    } catch (error) {
      console.error('총괄감독 대화 요약 실패:', error);
      toast.error('요약에 실패했습니다.');
    } finally {
      finishRequest(activeNovelId, request);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  const handleCreateAuthor = async (
    proposal: DirectorAuthorProposal,
    details: DirectorAuthorProposalDraft,
    assignToNovel: boolean,
  ) => {
    if (proposal.createdAuthorId) return;
    const author: AiAuthor = {
      id: crypto.randomUUID(),
      name: details.name,
      specialty: details.specialty,
      writingStyle: details.writingStyle,
      coreDirectives: details.coreDirectives,
      tags: details.tags,
      identityCore: structuredClone(details.identityCore),
      createdAt: Date.now(),
      memoryCache: [],
      metaChatHistory: [],
      generalChatHistory: [],
      isDefault: false,
    };

    await addAuthor(author);
    let assignedNovelId: string | undefined;
    if (assignToNovel && proposal.sourceNovelId) {
      const targetNovel = useNovelStore.getState().novels.find((item) => item.id === proposal.sourceNovelId);
      if (targetNovel) {
        await updateNovel(targetNovel.id, { aiAuthorId: author.id });
        assignedNovelId = targetNovel.id;
      }
    }

    const key = sessionKey(proposal.sourceNovelId);
    const latestSession = useDirectorClioStore.getState().sessions[key];
    await updateSession(proposal.sourceNovelId, {
      authorProposals: (latestSession?.authorProposals || []).map((item) => (
        item.id === proposal.id
          ? { ...item, ...details, createdAuthorId: author.id, assignedNovelId }
          : item
      )),
    });
    toast.success(assignedNovelId
      ? `'${author.name}' 작가를 생성하고 작품에 배정했습니다.`
      : `'${author.name}' 작가를 현재 작업실에 생성했습니다.`);
  };

  const renderContextControls = (compact: boolean) => (
    <>
      <div className={`flex flex-col gap-3 ${compact ? '' : 'lg:flex-row lg:items-end'}`}>
        <label className="min-w-0 flex-1">
          <span className="mb-1 block text-xs font-semibold text-gray-400">상담 작품</span>
          <select
            aria-label={compact ? '모바일 총괄감독 상담 작품' : '총괄감독 상담 작품'}
            value={activeNovelId || ''}
            onChange={(event) => void selectNovel(event.target.value || null)}
            disabled={isLoading}
            className="w-full rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-white"
          >
            <option value="">스튜디오 전체 상담</option>
            {catalog.map((reference) => (
              <option key={reference.id} value={reference.id}>
                {reference.title}
                {reference.seriesTitle ? ` · ${reference.seriesTitle} ${reference.volumeNumber ?? '?'}권` : ''}
                {` · ${reference.displayId}`}
              </option>
            ))}
          </select>
        </label>

        <div>
          <span className="mb-1 block text-xs font-semibold text-gray-400">읽기 범위</span>
          <div className="grid grid-cols-3 rounded-md border border-gray-600 bg-gray-900 p-1">
            {(Object.keys(READ_MODE_LABELS) as DirectorClioReadMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => void handleReadModeChange(mode)}
                disabled={!activeNovel || isLoading || isPersistingScope}
                className={`min-h-8 px-2 text-xs transition-colors ${
                  readMode === mode && activeNovel
                    ? 'rounded bg-purple-600 font-semibold text-white'
                    : 'text-gray-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-40'
                }`}
              >
                <span className="sm:hidden">
                  {mode === 'recent' ? '요약+최근' : READ_MODE_LABELS[mode]}
                </span>
                <span className="hidden sm:inline">{READ_MODE_LABELS[mode]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div
        data-testid={compact ? 'director-clio-mobile-context' : 'director-clio-desktop-context'}
        className={`${compact ? 'mt-2' : 'mt-3'} flex min-h-11 flex-wrap items-center gap-x-4 gap-y-1 bg-gray-900/70 px-3 py-2 text-xs text-gray-300`}
      >
        {activeReference ? (
          <>
            <span className="inline-flex min-w-0 items-center gap-1.5 font-semibold text-purple-300">
              <BookOpenIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{activeReference.title}</span>
            </span>
            <span title={activeReference.id}>작품 ID {activeReference.displayId}</span>
            {!compact && <span>{activeReference.chapterCount}화</span>}
            {!compact && <span>담당 작가 {activeReference.authorName}</span>}
            <span className="text-emerald-300">{READ_MODE_LABELS[readMode]} 연결</span>
          </>
        ) : (
          <>
            <ChatBubbleThoughtIcon className="h-4 w-4 shrink-0 text-purple-300" />
            <span>
              {compact
                ? '작품을 고르거나 대화에서 작품 이름을 말해줘.'
                : '작품 명부만 보고 있어. 제목을 말하거나 목록에서 고르면 그 작품을 읽고 상담해.'}
            </span>
          </>
        )}
      </div>
    </>
  );

  return (
    <Modal isOpen onClose={onClose} title="총괄감독 클리오" size="full">
      <div className="flex h-[calc(100dvh-7.75rem)] min-h-0 flex-col sm:h-[76vh] sm:min-h-[520px]">
        <div className="border-b border-gray-700 pb-3">
          <div className="sm:hidden">
            <button
              type="button"
              aria-expanded={isMobileContextOpen}
              aria-label={`작품 설정 ${isMobileContextOpen ? '닫기' : '열기'}`}
              onClick={() => setIsMobileContextOpen((open) => !open)}
              className="flex min-h-10 w-full items-center gap-2 rounded-md bg-gray-900/80 px-3 text-left text-sm text-gray-200"
            >
              <span className="shrink-0 font-semibold text-purple-300">작품 설정</span>
              <span className="min-w-0 flex-1 truncate text-xs text-gray-400">
                {activeReference?.title || '스튜디오 전체'} · {activeNovel ? `${READ_MODE_LABELS[readMode]} 연결` : '명부만'}
              </span>
              {isMobileContextOpen
                ? <ChevronUpIcon className="h-4 w-4 shrink-0" />
                : <ChevronDownIcon className="h-4 w-4 shrink-0" />}
            </button>
            {isMobileContextOpen && (
              <div className="pt-3">
                {renderContextControls(true)}
              </div>
            )}
          </div>
          <div className="hidden sm:block">
            {renderContextControls(false)}
          </div>
        </div>

        {ambiguousNovelIds.length > 0 && (
          <div className="border-b border-amber-700/60 bg-amber-950/30 px-3 py-2">
            <p className="mb-2 text-xs font-semibold text-amber-300">어느 작품을 말하는지 골라줘.</p>
            <div className="flex flex-wrap gap-2">
              {ambiguousNovelIds.map((id) => {
                const reference = catalog.find((item) => item.id === id);
                if (!reference) return null;
                return (
                  <Button key={id} size="sm" variant="gray" onClick={() => void selectNovel(id)}>
                    {reference.title} · {reference.displayId}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {currentSession?.summary && (
          <>
            <div className="border-b border-purple-800/60 bg-purple-950/25 px-3 py-2 sm:hidden">
              <button
                type="button"
                aria-expanded={isMobileSummaryOpen}
                onClick={() => setIsMobileSummaryOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-2 text-left text-xs font-semibold text-purple-300"
              >
                <span>이전 상담 결론 {isMobileSummaryOpen ? '접기' : '보기'}</span>
                {isMobileSummaryOpen
                  ? <ChevronUpIcon className="h-4 w-4" />
                  : <ChevronDownIcon className="h-4 w-4" />}
              </button>
              {isMobileSummaryOpen && (
                <p className="mt-2 max-h-28 overflow-y-auto text-sm text-gray-300">
                  {currentSession.summary}
                </p>
              )}
            </div>
            <div className="hidden border-b border-purple-800/60 bg-purple-950/25 px-3 py-2 text-sm sm:block">
              <span className="font-semibold text-purple-300">이 상담의 이전 결론: </span>
              <span className="text-gray-300">{currentSession.summary}</span>
            </div>
          </>
        )}

        <div
          ref={chatContainerRef}
          data-testid="director-clio-chat"
          className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3 pr-1 sm:space-y-4 sm:py-4 sm:pr-2"
        >
          {chatHistory.length === 0 && (
            <div className="mx-auto max-w-xl py-4 text-center text-gray-400 sm:py-8">
              <SparklesIcon className="mx-auto mb-2 h-7 w-7 text-purple-300 sm:mb-3 sm:h-8 sm:w-8" />
              <p className="font-semibold text-gray-200">
                {activeNovel ? `'${activeNovel.title}' 전략 상담을 시작해.` : '총괄감독에게 작품 이름을 말해봐.'}
              </p>
              <p className="mt-2 text-sm leading-5">
                총괄감독 클리오는 기본작가 클리오와 별개이며, 선택한 작품만 읽고 전략과 작가 운용을 조언해.
              </p>
            </div>
          )}
          {chatHistory.map((message, index) => {
            const proposal = currentSession?.authorProposals?.find((item) => item.afterMessageIndex === index);
            const proposalNovel = proposal?.sourceNovelId
              ? novels.find((novel) => novel.id === proposal.sourceNovelId)
              : undefined;
            return (
            <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`${proposal ? 'w-full max-w-4xl' : 'max-w-[86%]'} rounded-md px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-700 bg-gray-800 text-gray-200'
              }`}>
                <p className="whitespace-pre-wrap">{messageText(message)}</p>
                {proposal && (
                  <AuthorProposalEditor
                    key={proposal.id}
                    proposal={proposal}
                    novelTitle={proposalNovel?.title}
                    onCreate={(details, assignToNovel) => handleCreateAuthor(proposal, details, assignToNovel)}
                  />
                )}
              </div>
            </div>
            );
          })}
          {isLoading && (
            <div className="flex justify-start">
              <div className="rounded-md border border-gray-700 bg-gray-800 px-4 py-3">
                <p className="animate-pulse text-gray-400">클리오가 작품과 작가 구성을 함께 살피는 중...</p>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-700 pt-3">
          <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
            {QUICK_PROMPTS.map((prompt, index) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInputMessage(prompt)}
                disabled={isLoading}
                className="min-h-8 shrink-0 rounded border border-gray-600 bg-gray-800 px-2.5 py-1.5 text-xs text-gray-300 hover:border-purple-500 hover:text-white disabled:opacity-40"
              >
                {index === 0 ? '전략 진단' : index === 1 ? '다음 10화' : index === 2 ? '기존 작가 추천' : '맞춤 작가 설계'}
              </button>
            ))}
          </div>
          <div className="flex items-end gap-2">
            <textarea
              aria-label="총괄감독 클리오에게 보낼 메시지"
              value={inputMessage}
              onChange={(event) => setInputMessage(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="예: 혈마전기 읽고 다음 10화 전략과 담당 작가 조합을 봐줘."
              className="min-h-14 flex-1 resize-none rounded-md border border-gray-600 bg-gray-800 p-3 text-white placeholder:text-gray-500 sm:min-h-20"
              rows={2}
              disabled={isLoading}
            />
            <Button
              variant="primary"
              onClick={() => void handleSendMessage()}
              disabled={!inputMessage.trim() || isLoading}
              title="메시지 전송"
            >
              <PaperAirplaneIcon className="h-5 w-5" />
              <span className="sr-only">전송</span>
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-gray-500">
              <DocumentTextIcon className="h-4 w-4" />
              <span className="sm:hidden">요약 Lite · 상담 Flash</span>
              <span className="hidden sm:inline">
                요약은 Flash Lite · 상담은 Flash · 전권 원문은 직접 선택할 때만 전달돼.
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void handleSummarize()}
              disabled={chatHistory.length < 4 || isLoading}
            >
              <span className="sm:hidden">대화 정리</span>
              <span className="hidden sm:inline">대화 요약 및 정리</span>
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

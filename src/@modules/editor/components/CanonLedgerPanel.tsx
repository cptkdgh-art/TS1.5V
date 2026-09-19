import { useMemo, useState } from 'react';
import type { CanonFact, CanonFactKind, Novel } from '@core/types';
import { getChapterDisplayId, inspectCanonFacts } from '@services/novel';
import {
  BrainIcon,
  DeviceFloppyIcon,
  LockClosedIcon,
  LockOpenIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
  XMarkIcon,
  toast,
  useConfirmDialog,
} from '@shared/components';

interface CanonLedgerPanelProps {
  novel: Novel;
  onMutateNovel: (id: string, updater: (current: Novel) => Novel) => Promise<Novel | undefined>;
}

const KIND_LABELS: Record<CanonFactKind, string> = {
  'character-state': '인물 상태',
  relationship: '관계',
  possession: '소유물',
  secret: '비밀',
  location: '위치',
  'world-rule': '세계 규칙',
  other: '기타',
};

type CanonDraft = Pick<CanonFact,
  'kind' | 'subject' | 'value' | 'sourceChapterId' | 'validFromChapterId' |
  'validUntilChapterId' | 'status' | 'locked' | 'supersedesFactId'>;

const EMPTY_DRAFT: CanonDraft = {
  kind: 'character-state',
  subject: '',
  value: '',
  status: 'confirmed',
  locked: false,
};

export function CanonLedgerPanel({ novel, onMutateNovel }: CanonLedgerPanelProps) {
  const confirm = useConfirmDialog();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CanonDraft>(EMPTY_DRAFT);
  const states = useMemo(() => inspectCanonFacts(novel), [novel]);
  const chapterById = useMemo(
    () => new Map(novel.chapters.flatMap((chapter, index) => chapter.id ? [[chapter.id, { chapter, index }] as const] : [])),
    [novel.chapters],
  );

  const reset = () => {
    setEditingId(null);
    setDraft(EMPTY_DRAFT);
  };

  const save = async () => {
    const subject = draft.subject.trim();
    const value = draft.value.trim();
    if (!subject || !value) {
      toast.warning('대상과 확정 사실을 모두 입력해주세요.');
      return;
    }
    const now = Date.now();
    await onMutateNovel(novel.id, (current) => {
      const source = draft.sourceChapterId
        ? current.chapters.find((chapter) => chapter.id === draft.sourceChapterId)
        : undefined;
      const fact: CanonFact = {
        id: editingId ?? crypto.randomUUID(),
        ...draft,
        subject,
        value,
        sourceRevision: source ? (source.trace?.revision ?? 1) : undefined,
        createdAt: editingId
          ? current.canonFacts?.find((item) => item.id === editingId)?.createdAt ?? now
          : now,
        updatedAt: now,
      };
      const existing = current.canonFacts ?? [];
      return {
        ...current,
        canonFacts: editingId
          ? existing.map((item) => item.id === editingId ? fact : item)
          : [...existing, fact],
      };
    });
    toast.success(editingId ? 'Canon 사실을 수정했습니다.' : 'Canon 사실을 추가했습니다.');
    reset();
  };

  const startEdit = (fact: CanonFact) => {
    setEditingId(fact.id);
    setDraft({
      kind: fact.kind,
      subject: fact.subject,
      value: fact.value,
      sourceChapterId: fact.sourceChapterId,
      validFromChapterId: fact.validFromChapterId,
      validUntilChapterId: fact.validUntilChapterId,
      status: fact.status,
      locked: fact.locked,
      supersedesFactId: fact.supersedesFactId,
    });
  };

  const remove = async (fact: CanonFact) => {
    const approved = await confirm({
      title: 'Canon 사실을 삭제할까요?',
      message: `“${fact.subject}: ${fact.value}” 항목을 장부에서 삭제합니다. 회차 원고는 삭제되지 않습니다.`,
      confirmText: '삭제',
      cancelText: '취소',
      variant: 'danger',
    });
    if (!approved) return;
    await onMutateNovel(novel.id, (current) => ({
      ...current,
      canonFacts: (current.canonFacts ?? [])
        .filter((item) => item.id !== fact.id)
        .map((item) => item.supersedesFactId === fact.id ? { ...item, supersedesFactId: undefined } : item),
    }));
    if (editingId === fact.id) reset();
  };

  const setDraftField = <K extends keyof CanonDraft>(key: K, value: CanonDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value || undefined }));
  };

  const chapterLabel = (id: string | undefined) => {
    if (!id) return '지정 없음';
    const found = chapterById.get(id);
    return found ? `${found.index + 1}화 · ${getChapterDisplayId(found.chapter)}` : '삭제된 회차';
  };

  return (
    <section className="bg-gray-700 p-4 rounded-lg" aria-labelledby="canon-ledger-title">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="canon-ledger-title" className="font-semibold text-gray-200 flex items-center gap-2">
            <BrainIcon className="w-5 h-5 text-amber-400" />
            [3계층] 시간축 Canon 장부
          </h3>
          <p className="mt-1 text-xs leading-relaxed text-gray-400">
            현재도 유효한 상태·관계·비밀을 회차 ID에 연결합니다. 확정 항목만 다음 집필에 전달됩니다.
          </p>
        </div>
        <span className="text-xs text-gray-400">확정 {states.filter((item) => item.active).length} · 검토 {states.filter((item) => item.sourceChanged).length}</span>
      </div>

      <div className="border-y border-gray-600 py-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <label className="text-xs text-gray-300">
            종류
            <select value={draft.kind} onChange={(event) => setDraftField('kind', event.target.value as CanonFactKind)} className="mt-1 w-full rounded-md border border-gray-500 bg-gray-800 px-3 py-2 text-sm text-white">
              {Object.entries(KIND_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="text-xs text-gray-300">
            대상
            <input value={draft.subject} onChange={(event) => setDraftField('subject', event.target.value)} placeholder="예: 서윤과 다은의 관계" className="mt-1 w-full rounded-md border border-gray-500 bg-gray-800 px-3 py-2 text-sm text-white" />
          </label>
        </div>
        <label className="mt-3 block text-xs text-gray-300">
          확정 사실
          <textarea value={draft.value} onChange={(event) => setDraftField('value', event.target.value)} rows={3} placeholder="예: 서로의 비밀을 공유한 동맹 관계다." className="mt-1 w-full rounded-md border border-gray-500 bg-gray-800 px-3 py-2 text-sm leading-relaxed text-white" />
        </label>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {([
            ['sourceChapterId', '근거 회차'],
            ['validFromChapterId', '유효 시작'],
            ['validUntilChapterId', '종료·대체 회차'],
          ] as const).map(([key, label]) => (
            <label key={key} className="text-xs text-gray-300">
              {label}
              <select value={draft[key] ?? ''} onChange={(event) => setDraftField(key, event.target.value)} className="mt-1 w-full rounded-md border border-gray-500 bg-gray-800 px-2 py-2 text-sm text-white">
                <option value="">지정 없음</option>
                {novel.chapters.map((chapter, index) => chapter.id && (
                  <option key={chapter.id} value={chapter.id}>{index + 1}화 · {getChapterDisplayId(chapter)}</option>
                ))}
              </select>
            </label>
          ))}
        </div>
        <label className="mt-3 block text-xs text-gray-300">
          이 사실이 대체하는 이전 항목
          <select value={draft.supersedesFactId ?? ''} onChange={(event) => setDraftField('supersedesFactId', event.target.value)} className="mt-1 w-full rounded-md border border-gray-500 bg-gray-800 px-2 py-2 text-sm text-white">
            <option value="">없음</option>
            {(novel.canonFacts ?? []).filter((fact) => fact.id !== editingId).map((fact) => (
              <option key={fact.id} value={fact.id}>{fact.subject}: {fact.value.slice(0, 48)}</option>
            ))}
          </select>
        </label>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setDraft((current) => ({ ...current, status: current.status === 'confirmed' ? 'draft' : 'confirmed' }))} className={`rounded-md px-3 py-2 text-sm font-medium ${draft.status === 'confirmed' ? 'bg-teal-600 text-white' : 'bg-gray-600 text-gray-200'}`}>
              {draft.status === 'confirmed' ? '확정' : '검토 중'}
            </button>
            <button type="button" onClick={() => setDraft((current) => ({ ...current, locked: !current.locked }))} className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium ${draft.locked ? 'bg-amber-600 text-white' : 'bg-gray-600 text-gray-200'}`} title="출처 회차가 수정되어도 사용자 확정을 유지합니다.">
              {draft.locked ? <LockClosedIcon className="h-4 w-4" /> : <LockOpenIcon className="h-4 w-4" />}
              {draft.locked ? '사용자 잠금' : '잠금 안 함'}
            </button>
          </div>
          <div className="flex gap-2">
            {editingId && <button type="button" onClick={reset} className="flex items-center gap-1 rounded-md bg-gray-600 px-3 py-2 text-sm text-white"><XMarkIcon className="h-4 w-4" /> 취소</button>}
            <button type="button" onClick={() => void save()} className="flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500">
              {editingId ? <DeviceFloppyIcon className="h-4 w-4" /> : <PlusIcon className="h-4 w-4" />}
              {editingId ? '수정 저장' : '사실 추가'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-h-[44vh] divide-y divide-gray-600 overflow-y-auto">
        {states.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">등록된 Canon 사실이 없습니다.</p>
        ) : states.map(({ fact, active, sourceChanged }) => (
          <div key={fact.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-medium text-indigo-300">{KIND_LABELS[fact.kind]}</span>
                  <span className={active ? 'text-teal-400' : 'text-gray-500'}>{active ? '현재 적용' : fact.status === 'draft' ? '검토 중' : '현재 비활성'}</span>
                  {fact.locked && <LockClosedIcon className="h-3.5 w-3.5 text-amber-400" />}
                  {sourceChanged && <span className="text-amber-400">근거 회차 수정됨</span>}
                </div>
                <p className="mt-1 break-words text-sm font-semibold text-gray-100">{fact.subject}</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300">{fact.value}</p>
                <p className="mt-2 text-[11px] text-gray-500">
                  근거 {chapterLabel(fact.sourceChapterId)} · 시작 {chapterLabel(fact.validFromChapterId)} · 종료 {chapterLabel(fact.validUntilChapterId)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => startEdit(fact)} title="수정" className="p-1.5 text-gray-400 hover:text-indigo-300"><PencilIcon className="h-4 w-4" /></button>
                <button type="button" onClick={() => void remove(fact)} title="삭제" className="p-1.5 text-gray-400 hover:text-red-400"><TrashIcon className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

import { useState } from 'react';
import type { CharacterChatUserPersona } from '@core/types';
import { Modal, TrashIcon, UserPlusIcon } from '@shared/components';
import { createDefaultUserPersona } from '@services/character-chat';

interface UserPersonaSetupModalProps {
  characterName: string;
  personas: CharacterChatUserPersona[];
  onClose: () => void;
  onStart: (persona: CharacterChatUserPersona, saveForReuse: boolean) => Promise<void>;
  onDelete: (personaId: string) => Promise<void>;
}

function editableCopy(persona: CharacterChatUserPersona): CharacterChatUserPersona {
  return { ...persona };
}

export function UserPersonaSetupModal({
  characterName,
  personas,
  onClose,
  onStart,
  onDelete,
}: UserPersonaSetupModalProps) {
  const [persona, setPersona] = useState(() => createDefaultUserPersona());
  const [saveForReuse, setSaveForReuse] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const update = (patch: Partial<CharacterChatUserPersona>) => {
    setPersona((current) => ({ ...current, ...patch, updatedAt: Date.now() }));
  };

  const selectDefault = () => {
    setPersona(createDefaultUserPersona());
    setSaveForReuse(false);
  };

  const createNew = () => {
    const now = Date.now();
    setPersona({
      ...createDefaultUserPersona(now),
      id: crypto.randomUUID(),
      name: '',
    });
    setSaveForReuse(true);
  };

  const start = async () => {
    if (!persona.name.trim() || isStarting) return;
    setIsStarting(true);
    try {
      await onStart({ ...persona, name: persona.name.trim(), updatedAt: Date.now() }, saveForReuse);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`${characterName}와 만날 내 역할`} size="full">
      <div className="text-zinc-100">
        <p className="text-sm leading-6 text-zinc-400">
          본인으로 바로 들어가거나, 이야기 속 역할을 정해 상호작용할 수 있어.
        </p>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" aria-label="저장된 사용자 역할">
          <button
            type="button"
            onClick={selectDefault}
            className={`min-w-28 rounded-md border px-3 py-3 text-left text-sm ${
              persona.id === 'default-self'
                ? 'border-rose-400 bg-rose-500/10 text-white'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            <span className="block font-semibold">나 자신</span>
            <span className="mt-1 block text-xs text-zinc-500">설정 없이 시작</span>
          </button>
          {personas.map((saved) => (
            <button
              key={saved.id}
              type="button"
              onClick={() => {
                setPersona(editableCopy(saved));
                setSaveForReuse(true);
              }}
              className={`min-w-36 rounded-md border px-3 py-3 text-left text-sm ${
                persona.id === saved.id
                  ? 'border-rose-400 bg-rose-500/10 text-white'
                  : 'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              <span className="block truncate font-semibold">{saved.name}</span>
              <span className="mt-1 block truncate text-xs text-zinc-500">{saved.role || '역할 미정'}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={createNew}
            className="flex min-w-32 items-center justify-center gap-2 rounded-md border border-dashed border-zinc-700 px-3 py-3 text-sm text-zinc-400 hover:border-emerald-400 hover:text-white"
          >
            <UserPlusIcon className="h-4 w-4" /> 새 역할
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-zinc-400">
            이름 또는 호칭
            <input
              value={persona.name}
              onChange={(event) => update({ name: event.target.value })}
              placeholder="예: 카일"
              className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-rose-400"
            />
          </label>
          <label className="text-sm text-zinc-400">
            세계관 속 역할
            <input
              value={persona.role}
              onChange={(event) => update({ role: event.target.value })}
              placeholder="예: 왕실 기록관, 소꿉친구"
              className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-zinc-100 outline-none focus:border-rose-400"
            />
          </label>
          <label className="text-sm text-zinc-400">
            성격
            <textarea
              value={persona.personality}
              onChange={(event) => update({ personality: event.target.value })}
              rows={2}
              placeholder="예: 침착하지만 궁금한 건 참지 못한다"
              className="mt-2 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 outline-none focus:border-rose-400"
            />
          </label>
          <label className="text-sm text-zinc-400">
            말투
            <textarea
              value={persona.speakingStyle}
              onChange={(event) => update({ speakingStyle: event.target.value })}
              rows={2}
              placeholder="예: 짧고 차분한 존댓말"
              className="mt-2 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 outline-none focus:border-rose-400"
            />
          </label>
          <label className="text-sm text-zinc-400">
            배경
            <textarea
              value={persona.background}
              onChange={(event) => update({ background: event.target.value })}
              rows={3}
              placeholder="예: 변방에서 올라온 신참 기록관"
              className="mt-2 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 outline-none focus:border-rose-400"
            />
          </label>
          <label className="text-sm text-zinc-400">
            현재 목표
            <textarea
              value={persona.goal}
              onChange={(event) => update({ goal: event.target.value })}
              rows={3}
              placeholder="예: 사라진 왕실 문서를 찾는다"
              className="mt-2 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 p-3 text-zinc-100 outline-none focus:border-rose-400"
            />
          </label>
        </div>

        <div className="mt-5 flex flex-col gap-3 border-t border-zinc-800 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 text-sm text-zinc-400">
              <input
                type="checkbox"
                checked={saveForReuse}
                disabled={persona.id === 'default-self'}
                onChange={(event) => setSaveForReuse(event.target.checked)}
                className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-rose-500 focus:ring-rose-500"
              />
              다음 대화에서도 사용
            </label>
            {persona.id !== 'default-self' && personas.some((saved) => saved.id === persona.id) && (
              <button
                type="button"
                onClick={async () => {
                  await onDelete(persona.id);
                  selectDefault();
                }}
                className="rounded-md p-2 text-zinc-600 hover:bg-zinc-800 hover:text-red-300"
                title="저장된 역할 삭제"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
              취소
            </button>
            <button
              type="button"
              onClick={() => void start()}
              disabled={!persona.name.trim() || isStarting}
              className="rounded-md bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {isStarting ? '장면 여는 중...' : '이 역할로 시작'}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

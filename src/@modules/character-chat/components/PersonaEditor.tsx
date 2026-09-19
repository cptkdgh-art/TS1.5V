import { useMemo, useRef, useState } from 'react';
import type {
  CharacterChatPersona,
  CharacterChatPersonaField,
  CharacterChatSource,
  PersonaFieldOrigin,
} from '@core/types';
import {
  ArrowLeftIcon,
  CameraIcon,
  CheckIcon,
  Modal,
  PhotoIcon,
  SparklesIcon,
  XMarkIcon,
  toast,
} from '@shared/components';
import { generateCharacterChatImage, generatePersonaFieldPatch } from '@services/ai';
import {
  PERSONA_FIELDS,
  PERSONA_FIELD_LABELS,
  applyPersonaPatch,
  updatePersonaField,
} from '@services/character-chat';
import { ModelSelect } from './ModelSelect';

const LARGE_FIELDS = new Set<CharacterChatPersonaField>([
  'background', 'storyContext', 'worldContext', 'behaviorRules', 'forbiddenTopics',
]);

const ORIGIN_LABEL: Record<PersonaFieldOrigin, string> = {
  source: '원문',
  ai: 'AI 제안',
  user: '사용자 수정',
};

interface PersonaEditorProps {
  initialPersona: CharacterChatPersona;
  source: CharacterChatSource;
  onCancel: () => void;
  onSave: (persona: CharacterChatPersona, startChat: boolean) => Promise<void>;
}

export function PersonaEditor({ initialPersona, source, onCancel, onSave }: PersonaEditorProps) {
  const [persona, setPersona] = useState(initialPersona);
  const [selectedFields, setSelectedFields] = useState<CharacterChatPersonaField[]>([]);
  const [request, setRequest] = useState('');
  const [pendingPatch, setPendingPatch] = useState<Partial<Record<CharacterChatPersonaField, string>> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingImage, setGeneratingImage] = useState<'portrait' | 'background' | null>(null);
  const portraitInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const emptyFields = useMemo(
    () => PERSONA_FIELDS.filter((field) => !persona[field].value.trim()),
    [persona]
  );

  const toggleField = (field: CharacterChatPersonaField) => {
    setSelectedFields((current) => current.includes(field)
      ? current.filter((item) => item !== field)
      : [...current, field]);
  };

  const handleGenerate = async (fields = selectedFields) => {
    if (fields.length === 0) {
      toast.warning('AI로 보완할 항목을 선택해 주세요.');
      return;
    }
    setIsGenerating(true);
    try {
      const patch = await generatePersonaFieldPatch({
        persona,
        source,
        fields,
        model: persona.defaultModel,
        request,
      });
      if (Object.keys(patch).length === 0) throw new Error('AI가 적용할 내용을 만들지 못했습니다.');
      setPendingPatch(patch);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'AI 보완에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImage = (file: File | undefined, kind: 'portrait' | 'backgroundImage') => {
    if (!file) return;
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
    if (!allowedTypes.has(file.type)) {
      toast.error('PNG, JPG, WEBP, GIF 이미지만 사용할 수 있습니다.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      toast.error('이미지는 3MB 이하로 선택해 주세요.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setPersona((current) => ({
      ...current,
      [kind]: String(reader.result),
      updatedAt: Date.now(),
    }));
    reader.readAsDataURL(file);
  };

  const handleGenerateImage = async (kind: 'portrait' | 'background') => {
    if (generatingImage) return;
    setGeneratingImage(kind);
    try {
      const image = await generateCharacterChatImage(persona, source, kind);
      if (!image) throw new Error('이미지를 만들지 못했습니다. API 키와 이미지 모델 사용 가능 여부를 확인해 주세요.');
      setPersona((current) => ({
        ...current,
        [kind === 'portrait' ? 'portrait' : 'backgroundImage']: image,
        updatedAt: Date.now(),
      }));
      toast.success(kind === 'portrait' ? '캐릭터 일러스트를 만들었어.' : '대화 배경을 만들었어.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '이미지 생성에 실패했습니다.');
    } finally {
      setGeneratingImage(null);
    }
  };

  const save = async (startChat: boolean) => {
    if (!persona.name.trim()) {
      toast.warning('캐릭터 이름을 입력해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      await onSave({ ...persona, name: persona.name.trim(), updatedAt: Date.now() }, startChat);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141215] text-zinc-100">
      <header className="border-b border-zinc-800 bg-[#19161a]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onCancel} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="뒤로">
              <ArrowLeftIcon className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold">페르소나 작업실</h1>
              <p className="truncate text-xs text-zinc-500">{source.title}에서 가져온 독립 복사본</p>
            </div>
          </div>
          <ModelSelect
            value={persona.defaultModel}
            onChange={(defaultModel) => setPersona((current) => ({ ...current, defaultModel, updatedAt: Date.now() }))}
            label="기본 모델"
            className="hidden md:flex"
          />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-7 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4">
          <input
            ref={portraitInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleImage(event.target.files?.[0], 'portrait')}
          />
          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => handleImage(event.target.files?.[0], 'backgroundImage')}
          />
          <button
            type="button"
            onClick={() => portraitInputRef.current?.click()}
            className="group relative flex aspect-square w-full max-w-60 items-center justify-center overflow-hidden rounded-md border border-zinc-800 bg-[#201b21] text-zinc-500 hover:border-rose-400"
          >
            {persona.portrait ? (
              <img src={persona.portrait} alt={`${persona.name} 일러스트`} className="h-full w-full object-cover" />
            ) : (
              <div className="text-center">
                <CameraIcon className="mx-auto h-8 w-8 text-rose-300" />
                <span className="mt-2 block text-sm">일러스트 추가</span>
              </div>
            )}
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateImage('portrait')}
            disabled={Boolean(generatingImage)}
            className="inline-flex w-full max-w-60 items-center justify-center gap-2 rounded-md bg-rose-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <SparklesIcon className="h-4 w-4" />
            {generatingImage === 'portrait' ? '일러스트 만드는 중...' : 'AI 일러스트 생성'}
          </button>
          {persona.portrait && (
            <button type="button" onClick={() => setPersona((current) => ({ ...current, portrait: undefined }))} className="text-sm text-zinc-500 hover:text-red-300">
              일러스트 제거
            </button>
          )}
          <button
            type="button"
            onClick={() => backgroundInputRef.current?.click()}
            className="flex w-full max-w-60 items-center gap-3 rounded-md border border-zinc-800 bg-[#201b21] p-3 text-left text-sm text-zinc-400 hover:border-rose-400 hover:text-white"
          >
            <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-zinc-900">
              {persona.backgroundImage
                ? <img src={persona.backgroundImage} alt="대화 배경 미리보기" className="h-full w-full object-cover" />
                : <PhotoIcon className="h-5 w-5 text-rose-300" />}
            </span>
            <span>{persona.backgroundImage ? '대화 배경 바꾸기' : '대화 배경 추가'}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleGenerateImage('background')}
            disabled={Boolean(generatingImage)}
            className="inline-flex w-full max-w-60 items-center justify-center gap-2 rounded-md border border-emerald-500/40 px-3 py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <PhotoIcon className="h-4 w-4" />
            {generatingImage === 'background' ? '배경 만드는 중...' : 'AI 배경 생성'}
          </button>
          {persona.backgroundImage && (
            <button type="button" onClick={() => setPersona((current) => ({ ...current, backgroundImage: undefined }))} className="text-sm text-zinc-500 hover:text-red-300">
              대화 배경 제거
            </button>
          )}
          <div className="border-y border-zinc-800 py-4 text-sm">
            <p className="text-zinc-500">지식 범위</p>
            <p className="mt-1 text-emerald-300">
              {source.type === 'novel'
                ? source.isFullCanon ? '전체 원고' : `${source.knowledgeChapterCount}화까지`
                : source.type === 'text' ? '가져온 TXT 전체' : '직접 설정'}
            </p>
          </div>
          <ModelSelect
            value={persona.defaultModel}
            onChange={(defaultModel) => setPersona((current) => ({ ...current, defaultModel, updatedAt: Date.now() }))}
            label="기본 모델"
            className="flex-col items-start md:hidden"
          />
        </aside>

        <div className="min-w-0">
          <section className="mb-8 border-b border-zinc-800 pb-6">
            <label className="block text-sm text-zinc-400">
              캐릭터 이름
              <input
                value={persona.name}
                onChange={(event) => setPersona((current) => ({ ...current, name: event.target.value, updatedAt: Date.now() }))}
                className="mt-2 w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-xl font-semibold text-white outline-none focus:border-rose-400"
              />
            </label>
          </section>

          <section aria-labelledby="persona-fields-title">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h2 id="persona-fields-title" className="text-lg font-semibold">캐릭터 설정</h2>
                <p className="text-sm text-zinc-500">원문·AI 제안·직접 수정이 구분되어 저장돼.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedFields(emptyFields)}
                  className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-emerald-400 hover:text-white"
                >
                  빈칸 선택 ({emptyFields.length})
                </button>
                <button
                  type="button"
                  onClick={() => handleGenerate()}
                  disabled={isGenerating || selectedFields.length === 0}
                  className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  <SparklesIcon className="h-4 w-4" />
                  {isGenerating ? 'AI 보완 중...' : `선택 항목 AI 보완 (${selectedFields.length})`}
                </button>
              </div>
            </div>

            <label className="mb-5 block text-sm text-zinc-400">
              AI에게 추가로 원하는 방향
              <textarea
                value={request}
                onChange={(event) => setRequest(event.target.value)}
                rows={2}
                placeholder="예: 말수는 적지만 친해지면 은근히 장난치는 성격"
                className="mt-2 w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 p-3 text-zinc-200 outline-none focus:border-emerald-400"
              />
            </label>

            <div className="divide-y divide-zinc-800 border-y border-zinc-800">
              {PERSONA_FIELDS.map((field) => {
                const personaField = persona[field];
                const isSelected = selectedFields.includes(field);
                return (
                  <div key={field} className="py-5">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm font-medium text-zinc-200">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleField(field)}
                          className="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500"
                        />
                        {PERSONA_FIELD_LABELS[field]}
                        <span className={`text-[11px] ${
                          personaField.origin === 'source'
                            ? 'text-amber-300'
                            : personaField.origin === 'ai' ? 'text-emerald-300' : 'text-sky-300'
                        }`}>
                          {ORIGIN_LABEL[personaField.origin]}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleGenerate([field])}
                        disabled={isGenerating}
                        className="rounded-md p-2 text-zinc-500 hover:bg-zinc-800 hover:text-emerald-300 disabled:opacity-50"
                        title={`${PERSONA_FIELD_LABELS[field]}만 AI 보완`}
                      >
                        <SparklesIcon className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      aria-label={PERSONA_FIELD_LABELS[field]}
                      value={personaField.value}
                      rows={LARGE_FIELDS.has(field) ? 4 : 2}
                      onChange={(event) => setPersona((current) => updatePersonaField(current, field, event.target.value))}
                      className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 p-3 leading-6 text-zinc-200 outline-none focus:border-rose-400"
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <div className="mt-7 flex flex-col-reverse justify-end gap-2 sm:flex-row">
            <button type="button" onClick={onCancel} className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800">취소</button>
            <button type="button" onClick={() => save(false)} disabled={isSaving} className="rounded-md border border-rose-400/50 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:opacity-50">저장</button>
            <button type="button" onClick={() => save(true)} disabled={isSaving} className="rounded-md bg-rose-500 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-400 disabled:opacity-50">
              {isSaving ? '저장 중...' : '저장하고 대화 시작'}
            </button>
          </div>
        </div>
      </main>

      {pendingPatch && (
        <Modal
          isOpen
          onClose={() => setPendingPatch(null)}
          title="AI 제안 미리보기"
          size="full"
        >
          <div className="text-zinc-100">
            <p className="text-sm text-zinc-400">적용하기 전 기존 내용과 비교해봐.</p>
            <div className="mt-5 divide-y divide-zinc-800 border-y border-zinc-800">
              {Object.entries(pendingPatch).map(([key, value]) => {
                const field = key as CharacterChatPersonaField;
                return (
                  <div key={field} className="py-4">
                    <h3 className="text-sm font-semibold text-emerald-300">{PERSONA_FIELD_LABELS[field]}</h3>
                    {persona[field].value && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 line-through">{persona[field].value}</p>}
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-200">{value}</p>
                  </div>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPendingPatch(null)} className="inline-flex items-center gap-2 rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800">
                <XMarkIcon className="h-4 w-4" /> 취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setPersona((current) => applyPersonaPatch(current, pendingPatch, Object.keys(pendingPatch) as CharacterChatPersonaField[]));
                  setPendingPatch(null);
                }}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <CheckIcon className="h-4 w-4" /> 적용
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

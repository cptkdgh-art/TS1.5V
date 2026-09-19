/**
 * ============================================================
 * @module modules/author/components
 * @file EditAuthorModal.tsx
 * ============================================================
 * @description 작가 생성/수정 모달
 * ============================================================
 */

import { useState, useEffect } from 'react';
import type { AiAuthor } from '@core/types';
import type { AuthorIdentityDraft } from '@services/ai';
import { createAuthorIdentityCore, createLegacyAuthorIdentityCore, resolveAuthorIdentityCore } from '@services/ai';
import { Modal, Button, Input, Textarea, toast } from '@shared/components';
import { ArrowPathIcon, ClockIcon } from '@shared/components';

interface EditAuthorModalProps {
  author: AiAuthor | null;
  onClose: () => void;
  onSave: (details: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>) => void;
}

const EMPTY_IDENTITY: AuthorIdentityDraft = {
  selfDefinition: '', reasonToWrite: '', worldview: '', viewOfHumanity: '',
  literaryValues: [], aestheticTaste: { drawnTo: [], avoids: [], emotionalTexture: '' },
  innerContradictions: [], recurringQuestions: [], readerRelationship: '', creativeEthics: '',
  narrativeInstincts: [], voiceOrigins: '', readabilityPractice: '', plausibilityPractice: '',
};

const lines = (value: string) => value.split('\n').map((item) => item.trim()).filter(Boolean);
const joinLines = (value: string[]) => value.join('\n');
const joinConvictions = (value: AuthorIdentityDraft['literaryValues']) =>
  value.map((item) => [item.belief, item.creativeEffect, item.doubt].join(' | ')).join('\n');
const joinTensions = (value: AuthorIdentityDraft['innerContradictions']) =>
  value.map((item) => [item.valueA, item.valueB, item.unresolvedReason].join(' | ')).join('\n');
const splitTriples = (value: string) => lines(value).map((item) => {
  const parts = item.split('|').map((part) => part.trim());
  return parts;
});

function toIdentityDraft(core: ReturnType<typeof resolveAuthorIdentityCore>): AuthorIdentityDraft {
  const { schemaVersion: _schemaVersion, coreId: _coreId, versionId: _versionId, createdAt: _createdAt, updatedAt: _updatedAt, ...draft } = core;
  return structuredClone(draft);
}

export function EditAuthorModal({ author, onClose, onSave }: EditAuthorModalProps) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [writingStyle, setWritingStyle] = useState('');
  const [coreDirectives, setCoreDirectives] = useState('');
  const [tags, setTags] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showIdentity, setShowIdentity] = useState(false);
  const [identity, setIdentity] = useState<AuthorIdentityDraft>(EMPTY_IDENTITY);

  useEffect(() => {
    if (author) {
      setName(author.name);
      setSpecialty(author.specialty);
      setWritingStyle(author.writingStyle);
      setCoreDirectives(author.coreDirectives || '');
      setTags(author.tags?.join(', ') || '');
      setIdentity(toIdentityDraft(resolveAuthorIdentityCore(author)));
      setShowHistory(false);
      setShowIdentity(false);
    } else {
      setName('');
      setSpecialty('');
      setWritingStyle('');
      setCoreDirectives('');
      setTags('');
      setIdentity(structuredClone(EMPTY_IDENTITY));
      setShowHistory(false);
      setShowIdentity(false);
    }
  }, [author]);

  const handleSubmit = () => {
    if (!name.trim() || !specialty.trim() || !writingStyle.trim()) {
      toast.warning('이름, 전문 분야, 문체는 필수 입력 항목입니다.');
      return;
    }

    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : `#${t}`));

    const now = Date.now();
    const identityCore = createAuthorIdentityCore({
      ...identity,
      selfDefinition: identity.selfDefinition.trim() || `${name.trim()}은(는) ${specialty.trim()}을(를) 다루는 작가다.`,
      reasonToWrite: identity.reasonToWrite.trim() || coreDirectives.trim(),
      narrativeInstincts: identity.narrativeInstincts.length > 0 ? identity.narrativeInstincts : [writingStyle.trim()],
      voiceOrigins: identity.voiceOrigins.trim() || writingStyle.trim(),
      readabilityPractice: identity.readabilityPractice.trim() || '독자가 장면의 목적과 행동을 놓치지 않도록 자연스러운 호흡으로 쓴다.',
      plausibilityPractice: identity.plausibilityPractice.trim() || '사건은 앞선 원인과 설정에서, 선택은 인물의 욕망과 경험에서 나오게 한다.',
    }, { coreId: author?.identityCore?.coreId, now });

    onSave({
      name: name.trim(),
      specialty: specialty.trim(),
      writingStyle: writingStyle.trim(),
      coreDirectives: coreDirectives.trim(),
      tags: tagList,
      identityCore: author?.identityCore
        ? { ...identityCore, createdAt: author.identityCore.createdAt }
        : identityCore,
    });
  };

  const restoreVersion = (version: NonNullable<AiAuthor['profileVersions']>[number]) => {
    setName(version.name);
    setSpecialty(version.specialty);
    setWritingStyle(version.writingStyle);
    setCoreDirectives(version.coreDirectives);
    setTags(version.tags.join(', '));
    if (version.identityCore) {
      setIdentity(toIdentityDraft(version.identityCore));
    } else {
      setIdentity(toIdentityDraft(createLegacyAuthorIdentityCore({
        id: author?.id || version.id,
        name: version.name,
        specialty: version.specialty,
        writingStyle: version.writingStyle,
        coreDirectives: version.coreDirectives,
        tags: version.tags,
        createdAt: version.createdAt,
      })));
    }
    setShowHistory(false);
    toast.success('이전 프로필을 편집 화면에 불러왔습니다. 저장하면 적용됩니다.');
  };

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={author ? '작가 수정' : '새 작가 추가'}
      size="lg"
    >
      <div className="space-y-4">
        <Input
          label="이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="작가 이름"
        />

        <Input
          label="전문 분야"
          value={specialty}
          onChange={(e) => setSpecialty(e.target.value)}
          placeholder="예: 로맨스, 판타지, SF"
        />

        <Textarea
          label="문체"
          value={writingStyle}
          onChange={(e) => setWritingStyle(e.target.value)}
          placeholder="작가의 문체를 설명해주세요"
          rows={3}
        />

        <Textarea
          label="핵심 지시사항"
          value={coreDirectives}
          onChange={(e) => setCoreDirectives(e.target.value)}
          placeholder="작가가 항상 따라야 할 지시사항"
          rows={3}
        />

        <Input
          label="태그"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="쉼표로 구분 (예: 달달, 로맨스, 현대)"
          helperText="태그는 쉼표(,)로 구분합니다"
        />

        <div className="border border-indigo-500/30 rounded-lg bg-indigo-950/10">
          <button
            type="button"
            onClick={() => setShowIdentity((visible) => !visible)}
            className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
            aria-expanded={showIdentity}
          >
            <span>
              <span className="block text-sm font-semibold text-indigo-100">내면과 작품관</span>
              <span className="block mt-0.5 text-xs text-gray-400">작품과 무관하게 유지되는 작가의 정체성과 문체의 이유</span>
            </span>
            <span className="text-indigo-300" aria-hidden="true">{showIdentity ? '접기' : '펼치기'}</span>
          </button>

          {showIdentity && (
            <div className="px-4 pb-4 space-y-4 border-t border-indigo-500/20 pt-4">
              <Textarea label="나는 어떤 작가인가" value={identity.selfDefinition} onChange={(event) => setIdentity((value) => ({ ...value, selfDefinition: event.target.value }))} rows={2} />
              <Textarea label="왜 쓰는가" value={identity.reasonToWrite} onChange={(event) => setIdentity((value) => ({ ...value, reasonToWrite: event.target.value }))} rows={2} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Textarea label="세계관" value={identity.worldview} onChange={(event) => setIdentity((value) => ({ ...value, worldview: event.target.value }))} rows={3} />
                <Textarea label="인간관" value={identity.viewOfHumanity} onChange={(event) => setIdentity((value) => ({ ...value, viewOfHumanity: event.target.value }))} rows={3} />
              </div>
              <Textarea label="문학적 신념" value={joinConvictions(identity.literaryValues)} onChange={(event) => setIdentity((value) => ({ ...value, literaryValues: splitTriples(event.target.value).map(([belief = '', creativeEffect = '', doubt = '']) => ({ belief, creativeEffect, doubt })) }))} placeholder="한 줄에 믿음 | 창작에 미치는 영향 | 의심 또는 반례" rows={3} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Textarea label="끌리는 미학" value={joinLines(identity.aestheticTaste.drawnTo)} onChange={(event) => setIdentity((value) => ({ ...value, aestheticTaste: { ...value.aestheticTaste, drawnTo: lines(event.target.value) } }))} placeholder="한 줄에 하나" rows={3} />
                <Textarea label="피하는 미학" value={joinLines(identity.aestheticTaste.avoids)} onChange={(event) => setIdentity((value) => ({ ...value, aestheticTaste: { ...value.aestheticTaste, avoids: lines(event.target.value) } }))} placeholder="한 줄에 하나" rows={3} />
              </div>
              <Textarea label="정서적 질감" value={identity.aestheticTaste.emotionalTexture} onChange={(event) => setIdentity((value) => ({ ...value, aestheticTaste: { ...value.aestheticTaste, emotionalTexture: event.target.value } }))} rows={2} />
              <Textarea label="해결되지 않은 내적 모순" value={joinTensions(identity.innerContradictions)} onChange={(event) => setIdentity((value) => ({ ...value, innerContradictions: splitTriples(event.target.value).map(([valueA = '', valueB = '', unresolvedReason = '']) => ({ valueA, valueB, unresolvedReason })) }))} placeholder="한 줄에 가치 A | 가치 B | 아직 결론 내리지 못한 이유" rows={3} />
              <Textarea label="반복해서 탐구하는 질문" value={joinLines(identity.recurringQuestions)} onChange={(event) => setIdentity((value) => ({ ...value, recurringQuestions: lines(event.target.value) }))} placeholder="한 줄에 하나" rows={3} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Textarea label="독자와의 관계" value={identity.readerRelationship} onChange={(event) => setIdentity((value) => ({ ...value, readerRelationship: event.target.value }))} rows={3} />
                <Textarea label="창작 윤리" value={identity.creativeEthics} onChange={(event) => setIdentity((value) => ({ ...value, creativeEthics: event.target.value }))} rows={3} />
              </div>
              <Textarea label="서사적 본능" value={joinLines(identity.narrativeInstincts)} onChange={(event) => setIdentity((value) => ({ ...value, narrativeInstincts: lines(event.target.value) }))} placeholder="한 줄에 하나" rows={3} />
              <Textarea label="문체가 생겨난 이유" value={identity.voiceOrigins} onChange={(event) => setIdentity((value) => ({ ...value, voiceOrigins: event.target.value }))} rows={3} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Textarea label="가독성을 실천하는 방식" value={identity.readabilityPractice} onChange={(event) => setIdentity((value) => ({ ...value, readabilityPractice: event.target.value }))} rows={3} />
                <Textarea label="개연성을 실천하는 방식" value={identity.plausibilityPractice} onChange={(event) => setIdentity((value) => ({ ...value, plausibilityPractice: event.target.value }))} rows={3} />
              </div>
            </div>
          )}
        </div>

        {author?.profileVersions && author.profileVersions.length > 0 && (
          <div className="border-t border-gray-700 pt-3">
            <button
              type="button"
              onClick={() => setShowHistory((visible) => !visible)}
              className="inline-flex items-center gap-2 text-sm text-gray-300 hover:text-white"
              aria-expanded={showHistory}
            >
              <ClockIcon className="w-4 h-4" /> 이전 프로필 {author.profileVersions.length}개
            </button>
            {showHistory && (
              <div className="mt-3 max-h-44 overflow-y-auto space-y-2">
                {author.profileVersions.map((version) => (
                  <div key={version.id} className="flex items-center gap-3 border-b border-gray-700/70 pb-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{version.name} · {version.specialty}</p>
                      <p className="text-xs text-gray-500">{new Date(version.createdAt).toLocaleString()}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => restoreVersion(version)}
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-indigo-300 hover:text-white"
                    >
                      <ArrowPathIcon className="w-3.5 h-3.5" /> 불러오기
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {author ? '저장' : '생성'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

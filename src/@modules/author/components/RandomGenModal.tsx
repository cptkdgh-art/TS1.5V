/**
 * ============================================================
 * @module modules/author/components
 * @file RandomGenModal.tsx
 * ============================================================
 * @description 간단한 의뢰로 서로 다른 AI 추천 작가 3명을 비교 생성하는 모달
 * ============================================================
 */

import { useState } from 'react';
import type { AiAuthor } from '@core/types';
import type { AuthorRecommendation, AuthorRecommendationRequest } from '@services/ai/author';
import { generateAuthorRecommendations } from '@services/ai/author';
import { formatAiErrorForUser } from '@services/ai';
import {
  GEMINI_HELPER_MODEL_OPTIONS,
  MODELS,
  type GeminiHelperModel,
} from '@services/ai/config';
import {
  Button,
  CheckCircleIcon,
  Modal,
  WandSparklesIcon,
  toast,
} from '@shared/components';
import { useSettingsStore } from '@stores/settingsStore';

interface RandomGenModalProps {
  onClose: () => void;
  onCreateAuthor: (details: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>) => AiAuthor;
}

const EMPTY_REQUEST: AuthorRecommendationRequest = {
  keywords: '',
  mood: '',
  strengths: '',
  avoid: '',
};

export function RandomGenModal({ onClose, onCreateAuthor }: RandomGenModalProps) {
  const { geminiApiKey } = useSettingsStore();
  const [request, setRequest] = useState<AuthorRecommendationRequest>(EMPTY_REQUEST);
  const [selectedModel, setSelectedModel] = useState<GeminiHelperModel>(MODELS.TEXT);
  const [isLoading, setIsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AuthorRecommendation[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<AuthorRecommendation | null>(null);
  const [draftTagText, setDraftTagText] = useState('');

  const updateRequest = (field: keyof AuthorRecommendationRequest, value: string) => {
    setRequest((current) => ({ ...current, [field]: value }));
  };

  const handleGenerate = async () => {
    if (!request.keywords.trim()) {
      toast.warning('원하는 작가의 키워드나 방향을 입력해주세요.');
      return;
    }

    if (!geminiApiKey) {
      toast.warning('Gemini API 키가 설정되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    setRecommendations([]);
    setSelectedIndex(null);
    setDraft(null);
    setDraftTagText('');

    try {
      const profiles = await generateAuthorRecommendations({ ...request, model: selectedModel });
      setRecommendations(profiles);
    } catch (error) {
      console.error('[gemini] 추천 작가 생성 실패:', error);
      toast.error(formatAiErrorForUser(error, '추천 작가 생성에 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const selectRecommendation = (profile: AuthorRecommendation, index: number) => {
    setSelectedIndex(index);
    setDraft({ ...profile, tags: [...(profile.tags || [])] });
    setDraftTagText((profile.tags || []).join(', '));
  };

  const updateDraft = (
    field: Exclude<keyof AuthorRecommendation, 'tags' | 'identityCore'>,
    value: string
  ) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const handleCreate = () => {
    if (!draft?.name.trim()) return;

    onCreateAuthor({
      name: draft.name.trim(),
      specialty: draft.specialty.trim(),
      writingStyle: draft.writingStyle.trim(),
      coreDirectives: draft.coreDirectives.trim(),
      tags: draftTagText.split(',').map((tag) => tag.trim()).filter(Boolean),
      identityCore: draft.identityCore,
    });
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="AI 추천 작가 생성" size="full">
      <div className="space-y-6">
        <section className="space-y-4" aria-label="추천 작가 요청">
          <div>
            <label htmlFor="author-recommendation-model" className="mb-1.5 block text-sm font-semibold text-gray-200">
              추천 모델
            </label>
            <select
              id="author-recommendation-model"
              value={selectedModel}
              onChange={(event) => setSelectedModel(event.target.value as GeminiHelperModel)}
              className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white focus:border-indigo-400 focus:outline-none"
              disabled={isLoading}
            >
              {GEMINI_HELPER_MODEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-gray-400">
              선택한 모델로 후보 3명을 설계합니다. 기본값은 검증된 3.7 Flash입니다.
            </p>
          </div>

          <div>
            <label htmlFor="author-recommendation-keywords" className="mb-2 block text-sm font-semibold text-gray-200">
              원하는 작가와 키워드
            </label>
            <textarea
              id="author-recommendation-keywords"
              value={request.keywords}
              onChange={(event) => updateRequest('keywords', event.target.value)}
              placeholder="예: 현대 판타지, 빠른 전개, 인물 간 말맛이 좋은 작가"
              className="w-full resize-none rounded-lg border border-gray-600 bg-gray-700 p-3 text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="author-recommendation-mood" className="mb-1.5 block text-sm font-medium text-gray-300">
                원하는 분위기
              </label>
              <input
                id="author-recommendation-mood"
                value={request.mood}
                onChange={(event) => updateRequest('mood', event.target.value)}
                placeholder="예: 유쾌하지만 가볍지 않게"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="author-recommendation-strengths" className="mb-1.5 block text-sm font-medium text-gray-300">
                특히 잘했으면 하는 것
              </label>
              <input
                id="author-recommendation-strengths"
                value={request.strengths}
                onChange={(event) => updateRequest('strengths', event.target.value)}
                placeholder="예: 대사, 긴장감, 회차 후킹"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="author-recommendation-avoid" className="mb-1.5 block text-sm font-medium text-gray-300">
                피하고 싶은 것
              </label>
              <input
                id="author-recommendation-avoid"
                value={request.avoid}
                onChange={(event) => updateRequest('avoid', event.target.value)}
                placeholder="예: 과한 수식어, 느린 도입"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none"
                disabled={isLoading}
              />
            </div>
          </div>

          <Button
            variant="primary"
            onClick={handleGenerate}
            disabled={isLoading || !request.keywords.trim()}
            className="w-full"
          >
            <WandSparklesIcon className="mr-2 h-5 w-5" aria-hidden="true" />
            {isLoading ? '서로 다른 작가를 추천하는 중...' : recommendations.length ? '후보 다시 추천' : '작가 후보 추천받기'}
          </Button>
        </section>

        {recommendations.length > 0 && (
          <section className="space-y-3 border-t border-gray-700 pt-5" aria-label="추천 작가 후보">
            <h3 className="text-base font-semibold text-white">추천 후보 비교</h3>
            <div className="grid gap-3 lg:grid-cols-3">
              {recommendations.map((profile, index) => {
                const isSelected = selectedIndex === index;
                return (
                  <button
                    type="button"
                    key={`${profile.name}-${index}`}
                    aria-pressed={isSelected}
                    onClick={() => selectRecommendation(profile, index)}
                    className={`min-w-0 rounded-lg border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                      isSelected
                        ? 'border-indigo-400 bg-indigo-950/40'
                        : 'border-gray-600 bg-gray-700/40 hover:border-gray-400 hover:bg-gray-700/70'
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-indigo-300">후보 {index + 1}</p>
                        <h4 className="break-words text-lg font-bold text-white">{profile.name}</h4>
                      </div>
                      {isSelected && <CheckCircleIcon className="h-6 w-6 shrink-0 text-indigo-300" aria-hidden="true" />}
                    </div>
                    <p className="mb-3 text-sm leading-6 text-gray-200">{profile.specialty}</p>
                    <p className="max-h-24 overflow-hidden text-sm leading-6 text-gray-400">{profile.writingStyle}</p>
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {(profile.tags || []).slice(0, 5).map((tag) => (
                        <span key={tag} className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-300">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {draft && (
          <section className="space-y-4 border-t border-gray-700 pt-5" aria-label="선택한 작가 수정">
            <div>
              <h3 className="text-base font-semibold text-white">선택한 작가 다듬기</h3>
              <p className="mt-1 text-sm text-gray-400">필요한 부분만 고친 뒤 기존 작가와 같은 형식으로 저장됩니다.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="recommended-author-name" className="mb-1.5 block text-sm font-medium text-gray-300">작가 이름</label>
                <input
                  id="recommended-author-name"
                  value={draft.name}
                  onChange={(event) => updateDraft('name', event.target.value)}
                  className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="recommended-author-specialty" className="mb-1.5 block text-sm font-medium text-gray-300">전문 분야</label>
                <textarea
                  id="recommended-author-specialty"
                  value={draft.specialty}
                  onChange={(event) => updateDraft('specialty', event.target.value)}
                  rows={3}
                  className="w-full resize-y rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="recommended-author-style" className="mb-1.5 block text-sm font-medium text-gray-300">문체 스타일</label>
                <textarea
                  id="recommended-author-style"
                  value={draft.writingStyle}
                  onChange={(event) => updateDraft('writingStyle', event.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="recommended-author-directives" className="mb-1.5 block text-sm font-medium text-gray-300">핵심 지침</label>
                <textarea
                  id="recommended-author-directives"
                  value={draft.coreDirectives}
                  onChange={(event) => updateDraft('coreDirectives', event.target.value)}
                  rows={5}
                  className="w-full resize-y rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white focus:border-indigo-400 focus:outline-none"
                />
              </div>
            </div>
            <div>
              <label htmlFor="recommended-author-tags" className="mb-1.5 block text-sm font-medium text-gray-300">태그</label>
              <input
                id="recommended-author-tags"
                value={draftTagText}
                onChange={(event) => setDraftTagText(event.target.value)}
                placeholder="쉼표로 구분"
                className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2.5 text-white placeholder:text-gray-500 focus:border-indigo-400 focus:outline-none"
              />
            </div>
          </section>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-gray-700 pt-4 sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          {draft && (
            <Button
              variant="primary"
              onClick={handleCreate}
              disabled={!draft.name.trim() || !draft.specialty.trim() || !draft.writingStyle.trim() || !draft.coreDirectives.trim()}
            >
              <CheckCircleIcon className="mr-2 h-5 w-5" aria-hidden="true" />
              이 작가로 생성
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

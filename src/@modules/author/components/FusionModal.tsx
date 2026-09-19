/**
 * ============================================================
 * @module modules/author/components
 * @file FusionModal.tsx
 * ============================================================
 * @description 작가 융합 모달 (다양한 융합 모드 지원)
 * ============================================================
 */

import { useState, useMemo } from 'react';
import type { AiAuthor } from '@core/types';
import { Modal, Button, toast } from '@shared/components';
import { formatAiErrorForUser } from '@services/ai';
import { fuseAuthorProfiles, type FusionMode, type FusionOptions } from '@services/ai/author';
import { useSettingsStore } from '@stores/settingsStore';

interface FusionModalProps {
  selectedAuthors: AiAuthor[];
  onClose: () => void;
  onCreateAuthor: (details: Omit<AiAuthor, 'id' | 'createdAt' | 'metaChatHistory'>) => AiAuthor;
}

/** 융합 모드 정보 */
const FUSION_MODES: { value: FusionMode; label: string; description: string; icon: string }[] = [
  { value: 'creative', label: '창의적 융합', description: '작가들의 강점을 자유롭게 결합', icon: '✨' },
  { value: 'goal', label: '목적기반 융합', description: '특정 목표에 맞게 최적화된 융합', icon: '🎯' },
  { value: 'weighted', label: '가중치 융합', description: '각 작가의 비중을 조절하여 융합', icon: '⚖️' },
  { value: 'complement', label: '상보적 융합', description: '서로의 부족한 점을 보완', icon: '🔄' },
  { value: 'filter', label: '필터링 융합', description: '특정 태그만 선택적으로 융합', icon: '🏷️' },
];

export function FusionModal({ selectedAuthors, onClose, onCreateAuthor }: FusionModalProps) {
  const { geminiApiKey } = useSettingsStore();

  const [isLoading, setIsLoading] = useState(false);
  const [fusedProfile, setFusedProfile] = useState<Partial<AiAuthor> | null>(null);
  const [authorName, setAuthorName] = useState('');

  // 융합 옵션
  const [fusionMode, setFusionMode] = useState<FusionMode>('creative');
  const [goal, setGoal] = useState('');
  const [weights, setWeights] = useState<number[]>(() => selectedAuthors.map(() => 50));
  const [customPrompt, setCustomPrompt] = useState('');

  // 필터링용 태그 수집
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    selectedAuthors.forEach(a => a.tags?.forEach(t => tags.add(t)));
    return Array.from(tags);
  }, [selectedAuthors]);
  const [filterTags, setFilterTags] = useState<string[]>([]);

  const handleWeightChange = (index: number, value: number) => {
    const newWeights = [...weights];
    newWeights[index] = value;
    setWeights(newWeights);
  };

  const handleTagToggle = (tag: string) => {
    setFilterTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleFuse = async () => {
    if (selectedAuthors.length < 2) {
      toast.warning('최소 2명의 작가를 선택해야 합니다.');
      return;
    }

    if (!geminiApiKey) {
      toast.warning('Gemini API 키가 설정되지 않았습니다.');
      return;
    }

    setIsLoading(true);
    setFusedProfile(null);

    try {
      const options: FusionOptions = {
        mode: fusionMode,
        customPrompt: customPrompt || undefined,
      };

      if (fusionMode === 'goal' && goal) {
        options.goal = goal;
      }
      if (fusionMode === 'weighted') {
        options.weights = weights;
      }
      if (fusionMode === 'filter' && filterTags.length > 0) {
        options.filterTags = filterTags;
      }

      const profile = await fuseAuthorProfiles(selectedAuthors, options);
      setFusedProfile(profile);
      setAuthorName(profile.name || `융합 작가`);
    } catch (error) {
      console.error('작가 융합 실패:', error);
      toast.error(formatAiErrorForUser(error, '작가 융합에 실패했습니다.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = () => {
    if (!fusedProfile || !authorName.trim()) return;

    onCreateAuthor({
      name: authorName,
      specialty: fusedProfile.specialty || '',
      writingStyle: fusedProfile.writingStyle || '',
      coreDirectives: fusedProfile.coreDirectives || '',
      tags: fusedProfile.tags || [],
      identityCore: fusedProfile.identityCore,
    });

    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} title="작가 융합" size="xl">
      <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
        {/* 선택된 작가 표시 */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            융합할 작가들 ({selectedAuthors.length}명)
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedAuthors.map((author) => (
              <span
                key={author.id}
                className="px-3 py-1 bg-teal-600/50 text-teal-200 rounded-lg text-sm"
              >
                {author.name}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-blue-500/30 bg-blue-950/20 p-3 text-sm text-blue-100">
          Gemini 빠른 생성으로 작가들을 융합합니다. 응답이 늦으면 짧게 중단하고 다시 시도할 수 있습니다.
        </div>

        {/* 융합 모드 선택 */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            융합 모드
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {FUSION_MODES.map((mode) => (
              <button
                key={mode.value}
                onClick={() => setFusionMode(mode.value)}
                disabled={isLoading}
                className={`p-3 rounded-lg border text-left transition-colors ${
                  fusionMode === mode.value
                    ? 'bg-teal-600/50 border-teal-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <span>{mode.icon}</span>
                  <span>{mode.label}</span>
                </div>
                <p className="text-xs text-gray-400 mt-1">{mode.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 목적기반 융합 - 목표 입력 */}
        {fusionMode === 'goal' && (
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              🎯 융합 목표
            </label>
            <input
              type="text"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="예: 다크 판타지에 특화된 작가, 로맨스 감정선 전문가..."
              className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white"
              disabled={isLoading}
            />
          </div>
        )}

        {/* 가중치 융합 - 슬라이더 */}
        {fusionMode === 'weighted' && (
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              ⚖️ 작가별 가중치
            </label>
            <div className="space-y-3">
              {selectedAuthors.map((author, idx) => (
                <div key={author.id} className="flex items-center gap-3">
                  <span className="text-sm text-gray-400 w-24 truncate">{author.name}</span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={weights[idx]}
                    onChange={(e) => handleWeightChange(idx, parseInt(e.target.value))}
                    className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
                    disabled={isLoading}
                  />
                  <span className="text-sm text-teal-400 w-12 text-right">{weights[idx]}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 필터링 융합 - 태그 선택 */}
        {fusionMode === 'filter' && (
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              🏷️ 보존할 태그 선택
            </label>
            {allTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {allTags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleTagToggle(tag)}
                    disabled={isLoading}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      filterTags.includes(tag)
                        ? 'bg-teal-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">선택된 작가들에게 태그가 없습니다.</p>
            )}
          </div>
        )}

        {/* 추가 지시사항 */}
        <div>
          <label className="block text-sm font-semibold text-gray-300 mb-2">
            추가 지시사항 (선택사항)
          </label>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="예: 첫 번째 작가의 문체에 두 번째 작가의 감성을 더해주세요..."
            className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white resize-none"
            rows={2}
            disabled={isLoading}
          />
        </div>

        {/* 융합 버튼 */}
        <Button variant="teal" onClick={handleFuse} disabled={isLoading} className="w-full">
          {isLoading ? '빠르게 융합 중...' : `${FUSION_MODES.find(m => m.value === fusionMode)?.icon} 작가 융합하기`}
        </Button>

        {/* 융합 결과 */}
        {fusedProfile && (
          <div className="bg-gray-700 rounded-lg p-4 space-y-4 border border-teal-500/50">
            <div className="flex items-center gap-2 text-teal-400 font-medium">
              <span>✅</span>
              <span>융합 완료</span>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                새 작가 이름
              </label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                전문 분야
              </label>
              <p className="text-gray-400 text-sm bg-gray-800 p-2 rounded">
                {fusedProfile.specialty}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                문체 스타일
              </label>
              <p className="text-gray-400 text-sm bg-gray-800 p-2 rounded whitespace-pre-wrap max-h-32 overflow-y-auto">
                {fusedProfile.writingStyle}
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-1">
                핵심 지침
              </label>
              <p className="text-gray-400 text-sm bg-gray-800 p-2 rounded whitespace-pre-wrap max-h-32 overflow-y-auto">
                {fusedProfile.coreDirectives}
              </p>
            </div>

            {fusedProfile.tags && fusedProfile.tags.length > 0 && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-1">
                  태그
                </label>
                <div className="flex flex-wrap gap-2">
                  {fusedProfile.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-teal-600/50 text-teal-200 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          {fusedProfile && (
            <Button
              variant="teal"
              onClick={handleCreate}
              disabled={!authorName.trim()}
            >
              융합 작가 생성
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

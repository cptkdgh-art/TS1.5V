/**
 * ============================================================
 * @module modules/editor/modals
 * @file ForeshadowingModal.tsx
 * ============================================================
 * @description 복선 추가/수정 모달 - 개연성 중심 복선 편집
 * ============================================================
 */

import { useState } from 'react';
import type { Novel, Foreshadowing, ForeshadowingType, ForeshadowingUrgency } from '@core/types';
import { extractTrackingKeywords } from '@services/ai';

// 복선 유형 한글 매핑
const TYPE_LABELS: Record<ForeshadowingType, string> = {
  chekhov_gun: '체호프의 총',
  character_secret: '인물의 비밀',
  prophecy: '예언/암시',
  mystery: '미스터리',
  relationship: '관계 복선',
  worldview: '세계관 복선',
  symbolic: '상징적 모티프',
  red_herring: '레드 헤링 (페이크)',
};

// 긴급도 한글 매핑
const URGENCY_LABELS: Record<ForeshadowingUrgency, { label: string }> = {
  immediate: { label: '즉시 (1-3화)' },
  short: { label: '단기 (5-10화)' },
  medium: { label: '중기 (이번 권)' },
  long: { label: '장기 (다음 권)' },
  series: { label: '대서사 (완결)' },
};

interface ForeshadowingModalProps {
  item: Foreshadowing | null;
  novel: Novel;
  onSave: (item: Foreshadowing) => void;
  onClose: () => void;
}

export function ForeshadowingModal({ item, novel, onSave, onClose }: ForeshadowingModalProps) {
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [type, setType] = useState<ForeshadowingType>(item?.type || 'mystery');
  const [urgency, setUrgency] = useState<ForeshadowingUrgency>(item?.urgency || 'medium');
  const [importance, setImportance] = useState<1 | 2 | 3 | 4 | 5>(item?.importance || 3);
  const [premise, setPremise] = useState(item?.causality.premise || '');
  const [implication, setImplication] = useState(item?.causality.implication || '');
  const [consequence, setConsequence] = useState(item?.causality.consequence || '');
  const [plantedChapter, setPlantedChapter] = useState(item?.plantedAt.chapterIndex || 0);
  const [plantedContext, setPlantedContext] = useState(item?.plantedAt.briefContext || '');
  const [doHint, setDoHint] = useState(item?.aiGuidance.doHint.join('\n') || '');
  const [dontReveal, setDontReveal] = useState(item?.aiGuidance.dontReveal.join('\n') || '');
  const [payoffTiming, setPayoffTiming] = useState(item?.aiGuidance.payoffTiming || '');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const newItem: Foreshadowing = {
      id: item?.id || `fs_${now}`,
      name,
      description,
      type,
      urgency,
      status: item?.status || 'planted',
      causality: {
        premise,
        implication,
        consequence,
      },
      plantedAt: {
        chapterIndex: plantedChapter,
        briefContext: plantedContext,
      },
      hints: item?.hints || [],
      linkedCharacterIds: item?.linkedCharacterIds || [],
      linkedForeshadowingIds: item?.linkedForeshadowingIds || [],
      aiGuidance: {
        doHint: doHint.split('\n').filter(Boolean),
        dontReveal: dontReveal.split('\n').filter(Boolean),
        payoffTiming,
      },
      createdAt: item?.createdAt || now,
      updatedAt: now,
      importance,
      trackingKeywords: extractTrackingKeywords(plantedContext, name),
    };
    onSave(newItem);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <h2 className="text-xl font-bold mb-4">
          {item ? '복선 수정' : '새 복선 추가'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 기본 정보 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">복선 이름 *</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="예: 검은 반지의 비밀"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">중요도</label>
              <select
                value={importance}
                onChange={(e) => setImportance(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value={1}>★☆☆☆☆ (부수적)</option>
                <option value={2}>★★☆☆☆ (보조)</option>
                <option value={3}>★★★☆☆ (중요)</option>
                <option value={4}>★★★★☆ (핵심)</option>
                <option value={5}>★★★★★ (대서사)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">설명 *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-20"
              placeholder="이 복선이 무엇인지 설명해주세요"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">유형</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ForeshadowingType)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                {Object.entries(TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">회수 시점</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as ForeshadowingUrgency)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                {Object.entries(URGENCY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 인과관계 (개연성 핵심) */}
          <div className="bg-gray-700/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-indigo-400 mb-3">인과관계 체인 (개연성의 핵심)</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">전제: 왜 이 복선이 심어졌는가?</label>
                <input
                  type="text"
                  value={premise}
                  onChange={(e) => setPremise(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="예: 주인공이 어린 시절 발견한 반지가 실은..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">함의: 회수 시 독자가 납득할 논리</label>
                <input
                  type="text"
                  value={implication}
                  onChange={(e) => setImplication(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="예: 반지의 문양이 왕가의 상징이었으므로..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">결과: 회수 후 스토리에 미치는 영향</label>
                <input
                  type="text"
                  value={consequence}
                  onChange={(e) => setConsequence(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="예: 주인공의 정체가 밝혀지며 갈등 구조가 변화"
                />
              </div>
            </div>
          </div>

          {/* 위치 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">심어진 챕터</label>
              <select
                value={plantedChapter}
                onChange={(e) => setPlantedChapter(Number(e.target.value))}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
              >
                {novel.chapters.map((ch, i) => (
                  <option key={i} value={i}>{i + 1}화: {ch.title || '(제목 없음)'}</option>
                ))}
                {novel.chapters.length === 0 && <option value={0}>챕터 없음</option>}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">장면 설명</label>
              <input
                type="text"
                value={plantedContext}
                onChange={(e) => setPlantedContext(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                placeholder="어떤 장면에서 심어졌는지"
              />
            </div>
          </div>

          {/* AI 가이드 */}
          <div className="bg-amber-900/20 border border-amber-700/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-amber-400 mb-3">AI 작가 가이드</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-300 mb-1">힌트 줄 때 이렇게 (줄바꿈으로 구분)</label>
                <textarea
                  value={doHint}
                  onChange={(e) => setDoHint(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-16"
                  placeholder="반지를 만지작거리는 습관 묘사&#10;반지에 대한 질문에 말을 돌리기"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">아직 밝히지 말 것 (줄바꿈으로 구분)</label>
                <textarea
                  value={dontReveal}
                  onChange={(e) => setDontReveal(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white h-16"
                  placeholder="반지의 정확한 출처&#10;왕가와의 연결"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1">언제 회수하면 좋을지</label>
                <input
                  type="text"
                  value={payoffTiming}
                  onChange={(e) => setPayoffTiming(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white"
                  placeholder="예: 왕궁에 잠입하는 장면에서 자연스럽게"
                />
              </div>
            </div>
          </div>

          {/* 버튼 */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg"
            >
              취소
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold"
            >
              {item ? '수정' : '추가'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

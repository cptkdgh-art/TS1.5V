/**
 * ============================================================
 * @module modules/editor/tabs
 * @file ForeshadowingTab.tsx
 * ============================================================
 * @description 복선/떡밥 관리 탭 - 개연성 중심 설계
 *
 * 이 탭의 목적:
 * 1. 사용자가 복선 현황을 한눈에 파악
 * 2. AI 작가에게 복선 가이드 제공
 * 3. 개연성 점수와 호흡 조절 상태 시각화
 * ============================================================
 */

import { useState } from 'react';
import type { Novel, Foreshadowing, ForeshadowingSystem, ForeshadowingType, ForeshadowingUrgency, ForeshadowingStatus } from '@core/types';
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  WandSparklesIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  LightBulbIcon,
  LinkIcon,
  toast,
} from '@shared/components';
import { analyzeForeshadowingFromText, createForeshadowingFromAnalysis, checkAllForeshadowings } from '@services/ai';
import { ForeshadowingModal } from '../modals/ForeshadowingModal';

interface ForeshadowingTabProps {
  novel: Novel;
  onUpdateNovel: (updatedNovel: Novel) => void;
}

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
const URGENCY_LABELS: Record<ForeshadowingUrgency, { label: string; color: string }> = {
  immediate: { label: '즉시 (1-3화)', color: 'bg-red-600' },
  short: { label: '단기 (5-10화)', color: 'bg-orange-600' },
  medium: { label: '중기 (이번 권)', color: 'bg-yellow-600' },
  long: { label: '장기 (다음 권)', color: 'bg-blue-600' },
  series: { label: '대서사 (완결)', color: 'bg-purple-600' },
};

// 상태 한글 매핑
const STATUS_LABELS: Record<ForeshadowingStatus, { label: string; icon: 'planted' | 'hinted' | 'paid' | 'abandoned' }> = {
  planted: { label: '심어짐', icon: 'planted' },
  hinted: { label: '힌트 제공됨', icon: 'hinted' },
  partially_paid: { label: '부분 회수', icon: 'paid' },
  fully_paid: { label: '완전 회수', icon: 'paid' },
  abandoned: { label: '폐기됨', icon: 'abandoned' },
};

export function ForeshadowingTab({
  novel,
  onUpdateNovel,
}: ForeshadowingTabProps) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [editingItem, setEditingItem] = useState<Foreshadowing | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'resolved'>('all');

  // 사라진 복선 체크
  const missingForeshadowings = checkAllForeshadowings(novel).filter((r) => !r.exists);

  const system = novel.foreshadowingSystem || {
    items: [],
    pacingGuide: {
      currentTension: 50,
      plantedCount: 0,
      awaitingPayoffCount: 0,
      recommendation: 'balanced' as const,
      urgentPayoffs: [],
    },
  };

  const items = system.items;

  // 본문에서 복선 분석 핸들러
  const handleAnalyzeForeshadowing = async () => {
    if (novel.chapters.length === 0) return;

    setIsAnalyzing(true);
    try {
      const analysisResult = await analyzeForeshadowingFromText(novel, system.items);

      // 분석된 복선들을 Foreshadowing 객체로 변환
      const newItems = analysisResult.detectedForeshadowings.map((detected) =>
        createForeshadowingFromAnalysis(detected, novel.chapters.length - 1)
      );

      const updatedSystem: ForeshadowingSystem = {
        ...system,
        items: [...system.items, ...newItems],
      };

      onUpdateNovel({
        ...novel,
        foreshadowingSystem: updatedSystem,
      });
    } catch (error) {
      console.error('복선 분석 실패:', error);
      toast.error('복선 분석에 실패했습니다.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 필터링된 아이템
  const filteredItems = items.filter((item) => {
    if (filterStatus === 'all') return true;
    if (filterStatus === 'active') return ['planted', 'hinted', 'partially_paid'].includes(item.status);
    if (filterStatus === 'resolved') return ['fully_paid', 'abandoned'].includes(item.status);
    return true;
  });

  // 통계 계산
  const stats = {
    total: items.length,
    active: items.filter((i) => ['planted', 'hinted', 'partially_paid'].includes(i.status)).length,
    resolved: items.filter((i) => ['fully_paid', 'abandoned'].includes(i.status)).length,
    urgent: items.filter((i) => i.urgency === 'immediate' && i.status === 'planted').length,
  };

  // 호흡 조절 추천 텍스트
  const getPacingRecommendation = () => {
    const guide = system.pacingGuide;
    switch (guide.recommendation) {
      case 'plant_more':
        return { text: '복선을 더 심어보세요', color: 'text-blue-400', icon: '🌱' };
      case 'give_hints':
        return { text: '힌트를 좀 더 줘야 합니다', color: 'text-yellow-400', icon: '💡' };
      case 'payoff_soon':
        return { text: '회수할 때가 됐습니다', color: 'text-orange-400', icon: '⏰' };
      case 'balanced':
      default:
        return { text: '현재 균형 잡힘', color: 'text-green-400', icon: '✓' };
    }
  };

  const toggleExpand = (id: string) => {
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setExpandedIds(next);
  };

  const handleDelete = (id: string) => {
    const newItems = items.filter((i) => i.id !== id);
    onUpdateNovel({
      ...novel,
      foreshadowingSystem: {
        ...system,
        items: newItems,
        pacingGuide: {
          ...system.pacingGuide,
          plantedCount: newItems.filter((i) => i.status === 'planted').length,
          awaitingPayoffCount: newItems.filter((i) => ['planted', 'hinted', 'partially_paid'].includes(i.status)).length,
        },
      },
    });
  };

  const handleStatusChange = (id: string, newStatus: ForeshadowingStatus) => {
    const newItems = items.map((i) =>
      i.id === id ? { ...i, status: newStatus, updatedAt: Date.now() } : i
    );
    onUpdateNovel({
      ...novel,
      foreshadowingSystem: {
        ...system,
        items: newItems,
      },
    });
  };

  const pacing = getPacingRecommendation();

  return (
    <div className="font-sans">
      {/* 헤더 */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">복선 관리</h2>
          <p className="text-sm text-gray-400 mt-1">개연성을 위한 떡밥 추적</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleAnalyzeForeshadowing}
            disabled={isAnalyzing || novel.chapters.length === 0}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-3 rounded-lg text-sm disabled:bg-gray-700 disabled:cursor-wait"
          >
            <WandSparklesIcon className="w-4 h-4" />
            {isAnalyzing ? '분석 중...' : '본문에서 복선 찾기'}
          </button>
          <button
            onClick={() => {
              setEditingItem(null);
              setIsAddModalOpen(true);
            }}
            className="p-2 text-white rounded-full bg-indigo-600 hover:bg-indigo-700"
          >
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* 대시보드 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-3xl font-bold text-white">{stats.total}</div>
          <div className="text-sm text-gray-400">전체 복선</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-3xl font-bold text-indigo-400">{stats.active}</div>
          <div className="text-sm text-gray-400">활성 복선</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-3xl font-bold text-green-400">{stats.resolved}</div>
          <div className="text-sm text-gray-400">회수 완료</div>
        </div>
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="text-3xl font-bold text-red-400">{stats.urgent}</div>
          <div className="text-sm text-gray-400">긴급 회수 필요</div>
        </div>
      </div>

      {/* 사라진 복선 경고 */}
      {missingForeshadowings.length > 0 && (
        <div className="bg-red-900/30 border border-red-700/50 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
            <h3 className="font-semibold text-red-400">
              본문에서 사라진 복선 ({missingForeshadowings.length}개)
            </h3>
          </div>
          <ul className="space-y-2">
            {missingForeshadowings.map((item) => (
              <li
                key={item.foreshadowing.id}
                className="flex items-center justify-between bg-gray-800 rounded p-2"
              >
                <div>
                  <span className="text-white font-medium">{item.foreshadowing.name}</span>
                  <span className="text-gray-400 text-sm ml-2">
                    ({item.foreshadowing.plantedAt.chapterIndex + 1}화에 설치됨)
                  </span>
                  <p className="text-xs text-gray-500 mt-1">{item.suggestion}</p>
                </div>
                <button
                  onClick={() => handleDelete(item.foreshadowing.id)}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 호흡 조절 가이드 */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{pacing.icon}</span>
            <div>
              <h3 className="font-semibold text-white">호흡 조절 가이드</h3>
              <p className={`text-sm ${pacing.color}`}>{pacing.text}</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-400">긴장도</div>
            <div className="flex items-center gap-2">
              <div className="w-32 h-2 bg-gray-600 rounded-full">
                <div
                  className="h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500 rounded-full"
                  style={{ width: `${system.pacingGuide.currentTension}%` }}
                />
              </div>
              <span className="text-sm text-white">{system.pacingGuide.currentTension}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-4">
        {(['all', 'active', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilterStatus(f)}
            className={`px-3 py-1 rounded-full text-sm ${
              filterStatus === f
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            {f === 'all' ? '전체' : f === 'active' ? '활성' : '회수됨'}
          </button>
        ))}
      </div>

      {/* 복선 목록 */}
      {filteredItems.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <LightBulbIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>아직 등록된 복선이 없습니다.</p>
          <p className="text-sm mt-1">
            "본문에서 복선 찾기"로 AI가 자동 분석하거나,
            <br />
            직접 복선을 추가해보세요.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {filteredItems.map((item) => (
            <li key={item.id} className="bg-gray-700 rounded-lg overflow-hidden">
              {/* 헤더 */}
              <div
                className="p-4 cursor-pointer hover:bg-gray-650"
                onClick={() => toggleExpand(item.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <ChevronDownIcon
                      className={`w-5 h-5 text-gray-400 transition-transform ${
                        expandedIds.has(item.id) ? 'rotate-180' : ''
                      }`}
                    />
                    <div>
                      <h3 className="font-bold text-white">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs bg-gray-600 px-2 py-0.5 rounded">
                          {TYPE_LABELS[item.type]}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded ${URGENCY_LABELS[item.urgency].color}`}
                        >
                          {URGENCY_LABELS[item.urgency].label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {STATUS_LABELS[item.status].label}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.status === 'planted' && item.urgency === 'immediate' && (
                      <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
                    )}
                    {item.status === 'fully_paid' && (
                      <CheckCircleIcon className="w-5 h-5 text-green-400" />
                    )}
                    <div className="flex gap-1">
                      {'★'.repeat(item.importance)}
                      {'☆'.repeat(5 - item.importance)}
                    </div>
                  </div>
                </div>
              </div>

              {/* 확장된 상세 정보 */}
              {expandedIds.has(item.id) && (
                <div className="px-4 pb-4 border-t border-gray-600">
                  <div className="pt-4 space-y-4">
                    {/* 설명 */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-400 mb-1">설명</h4>
                      <p className="text-sm text-gray-200">{item.description}</p>
                    </div>

                    {/* 인과관계 (개연성 핵심) */}
                    <div className="bg-gray-800 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-indigo-400 mb-2">
                        인과관계 체인 (개연성)
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div>
                          <span className="text-gray-400">전제: </span>
                          <span className="text-gray-200">{item.causality.premise}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">함의: </span>
                          <span className="text-gray-200">{item.causality.implication}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">결과: </span>
                          <span className="text-gray-200">{item.causality.consequence}</span>
                        </div>
                      </div>
                    </div>

                    {/* 위치 정보 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-400 mb-1">심어진 위치</h4>
                        <p className="text-sm text-gray-200">
                          {item.plantedAt.chapterIndex + 1}화: {item.plantedAt.briefContext}
                        </p>
                      </div>
                      {item.hints.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-400 mb-1">
                            힌트 ({item.hints.length}개)
                          </h4>
                          <ul className="text-sm text-gray-200 space-y-1">
                            {item.hints.slice(0, 2).map((h, i) => (
                              <li key={i}>
                                {h.chapterIndex + 1}화: {h.hint}
                              </li>
                            ))}
                            {item.hints.length > 2 && (
                              <li className="text-gray-500">외 {item.hints.length - 2}개...</li>
                            )}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* AI 가이드 */}
                    <div className="bg-amber-900/30 border border-amber-700/50 rounded-lg p-3">
                      <h4 className="text-sm font-semibold text-amber-400 mb-2">AI 작가 가이드</h4>
                      <div className="space-y-2 text-sm">
                        {item.aiGuidance.doHint.length > 0 && (
                          <div>
                            <span className="text-green-400">✓ Do: </span>
                            <span className="text-gray-200">{item.aiGuidance.doHint.join(', ')}</span>
                          </div>
                        )}
                        {item.aiGuidance.dontReveal.length > 0 && (
                          <div>
                            <span className="text-red-400">✗ Don't: </span>
                            <span className="text-gray-200">{item.aiGuidance.dontReveal.join(', ')}</span>
                          </div>
                        )}
                        <div>
                          <span className="text-gray-400">회수 타이밍: </span>
                          <span className="text-gray-200">{item.aiGuidance.payoffTiming}</span>
                        </div>
                      </div>
                    </div>

                    {/* 연결된 요소 */}
                    {(item.linkedCharacterIds.length > 0 || item.linkedForeshadowingIds.length > 0) && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <LinkIcon className="w-4 h-4" />
                        <span>
                          {item.linkedCharacterIds.length > 0 && `인물 ${item.linkedCharacterIds.length}명`}
                          {item.linkedCharacterIds.length > 0 && item.linkedForeshadowingIds.length > 0 && ', '}
                          {item.linkedForeshadowingIds.length > 0 && `복선 ${item.linkedForeshadowingIds.length}개 연결됨`}
                        </span>
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    <div className="flex justify-between items-center pt-2 border-t border-gray-600">
                      <div className="flex gap-2">
                        <select
                          value={item.status}
                          onChange={(e) => handleStatusChange(item.id, e.target.value as ForeshadowingStatus)}
                          className="bg-gray-600 text-white text-sm rounded px-2 py-1"
                        >
                          <option value="planted">심어짐</option>
                          <option value="hinted">힌트 제공됨</option>
                          <option value="partially_paid">부분 회수</option>
                          <option value="fully_paid">완전 회수</option>
                          <option value="abandoned">폐기</option>
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setIsAddModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-white"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="p-1 text-gray-400 hover:text-red-400"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 개연성 체크 결과 */}
      {system.coherenceCheck && (
        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white">개연성 체크</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">점수:</span>
              <span
                className={`text-lg font-bold ${
                  system.coherenceCheck.overallScore >= 80
                    ? 'text-green-400'
                    : system.coherenceCheck.overallScore >= 60
                    ? 'text-yellow-400'
                    : 'text-red-400'
                }`}
              >
                {system.coherenceCheck.overallScore}/100
              </span>
            </div>
          </div>
          {system.coherenceCheck.issues.length > 0 ? (
            <ul className="space-y-2">
              {system.coherenceCheck.issues.map((issue, i) => (
                <li key={i} className="bg-gray-700 rounded p-2 text-sm">
                  <div className="text-red-400">{issue.issue}</div>
                  <div className="text-gray-400 mt-1">💡 {issue.suggestion}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-green-400">현재 개연성 문제가 발견되지 않았습니다.</p>
          )}
        </div>
      )}

      {/* 복선 추가/수정 모달 */}
      {isAddModalOpen && (
        <ForeshadowingModal
          item={editingItem}
          novel={novel}
          onSave={(newItem) => {
            const newItems = editingItem
              ? items.map((i) => (i.id === editingItem.id ? newItem : i))
              : [...items, newItem];
            onUpdateNovel({
              ...novel,
              foreshadowingSystem: {
                ...system,
                items: newItems,
              },
            });
            setIsAddModalOpen(false);
            setEditingItem(null);
          }}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}


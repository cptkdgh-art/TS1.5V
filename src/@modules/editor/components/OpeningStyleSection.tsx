/**
 * ============================================================
 * @module modules/editor/components
 * @file OpeningStyleSection.tsx
 * ============================================================
 * @description 1화 오프닝 스타일 + 시작 시점 선택 섹션
 * ============================================================
 */

import type { Novel, OpeningStyle, StartingPoint } from '@core/types';

const OPENING_STYLES: { value: OpeningStyle; label: string; emoji: string; desc: string }[] = [
  { value: 'intense', label: '강렬한 시작', emoji: '🔥', desc: '사건 한복판에서 시작' },
  { value: 'buildup', label: '차분한 빌드업', emoji: '📖', desc: '일상 → 균열 → 사건' },
  { value: 'mystery', label: '미스터리형', emoji: '❓', desc: '의문을 던지며 시작' },
  { value: 'prologue', label: '프롤로그형', emoji: '⏰', desc: '미래 힌트 → 과거로' },
];

const STARTING_POINTS: { value: StartingPoint; label: string; emoji: string; desc: string }[] = [
  { value: 'daily', label: '일상에서', emoji: '☀️', desc: '평범한 하루에서 시작' },
  { value: 'crack', label: '균열에서', emoji: '🌙', desc: '이미 뭔가 이상한 조짐' },
  { value: 'before-incident', label: '사건 직전', emoji: '⚡', desc: '긴장감이 고조되는 순간' },
  { value: 'mid-incident', label: '사건 한복판', emoji: '💥', desc: '인 메디아스 레스' },
];

interface OpeningStyleSectionProps {
  novel: Novel;
  onUpdateNovel: (novel: Novel) => void;
}

export function OpeningStyleSection({ novel, onUpdateNovel }: OpeningStyleSectionProps) {
  const currentOpeningStyle = novel.openingStyle ?? 'intense';
  const currentStartingPoint = novel.startingPoint ?? 'mid-incident';

  const handleOpeningStyleChange = (style: OpeningStyle) => {
    onUpdateNovel({ ...novel, openingStyle: style });
  };

  const handleStartingPointChange = (point: StartingPoint) => {
    onUpdateNovel({ ...novel, startingPoint: point });
  };

  return (
    <div className="bg-gray-700/50 p-4 rounded-md border border-gray-600 space-y-4">
      <h4 className="text-sm font-bold text-indigo-400">🎬 1화 오프닝 설정</h4>
      <p className="text-xs text-gray-400">
        1화를 어떻게 시작할지 결정합니다. AI가 이 설정에 맞춰 첫 화를 작성합니다.
      </p>

      {/* 오프닝 스타일 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">오프닝 스타일</label>
        <div className="grid grid-cols-2 gap-2">
          {OPENING_STYLES.map((style) => (
            <button
              key={style.value}
              onClick={() => handleOpeningStyleChange(style.value)}
              className={`p-3 rounded-lg border text-left transition-all ${
                currentOpeningStyle === style.value
                  ? 'bg-indigo-600/30 border-indigo-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{style.emoji}</span>
                <span className="font-medium text-sm">{style.label}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{style.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 시작 시점 */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">시작 시점</label>
        <div className="grid grid-cols-2 gap-2">
          {STARTING_POINTS.map((point) => (
            <button
              key={point.value}
              onClick={() => handleStartingPointChange(point.value)}
              className={`p-3 rounded-lg border text-left transition-all ${
                currentStartingPoint === point.value
                  ? 'bg-teal-600/30 border-teal-500 text-white'
                  : 'bg-gray-800 border-gray-600 text-gray-300 hover:border-gray-500'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{point.emoji}</span>
                <span className="font-medium text-sm">{point.label}</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">{point.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* 조합 미리보기 */}
      <div className="bg-gray-900/50 p-3 rounded text-xs border border-gray-700">
        <span className="text-indigo-400 font-medium">현재 설정: </span>
        <span className="text-white">
          {OPENING_STYLES.find((s) => s.value === currentOpeningStyle)?.emoji}{' '}
          {OPENING_STYLES.find((s) => s.value === currentOpeningStyle)?.label} +{' '}
          {STARTING_POINTS.find((p) => p.value === currentStartingPoint)?.emoji}{' '}
          {STARTING_POINTS.find((p) => p.value === currentStartingPoint)?.label}
        </span>
      </div>
    </div>
  );
}

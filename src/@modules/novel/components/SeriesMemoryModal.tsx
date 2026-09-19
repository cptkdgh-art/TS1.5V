/**
 * ============================================================
 * @module modules/novel/components
 * @file SeriesMemoryModal.tsx
 * ============================================================
 * @description 시리즈 연대기/기억 관리 모달
 * ============================================================
 */

import { useMemo, useState } from 'react';
import type { Novel, Series, SeriesMemoryState } from '@core/types';
import { XMarkIcon, WandSparklesIcon, toast, useConfirmDialog } from '@shared/components';
import { inspectSeriesMemoryState, summarizeSeriesHistory } from '@services/ai';

interface SeriesMemoryModalProps {
  series: Series;
  novelsInSeries: Novel[];
  onClose: () => void;
  onUpdateSeries: (updatedSeries: Series) => void;
}

export function SeriesMemoryModal({
  series,
  novelsInSeries,
  onClose,
  onUpdateSeries,
}: SeriesMemoryModalProps) {
  const [compendium, setCompendium] = useState(series.seriesMemoryCompendium || '');
  const [memoryState, setMemoryState] = useState<SeriesMemoryState | undefined>(series.seriesMemoryState);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const confirm = useConfirmDialog();
  const inspection = useMemo(
    () => inspectSeriesMemoryState({ ...series, seriesMemoryState: memoryState }, novelsInSeries),
    [series, memoryState, novelsInSeries],
  );

  const handleSummarize = async () => {
    const novelsWithSummaries = novelsInSeries.filter(n => n.contextSummary?.content);
    if (novelsWithSummaries.length === 0) {
      toast.warning("시리즈를 요약하려면 각 권의 '문맥 요약'이 먼저 생성되어야 합니다. 집필 화면의 '캐시 센터' 탭에서 각 권의 요약을 생성해주세요.");
      return;
    }
    const confirmed = await confirm({
      title: '시리즈 연대기 생성',
      message: inspection.staleNovelIds.length > 0
        ? `총 ${novelsWithSummaries.length}권 중 새로 생겼거나 바뀐 ${inspection.staleNovelIds.length}권만 AI로 갱신합니다. 나머지 ${inspection.reusedCount}권은 기존 기억을 재사용합니다.`
        : `현재 ${inspection.reusedCount}권의 연대기가 모두 최신입니다. 권 순서와 삭제 상태만 다시 정리하며 AI 비용은 발생하지 않습니다.`,
      confirmText: '생성',
      variant: 'primary',
    });
    if (!confirmed) {
      return;
    }

    setIsSummarizing(true);
    try {
      const result = await summarizeSeriesHistory(novelsInSeries, { ...series, seriesMemoryState: memoryState });
      setCompendium(result.content);
      setMemoryState(result.memoryState);
      toast.success(result.changedCount > 0
        ? `변경된 ${result.changedCount}권만 갱신했습니다. 기존 ${result.reusedCount}권은 재사용했습니다.`
        : '모든 권 기억이 최신이라 순서와 삭제 상태만 정리했습니다.');
    } catch (error) {
      toast.error(`시리즈 기억 생성 실패: ${(error as Error).message}`);
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSave = () => {
    onUpdateSeries({ ...series, seriesMemoryCompendium: compendium, seriesMemoryState: memoryState });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-3xl relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-4 text-white">
          연대기 관리실: {series.title}
        </h2>
        <p className="text-sm text-gray-400 mb-6">
          시리즈 전체를 관통하는 핵심 역사를 관리합니다. 이 내용은 시리즈에 속한 모든
          소설을 집필할 때 AI의 장기 기억으로 사용됩니다.
        </p>

        <div className="flex-grow flex flex-col min-h-0">
          <div className="grid grid-cols-3 gap-2 mb-4 text-center text-xs">
            <div className="bg-emerald-950/50 border border-emerald-800/60 rounded p-2 text-emerald-200">
              최신 {inspection.reusedCount}권
            </div>
            <div className="bg-amber-950/50 border border-amber-800/60 rounded p-2 text-amber-200">
              갱신 필요 {inspection.staleNovelIds.length}권
            </div>
            <div className="bg-gray-900 border border-gray-700 rounded p-2 text-gray-300">
              삭제 정리 {inspection.removedBlocks.length}권
            </div>
          </div>
          <label
            htmlFor="series-compendium"
            className="block text-sm font-medium text-gray-300 mb-2"
          >
            시리즈 연대기
          </label>
          <textarea
            id="series-compendium"
            value={compendium}
            onChange={(e) => {
              setCompendium(e.target.value);
              setMemoryState(undefined);
            }}
            className="w-full flex-grow bg-gray-900 border border-gray-600 rounded-md p-3 text-sm text-white focus:ring-indigo-500 focus:border-indigo-500"
            placeholder="AI로 생성하거나, 시리즈의 핵심 사건 흐름을 직접 작성할 수 있습니다."
          />
        </div>

        <div className="flex justify-between items-center pt-6">
          <button
            onClick={handleSummarize}
            disabled={isSummarizing}
            className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg text-sm flex items-center gap-2 disabled:bg-gray-700"
          >
            <WandSparklesIcon className="w-4 h-4" />
            {isSummarizing ? '갱신 중...' : '변경된 권만 업데이트'}
          </button>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-500 font-bold py-2 px-4 rounded-lg"
            >
              취소
            </button>
            <button
              onClick={handleSave}
              className="bg-indigo-600 hover:bg-indigo-700 font-bold py-2 px-4 rounded-lg"
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

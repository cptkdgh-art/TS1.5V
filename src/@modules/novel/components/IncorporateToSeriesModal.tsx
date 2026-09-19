/**
 * ============================================================
 * @module modules/novel/components
 * @file IncorporateToSeriesModal.tsx
 * ============================================================
 * @description 소설을 시리즈에 편입하는 모달
 * ============================================================
 */

import { useMemo, useState } from 'react';
import type { Novel, Series } from '@core/types';
import { XMarkIcon, ClipboardDocumentListIcon, toast } from '@shared/components';

export type IncorporateTarget =
  | { type: 'existing'; seriesId: string; seriesVolumeId?: string }
  | { type: 'new'; seriesTitle: string; seriesPlot: string };

interface IncorporateToSeriesModalProps {
  novel: Novel;
  seriesList: Series[];
  onClose: () => void;
  onConfirm: (target: IncorporateTarget) => void;
}

export function IncorporateToSeriesModal({
  novel,
  seriesList,
  onClose,
  onConfirm,
}: IncorporateToSeriesModalProps) {
  const [mode, setMode] = useState<'existing' | 'new'>(
    seriesList.length > 0 ? 'existing' : 'new'
  );
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>(
    seriesList[0]?.id || ''
  );
  const [selectedVolumeId, setSelectedVolumeId] = useState('');
  const [newSeriesTitle, setNewSeriesTitle] = useState(`${novel.title} 시리즈`);
  const [newSeriesPlot, setNewSeriesPlot] = useState(novel.plotSummary || '');
  const selectedSeries = useMemo(
    () => seriesList.find((series) => series.id === selectedSeriesId),
    [selectedSeriesId, seriesList],
  );
  const availableVolumes = useMemo(
    () => [...(selectedSeries?.blueprint?.volumes || [])]
      .filter((volume) => !volume.linkedNovelId)
      .sort((a, b) => a.volumeNumber - b.volumeNumber),
    [selectedSeries],
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'existing') {
      if (!selectedSeriesId) {
        toast.warning('편입할 시리즈를 선택해주세요.');
        return;
      }
      onConfirm({
        type: 'existing',
        seriesId: selectedSeriesId,
        seriesVolumeId: selectedVolumeId || undefined,
      });
    } else {
      if (!newSeriesTitle.trim() || !newSeriesPlot.trim()) {
        toast.warning('새 시리즈의 제목과 전체 줄거리를 입력해주세요.');
        return;
      }
      onConfirm({
        type: 'new',
        seriesTitle: newSeriesTitle,
        seriesPlot: newSeriesPlot,
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-lg relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-4 text-white">시리즈에 편입</h2>
        <p className="text-sm text-gray-400 mb-6">
          '{novel.title}'을(를) 시리즈의 일부로 만듭니다. 소설의 등장인물과
          세계관은 시리즈로 이전됩니다.
        </p>

        {/* 탭 */}
        <div className="mb-6 border-b border-gray-700">
          <div className="flex -mb-px">
            <button
              onClick={() => setMode('existing')}
              className={`px-4 py-3 font-semibold text-sm ${
                mode === 'existing'
                  ? 'text-white border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-white'
              }`}
              disabled={seriesList.length === 0}
            >
              기존 시리즈에 추가
            </button>
            <button
              onClick={() => setMode('new')}
              className={`px-4 py-3 font-semibold text-sm ${
                mode === 'new'
                  ? 'text-white border-b-2 border-indigo-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              새 시리즈로 만들기
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'existing' ? (
            <div>
              <label
                htmlFor="series-select"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                대상 시리즈
              </label>
              <select
                id="series-select"
                value={selectedSeriesId}
                onChange={(e) => {
                  setSelectedSeriesId(e.target.value);
                  setSelectedVolumeId('');
                }}
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
              >
                {seriesList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
              <label
                htmlFor="series-volume-select"
                className="block text-sm font-medium text-gray-300 mt-4 mb-1"
              >
                적용할 권 청사진
              </label>
              <select
                id="series-volume-select"
                value={selectedVolumeId}
                onChange={(e) => setSelectedVolumeId(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white"
              >
                <option value="">
                  {availableVolumes.length > 0 ? '첫 번째 미연결 계획에 자동 배치' : '새 권 계획을 만들어 배치'}
                </option>
                {availableVolumes.map((volume) => (
                  <option key={volume.id} value={volume.id}>
                    {volume.displayLabel || `${volume.volumeNumber}권`} · {volume.title || '제목 없음'}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                이미 작품이 연결된 권은 제외됩니다. 편입 후 시리즈 건축실이나 작품 설정에서 다시 바꿀 수 있습니다.
              </p>
            </div>
          ) : (
            <>
              <div>
                <label
                  htmlFor="new-series-title"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  새 시리즈 제목
                </label>
                <input
                  type="text"
                  id="new-series-title"
                  value={newSeriesTitle}
                  onChange={(e) => setNewSeriesTitle(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ClipboardDocumentListIcon className="w-5 h-5 text-indigo-400" />
                  <label
                    htmlFor="new-series-plot"
                    className="block text-sm font-medium text-gray-300"
                  >
                    총괄 설계도 (시리즈 전체)
                  </label>
                </div>
                <textarea
                  id="new-series-plot"
                  value={newSeriesPlot}
                  onChange={(e) => setNewSeriesPlot(e.target.value)}
                  rows={4}
                  className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
                  required
                />
                <p className="mt-1 text-xs text-gray-400">
                  이 소설을 포함할 시리즈 전체의 줄거리를 입력하세요.
                </p>
              </div>
            </>
          )}

          <div className="flex justify-end pt-4">
            <button
              type="button"
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-500 font-bold py-2 px-4 rounded-lg mr-2"
            >
              취소
            </button>
            <button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-700 font-bold py-2 px-4 rounded-lg"
            >
              편입하기
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

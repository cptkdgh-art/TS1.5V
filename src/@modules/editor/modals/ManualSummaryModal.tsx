/**
 * ============================================================
 * @module modules/editor/modals
 * @file ManualSummaryModal.tsx
 * ============================================================
 * @description 수동 문맥 요약 모달
 * ============================================================
 */

import { useState } from 'react';

interface ManualSummaryModalProps {
  chapters: { title: string; content: string }[];
  rawChapterCount: number;
  isSummarizing: boolean;
  onClose: () => void;
  onSubmit: (start: number, end: number) => void;
}

export function ManualSummaryModal({
  chapters,
  rawChapterCount,
  isSummarizing,
  onClose,
  onSubmit,
}: ManualSummaryModalProps) {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(chapters.length - 1);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-white">수동 문맥 요약</h3>
        <p className="text-gray-300 text-sm mb-2">다시 정리할 과거 회차를 선택하세요.</p>
        <p className="text-gray-400 text-xs mb-4">
          최근 {rawChapterCount}화는 AI가 원문으로 직접 읽으므로 여기서 제외됩니다. 선택하지 않은 구간의 기존 요약은 유지됩니다.
        </p>
        <div className="flex gap-4 mb-4 items-center text-white justify-center bg-gray-700 p-4 rounded-lg">
          <div className="text-center">
            <label className="block text-xs text-gray-400 mb-1">시작 화</label>
            <input
              type="number"
              min="1"
              max={chapters.length}
              className="bg-gray-800 border border-gray-600 p-2 rounded w-20 text-center"
              value={start + 1}
              onChange={e => {
                const value = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) setStart(Math.min(end, Math.max(0, value - 1)));
              }}
            />
          </div>
          <span className="text-gray-400 font-bold">~</span>
          <div className="text-center">
            <label className="block text-xs text-gray-400 mb-1">종료 화</label>
            <input
              type="number"
              min="1"
              max={chapters.length}
              className="bg-gray-800 border border-gray-600 p-2 rounded w-20 text-center"
              value={end + 1}
              onChange={e => {
                const value = Number.parseInt(e.target.value, 10);
                if (!Number.isNaN(value)) setEnd(Math.max(start, Math.min(chapters.length - 1, value - 1)));
              }}
            />
          </div>
        </div>

        {/* 팁 */}
        <div className="bg-indigo-900/30 p-3 rounded-md mb-4 border border-indigo-500/30">
          <h4 className="text-xs font-bold text-indigo-300 mb-1">처리 방식</h4>
          <p className="text-xs text-gray-400">
            선택한 회차만 새로 요약합니다. 앞쪽 기억이 비어 있으면 이야기 누락을 막기 위해 그 구간도 한 번만 함께 채웁니다.
          </p>
          {chapters.length >= 20 && (
            <button
              onClick={() => { setStart(Math.max(0, chapters.length - 20)); setEnd(chapters.length - 1); }}
              className="mt-2 w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white py-1 rounded font-semibold"
            >
              최근 20화 자동 선택
            </button>
          )}
        </div>

        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold">취소</button>
          <button onClick={() => onSubmit(start, end)} disabled={isSummarizing} className="bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-bold">
            {isSummarizing ? '요약 중...' : '요약 실행'}
          </button>
        </div>
      </div>
    </div>
  );
}

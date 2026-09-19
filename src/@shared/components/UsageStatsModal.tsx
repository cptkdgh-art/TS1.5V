/**
 * ============================================================
 * @module shared/components
 * @file UsageStatsModal.tsx
 * ============================================================
 * @description AI 사용 통계 모달
 * ============================================================
 */

import { useEffect, useState } from 'react';
import {
  getUsageHistory,
  type UsageHistory,
  type DailyUsageLog,
} from '@services/costEstimator';
import { XMarkIcon, ChartBarIcon, TrashIcon } from './Icons';

interface UsageStatsModalProps {
  onClose: () => void;
}

export function UsageStatsModal({ onClose }: UsageStatsModalProps) {
  const [history, setHistory] = useState<UsageHistory>({});

  useEffect(() => {
    setHistory(getUsageHistory());
    const refresh = () => setHistory(getUsageHistory());
    window.addEventListener('usageUpdated', refresh);
    return () => window.removeEventListener('usageUpdated', refresh);
  }, []);

  const sortedDates = Object.keys(history).sort((a, b) => b.localeCompare(a));
  const totalCostAllTime = (Object.values(history) as DailyUsageLog[]).reduce(
    (sum: number, log) => sum + log.totalCost,
    0
  );

  const handleClearHistory = () => {
    if (
      confirm(
        '모든 사용 기록을 삭제하시겠습니까? (실제 구글 청구 내역에는 영향이 없습니다)'
      )
    ) {
      localStorage.removeItem('ai_novelist_usage_history_v1');
      setHistory({});
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 font-sans">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        <header className="flex items-center justify-between p-5 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ChartBarIcon className="w-6 h-6 text-teal-400" />
            AI 비용 추산 (Cost Estimator)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </header>

        <div className="p-6 bg-gray-900 flex justify-between items-center shrink-0">
          <div>
            <p className="text-sm text-gray-400">누적 총 추산 비용</p>
            <p className="text-3xl font-bold text-white">
              ₩ {Math.floor(totalCostAllTime).toLocaleString()}
            </p>
          </div>
          <div className="text-right text-xs text-gray-500">
            <p>
              * 토큰은 API 응답값을 우선 사용합니다.
            </p>
            <p>* 원화 금액은 환율을 적용한 예상치이며 실제 청구액과 다를 수 있습니다.</p>
            <p>* 환율 기준: 1$ = 1,450원</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {sortedDates.length > 0 ? (
            sortedDates.map((date) => {
              const log = history[date] as DailyUsageLog;
              return (
                <div
                  key={date}
                  className="bg-gray-700 rounded-lg p-4 border border-gray-600"
                >
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-bold text-lg text-white">{date}</h3>
                    <span className="text-teal-300 font-bold text-lg">
                      ₩ {Math.floor(log.totalCost).toLocaleString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm text-gray-300 mb-3">
                    <div className="bg-gray-800 p-2 rounded">
                      <span className="block text-xs text-gray-500">
                        입력 (Input)
                      </span>
                      {log.inputChars.toLocaleString()} 자
                    </div>
                    <div className="bg-gray-800 p-2 rounded">
                      <span className="block text-xs text-gray-500">
                        출력 (Output)
                      </span>
                      {log.outputChars.toLocaleString()} 자
                    </div>
                  </div>
                  {(log.inputTokens || log.outputTokens || log.thinkingTokens) ? (
                    <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300 sm:grid-cols-4">
                      <span>입력 {(log.inputTokens || 0).toLocaleString()}</span>
                      <span className="text-teal-300">캐시 {(log.cachedInputTokens || 0).toLocaleString()}</span>
                      <span>본문 {(log.outputTokens || 0).toLocaleString()}</span>
                      <span>사고 {(log.thinkingTokens || 0).toLocaleString()}</span>
                    </div>
                  ) : null}
                  {((log.measuredCalls || 0) > 0 || (log.estimatedCalls || 0) > 0) && (
                    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                      <span>API 실측 {log.measuredCalls || 0}회</span>
                      <span>추정 {log.estimatedCalls || 0}회</span>
                      {(log.cacheSavings || 0) > 0 && (
                        <span className="text-teal-300">캐시 절감 약 ₩ {Math.floor(log.cacheSavings || 0).toLocaleString()}</span>
                      )}
                    </div>
                  )}
                  {log.imageCount > 0 && (
                    <div className="text-xs text-purple-300 mb-3">
                      이미지 생성: {log.imageCount}장
                    </div>
                  )}
                  <div className="border-t border-gray-600 pt-2">
                    <p className="text-xs text-gray-500 mb-1">모델별 비용:</p>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(log.modelBreakdown).map(([model, cost]) => (
                        <span
                          key={model}
                          className="text-xs bg-gray-600 px-2 py-1 rounded text-gray-300"
                        >
                          {model.replace('gemini-', '')}: ₩
                          {Math.floor(cost).toLocaleString()}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-10 text-gray-500">
              <p>아직 기록된 사용 내역이 없습니다.</p>
            </div>
          )}
        </div>

        <footer className="p-4 border-t border-gray-700 flex justify-between items-center bg-gray-800 rounded-b-lg">
          <button
            onClick={handleClearHistory}
            className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <TrashIcon className="w-4 h-4" /> 기록 초기화
          </button>
          <button
            onClick={onClose}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-6 rounded-lg"
          >
            닫기
          </button>
        </footer>
      </div>
    </div>
  );
}

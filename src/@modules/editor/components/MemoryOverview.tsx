import type { ContextManagement } from '@core/types';
import { FIXED_RECENT_RAW_CHAPTERS } from '@core/constants';
import type { MemoryHealthReport } from '@services/ai';
import { ArrowPathIcon, ChartBarIcon, Cog6ToothIcon, PlayIcon } from '@shared/components';

interface MemoryOverviewProps {
  report: MemoryHealthReport;
  contextManagement: ContextManagement;
  isBusy: boolean;
  syncMessage: string;
  onSettingChange: (field: keyof ContextManagement, value: number | boolean) => void;
  onSync: () => void;
}

export function MemoryOverview({
  report,
  contextManagement,
  isBusy,
  syncMessage,
  onSettingChange,
  onSync,
}: MemoryOverviewProps) {
  const healthMeta = {
    disabled: { label: '자동 기억 꺼짐', tone: 'text-gray-300 bg-gray-700' },
    empty: { label: '원고 대기', tone: 'text-gray-300 bg-gray-700' },
    healthy: { label: '기억 정상', tone: 'text-green-300 bg-green-900/60' },
    update: { label: '증분 갱신 가능', tone: 'text-blue-300 bg-blue-900/60' },
    rebuild: { label: '변경 구간 보수 필요', tone: 'text-yellow-300 bg-yellow-900/60' },
  }[report.status];

  return (
    <section className="bg-gray-800 border border-teal-700/40 p-5 rounded-lg shadow-lg" aria-labelledby="memory-map-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 id="memory-map-title" className="font-bold text-white flex items-center gap-2 text-lg">
            <ChartBarIcon className="w-5 h-5 text-teal-400" />
            전 화 기억 지도
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            과거 화는 압축 요약으로, 최근 화는 원문으로 전달해 전체 연재 흐름을 보호합니다.
          </p>
        </div>
        <span className={`self-start text-xs font-bold px-2.5 py-1 rounded ${healthMeta.tone}`}>
          {healthMeta.label}
        </span>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-gray-400">AI 전달 범위</span>
          <span className="font-mono text-white">{report.protectedChapterCount}/{report.totalChapters}화 · {report.coveragePercent}%</span>
        </div>
        <div className="h-2 bg-gray-900 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${report.status === 'rebuild' ? 'bg-yellow-500' : 'bg-teal-500'}`}
            style={{ width: `${report.coveragePercent}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 mt-4 border-y border-gray-700 divide-x divide-gray-700">
        <div className="py-3 px-2 first:pl-0">
          <p className="text-[11px] text-gray-500">과거 요약</p>
          <p className="text-sm font-bold text-teal-300 mt-0.5">{report.validArchiveCount}/{report.archiveTargetCount}화</p>
        </div>
        <div className="py-3 px-3">
          <p className="text-[11px] text-gray-500">최근 원문</p>
          <p className="text-sm font-bold text-white mt-0.5">{report.recentRawCount}화</p>
        </div>
        <div className="py-3 px-3">
          <p className="text-[11px] text-gray-500">변경·삭제 감지</p>
          <p className={`text-sm font-bold mt-0.5 ${report.staleEntryCount + report.deletedEntryCount > 0 ? 'text-yellow-300' : 'text-gray-300'}`}>
            {report.staleEntryCount + report.deletedEntryCount}화
          </p>
        </div>
        <div className="py-3 px-3 pr-0">
          <p className="text-[11px] text-gray-500">활성 캐시</p>
          <p className="text-sm font-bold text-indigo-300 mt-0.5">{report.activeCacheCount}개</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        <span className="px-2 py-1 bg-teal-900/30 text-teal-300 border border-teal-800/50 rounded">{report.archiveRangeLabel}</span>
        {report.missingSummaryCount > 0 && (
          <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 border border-yellow-800/50 rounded">{report.pendingArchiveRangeLabel}</span>
        )}
        <span className="px-2 py-1 bg-gray-900 text-gray-300 border border-gray-700 rounded">{report.latestRawRangeLabel}</span>
        {report.missingSummaryCount > 0 && (
          <span className="px-2 py-1 bg-yellow-900/30 text-yellow-300 border border-yellow-800/50 rounded">미반영 {report.missingSummaryCount}화</span>
        )}
      </div>

      <div className={`mt-4 border-l-4 px-4 py-3 ${contextManagement.isEnabled ? 'border-teal-500 bg-teal-950/30' : 'border-gray-600 bg-gray-900/50'}`}>
        {contextManagement.isEnabled ? (
          <div className="space-y-1.5 text-sm">
            <p className="font-semibold text-white">
              현재 {report.totalChapters}화 · 다음 자동 요약은 {report.nextAutoSyncChapter}화 저장 시
            </p>
            <p className="text-teal-200">{report.nextSummaryRangeLabel}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <span className={report.nextSaveWillTrigger ? 'font-semibold text-lime-300' : 'text-gray-300'}>
                {report.nextAutoSyncIn === 0
                  ? '현재 저장분: 자동 요약 실행 대상'
                  : `다음 화 저장: ${report.nextSaveWillTrigger ? '자동 요약 실행 턴' : '일반 저장 · 요약 호출 없음'}`}
              </span>
              <span className="text-gray-400">
                요약 대기 누적 {report.pendingSummaryCount}/{contextManagement.summaryTriggerChapters}화
              </span>
            </div>
            <p className="text-xs leading-relaxed text-gray-400">
              완료된 요약은 아래 [2계층] 장기기억에 화별로 저장되고, 다음 집필부터 과거 줄거리 기억으로 전달됩니다.
              요약 전 화들은 빠지지 않고 원문으로 전달됩니다.
            </p>
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            <p className="font-semibold text-gray-200">자동 요약 꺼짐</p>
            <p className="text-xs leading-relaxed text-gray-400">
              챕터를 저장해도 요약 API를 자동 호출하지 않습니다. 기존 요약은 유지되며 스마트 동기화만 수동으로 실행됩니다.
            </p>
          </div>
        )}
      </div>

      <div className="mt-5 pt-4 border-t border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <Cog6ToothIcon className="w-4 h-4 text-gray-400" />
          <h4 className="text-sm font-bold text-gray-200">자동 기억 설정</h4>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div className="text-xs text-gray-400">
            최근 원문 고정 기억
            <div className="mt-1 rounded border border-teal-700/60 bg-teal-950/30 px-2.5 py-2 text-sm font-semibold text-teal-200">
              최근 {FIXED_RECENT_RAW_CHAPTERS}화 원문 전체
            </div>
          </div>
          <label className="text-xs text-gray-400">
            자동 요약 주기
            <select
              value={contextManagement.summaryTriggerChapters}
              onChange={(event) => onSettingChange('summaryTriggerChapters', Number(event.target.value))}
              className="mt-1 w-full bg-gray-900 border border-gray-600 rounded px-2.5 py-2 text-sm text-white"
            >
              {Array.from({ length: 20 }, (_, index) => index + 1).map((count) => (
                <option key={count} value={count}>
                  {count}화 누적 시{count === 5 ? ' (균형)' : count === 10 ? ' (호출 절약)' : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={onSync}
            disabled={isBusy || report.totalChapters === 0}
            className="h-10 px-4 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-bold rounded flex items-center justify-center gap-2 transition-colors"
          >
            {isBusy ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PlayIcon className="w-4 h-4" />}
            스마트 동기화
          </button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold text-gray-200 cursor-pointer">
            <input
              type="checkbox"
              checked={contextManagement.isEnabled}
              onChange={(event) => onSettingChange('isEnabled', event.target.checked)}
              className="accent-teal-500"
            />
            챕터 저장 후 자동 요약 API 호출
          </label>
          <span className="text-xs text-gray-500">
            {!contextManagement.isEnabled
              ? 'OFF · 자동 토큰 사용 없음'
              : report.nextAutoSyncIn === 0
                ? '현재 저장분 요약 대상 · 스마트 동기화 가능'
                : `${report.nextAutoSyncIn}화 뒤 자동 갱신 · ${report.nextSummaryRangeLabel}`}
          </span>
        </div>
        {syncMessage && <p className="mt-3 text-xs text-teal-300" role="status">{syncMessage}</p>}
      </div>
    </section>
  );
}

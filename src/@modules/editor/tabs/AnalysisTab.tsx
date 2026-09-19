/**
 * ============================================================
 * @module modules/editor/tabs
 * @file AnalysisTab.tsx
 * ============================================================
 * @description 분석 탭 - 소설 구조 분석 및 작가 상담 기록
 * ============================================================
 */

import { useState, useMemo } from 'react';
import type { Novel, GenerationLog } from '@core/types';
import {
  ChartBarIcon,
  ArchiveBoxIcon,
  TrashIcon,
} from '@shared/components';

interface AnalysisTabProps {
  novel: Novel;
  onUpdateNovel: (updatedNovel: Novel) => void;
  isAnalyzing: boolean;
  requestConfirmation: (title: string, message: React.ReactNode, confirmText: string, onConfirm: () => void) => void;
  onAnalyze: () => void;
}

function AuthorConsultationArchive({
  novel,
  onUpdateNovel,
  requestConfirmation,
}: {
  novel: Novel;
  onUpdateNovel: (updatedNovel: Novel) => void;
  requestConfirmation: AnalysisTabProps['requestConfirmation'];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [openChapterIndex, setOpenChapterIndex] = useState<number | null>(null);

  const chaptersWithFeedback = useMemo(() => {
    return novel.chapters
      .map((chapter, index) => ({ ...chapter, originalIndex: index }))
      .filter(chapter => chapter.feedbackChat && chapter.feedbackChat.length > 0)
      .filter(chapter => {
        if (!searchTerm.trim()) return true;
        const lowerSearchTerm = searchTerm.toLowerCase();
        return chapter.feedbackChat?.some(msg =>
          (msg.parts?.[0]?.text as string)?.toLowerCase().includes(lowerSearchTerm)
        );
      })
      .sort((a, b) => b.originalIndex - a.originalIndex);
  }, [novel.chapters, searchTerm]);

  const handleDeleteRecord = (chapterIndex: number) => {
    requestConfirmation(
      '상담 기록 삭제',
      <p>'{novel.chapters[chapterIndex].title}' 챕터의 상담 기록을 삭제하시겠습니까?</p>,
      '삭제',
      () => {
      const updatedChapters = [...novel.chapters];
      updatedChapters[chapterIndex] = { ...updatedChapters[chapterIndex], feedbackChat: undefined };
      onUpdateNovel({ ...novel, chapters: updatedChapters });
      }
    );
  };

  return (
    <div className="bg-gray-700 p-4 rounded-lg">
      <h3 className="font-semibold mb-3 text-indigo-400 text-lg flex items-center gap-2">
        <ArchiveBoxIcon className="w-5 h-5" />
        작가 상담 기록 보관소
      </h3>
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="상담 내용 검색..."
        className="w-full bg-gray-800 p-2 rounded-md mb-4 text-sm text-white focus:ring-indigo-500 focus:border-indigo-500"
      />
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {chaptersWithFeedback.length > 0 ? chaptersWithFeedback.map(chapter => (
          <div key={chapter.originalIndex}>
            <div className="bg-gray-600 p-3 rounded-md flex justify-between items-center">
              <button onClick={() => setOpenChapterIndex(openChapterIndex === chapter.originalIndex ? null : chapter.originalIndex)} className="text-left flex-grow">
                <p className="font-semibold text-gray-200">{chapter.title}</p>
                <p className="text-xs text-gray-400">{chapter.feedbackChat?.length}개의 메시지</p>
              </button>
              <button onClick={() => handleDeleteRecord(chapter.originalIndex)} className="p-1 text-gray-400 hover:text-red-400 ml-2" title="이 기록 삭제">
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
            {openChapterIndex === chapter.originalIndex && (
              <div className="p-4 bg-gray-800 mt-1 rounded-b-md space-y-3 text-sm">
                {chapter.feedbackChat?.map((msg, idx) => (
                  <div key={idx}>
                    <p className={`font-semibold ${msg.role === 'user' ? 'text-indigo-300' : 'text-teal-300'}`}>
                      {msg.role === 'user' ? '당신:' : '작가:'}
                    </p>
                    <p className="text-gray-300 whitespace-pre-wrap">{msg.parts?.[0]?.text as string}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )) : (
          <p className="text-center text-gray-500 py-4">저장된 상담 기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

const formatGenerationDuration = (milliseconds: number) => (
  milliseconds < 1000
    ? `${Math.round(milliseconds)}ms`
    : `${(milliseconds / 1000).toFixed(milliseconds < 10000 ? 1 : 0)}초`
);

const CACHE_STATUS_LABEL = {
  disabled: '캐시 미사용',
  hit: '캐시 적중',
  created: '캐시 새로 생성',
  skipped: '캐시 조건 미충족',
} as const;

function GenerationLogArchive({
  novel,
  onUpdateNovel,
  requestConfirmation,
}: {
  novel: Novel;
  onUpdateNovel: (updatedNovel: Novel) => void;
  requestConfirmation: AnalysisTabProps['requestConfirmation'];
}) {
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'success' | 'error'>('all');

  const groupedLogs = useMemo(() => {
    const groups: { [sessionId: string]: GenerationLog[] } = {};
    [...(novel.generationLogs || [])].forEach(log => {
      if (!groups[log.sessionId]) groups[log.sessionId] = [];
      groups[log.sessionId].push(log);
    });

    return Object.values(groups)
      .map(sessionLogs => {
        sessionLogs.sort((a, b) => a.attemptNumber - b.attemptNumber);
        const finalAttempt = sessionLogs[sessionLogs.length - 1];
        return {
          sessionId: finalAttempt.sessionId,
          timestamp: finalAttempt.timestamp,
          finalStatus: finalAttempt.status,
          prompt: finalAttempt.prompt,
          authorName: finalAttempt.authorName,
          attempts: sessionLogs
        };
      })
      .filter(session => filter === 'all' || session.finalStatus === filter)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [novel.generationLogs, filter]);

  const modelLatencySummary = useMemo(() => {
    const models = new Map<string, {
      successCount: number;
      failureCount: number;
      firstTokenTotalMs: number;
      firstTokenCount: number;
      totalDurationMs: number;
      blockCount: number;
      blockReasons: Record<string, number>;
    }>();

    for (const log of novel.generationLogs || []) {
      if (!log.model || !log.timing) continue;
      const current = models.get(log.model) || {
        successCount: 0,
        failureCount: 0,
        firstTokenTotalMs: 0,
        firstTokenCount: 0,
        totalDurationMs: 0,
        blockCount: 0,
        blockReasons: {},
      };
      if (log.status === 'success') {
        current.successCount += 1;
        current.totalDurationMs += log.timing.totalMs;
        if (log.timing.firstTokenMs !== undefined) {
          current.firstTokenTotalMs += log.timing.firstTokenMs;
          current.firstTokenCount += 1;
        }
      } else {
        current.failureCount += 1;
      }
      if (log.termination) {
        const reason = log.termination.promptBlockReason || log.termination.finishReason || 'UNKNOWN';
        current.blockCount += 1;
        current.blockReasons[reason] = (current.blockReasons[reason] || 0) + 1;
      }
      models.set(log.model, current);
    }

    return Array.from(models.entries())
      .map(([model, metrics]) => ({ model, ...metrics }))
      .sort((a, b) => a.model.localeCompare(b.model));
  }, [novel.generationLogs]);

  const handleDeleteSession = (sessionId: string) => {
    requestConfirmation(
      '집필 기록 삭제',
      <p>이 사건 파일의 모든 기록을 삭제하시겠습니까?</p>,
      '삭제',
      () => {
      const updatedLogs = (novel.generationLogs || []).filter(log => log.sessionId !== sessionId);
      onUpdateNovel({ ...novel, generationLogs: updatedLogs });
      }
    );
  };

  const handleDeleteAllLogs = () => {
    requestConfirmation(
      '전체 집필 기록 삭제',
      <p>모든 집필 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.</p>,
      '전체 삭제',
      () => onUpdateNovel({ ...novel, generationLogs: [] })
    );
  };

  return (
    <div className="bg-gray-700 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-semibold text-indigo-400 text-lg flex items-center gap-2">
          <ArchiveBoxIcon className="w-5 h-5" />
          AI 집필 기록 보관소 (블랙박스)
        </h3>
        <button onClick={handleDeleteAllLogs} className="text-sm text-gray-400 hover:text-red-400">전체 삭제</button>
      </div>
      <div className="flex gap-2 mb-4">
        {(['all', 'success', 'error'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1 text-xs rounded-full font-semibold ${filter === f ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'}`}
          >
            {f === 'all' ? '전체' : f === 'success' ? '성공' : '오류'}
          </button>
        ))}
      </div>
      {modelLatencySummary.length > 0 && (
        <div className="mb-4">
          <p className="mb-2 text-xs font-semibold text-gray-400">모델별 지연 비교</p>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {modelLatencySummary.map((item) => (
              <div key={item.model} className="rounded-md border border-gray-600 bg-gray-800 p-2 text-xs">
                <p className="truncate font-semibold text-indigo-300" title={item.model}>{item.model}</p>
                <div className="mt-1 grid grid-cols-2 gap-1 text-gray-400">
                  <span>첫 글자 평균</span>
                  <strong className="text-right text-amber-300">
                    {item.firstTokenCount > 0 ? formatGenerationDuration(item.firstTokenTotalMs / item.firstTokenCount) : '-'}
                  </strong>
                  <span>전체 평균</span>
                  <strong className="text-right text-cyan-300">
                    {item.successCount > 0 ? formatGenerationDuration(item.totalDurationMs / item.successCount) : '-'}
                  </strong>
                </div>
                <p className="mt-1 text-gray-500">성공 {item.successCount}회{item.failureCount > 0 ? ` · 실패 ${item.failureCount}회` : ''}</p>
                {item.blockCount > 0 && (
                  <p className="mt-1 text-red-300">
                    정책 중단 {item.blockCount}회 · {Object.entries(item.blockReasons).map(([reason, count]) => `${reason} ${count}`).join(' / ')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
        {groupedLogs.length > 0 ? groupedLogs.map(session => (
          <div key={session.sessionId}>
            <div
              className={`p-3 rounded-md flex justify-between items-center cursor-pointer ${session.finalStatus === 'error' ? 'bg-red-900/50 hover:bg-red-900/70' : 'bg-gray-600 hover:bg-gray-500'}`}
              onClick={() => setOpenSessionId(openSessionId === session.sessionId ? null : session.sessionId)}
            >
              <div className="flex-grow">
                <p className={`font-semibold ${session.finalStatus === 'error' ? 'text-red-300' : 'text-gray-200'}`}>
                  {new Date(session.timestamp).toLocaleString()} - by {session.authorName}
                </p>
                <p className="text-xs text-gray-400 truncate">{session.prompt}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${session.finalStatus === 'error' ? 'bg-red-500/30 text-red-200' : 'bg-green-500/30 text-green-200'}`}>
                  {session.attempts.length}회 시도
                </span>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session.sessionId); }} className="p-1 text-gray-400 hover:text-red-400 ml-2" title="이 사건 파일 삭제">
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
            {openSessionId === session.sessionId && (
              <div className="p-4 bg-gray-800 mt-1 rounded-b-md space-y-4 text-sm">
                {session.attempts.map(log => (
                  <div key={log.id} className={`p-3 rounded-md border ${log.status === 'error' ? 'border-red-700/50' : 'border-gray-700'}`}>
                    <h4 className={`font-semibold ${log.status === 'error' ? 'text-red-300' : 'text-green-300'}`}>
                      시도 {log.attemptNumber}/{log.maxAttempts}: {log.status === 'success' ? '성공' : '실패'}
                      {log.model ? ` · ${log.model}` : ''}
                      {log.batchChapterCount && log.batchChapterCount > 1 ? ` · 연속 ${log.batchChapterIndex}/${log.batchChapterCount}화` : ''}
                      {log.continuationPass && log.continuationPass > 1 ? ` · 같은 화 ${log.continuationPass}차` : ''}
                    </h4>
                    {log.status === 'success' && log.outputCharacters !== undefined && (
                      <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-gray-900/70 p-2 text-xs">
                        <span className="text-gray-400">목표 <strong className="text-teal-300">{(log.targetCharacters ?? 6000).toLocaleString()}자</strong></span>
                        <span className="text-gray-400">실제 <strong className="text-green-300">{log.outputCharacters.toLocaleString()}자</strong></span>
                        {log.timing && (
                          <>
                            <span className="text-gray-400">첫 글자 <strong className="text-amber-300">{log.timing.firstTokenMs === undefined ? '측정 안 됨' : formatGenerationDuration(log.timing.firstTokenMs)}</strong></span>
                            <span className="text-gray-400">전체 <strong className="text-cyan-300">{formatGenerationDuration(log.timing.totalMs)}</strong></span>
                            <span className="col-span-2 text-gray-500">
                              준비 {formatGenerationDuration(log.timing.preparationMs)} · 캐시 {formatGenerationDuration(log.timing.cachePreparationMs)} ({CACHE_STATUS_LABEL[log.timing.cacheStatus]})
                              {log.timing.modelFirstTokenMs === undefined ? '' : ` · 모델 응답 ${formatGenerationDuration(log.timing.modelFirstTokenMs)}`}
                            </span>
                          </>
                        )}
                        {log.usage && (
                          <>
                            <span className="text-gray-400">입력 <strong className="text-blue-300">{log.usage.inputTokens.toLocaleString()}토큰</strong></span>
                            <span className="text-gray-400">출력 <strong className="text-violet-300">{(log.usage.outputTokens + log.usage.thinkingTokens).toLocaleString()}토큰</strong></span>
                            <span className="col-span-2 text-gray-500">
                              {log.usage.measured ? 'API 실측' : '글자 수 기반 추정'}
                              {log.usage.cachedInputTokens > 0 ? ` · 캐시 적중 ${log.usage.cachedInputTokens.toLocaleString()}토큰` : ''}
                              {log.usage.thinkingTokens > 0 ? ` · 사고 ${log.usage.thinkingTokens.toLocaleString()}토큰` : ''}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                    {log.status === 'error' && log.error && (
                      <div className="mt-2">
                        <p className="font-semibold text-gray-400">오류:</p>
                        <p className="text-red-300 text-xs">{log.error}</p>
                        {log.termination && (
                          <p className="mt-1 text-xs text-amber-300">
                            차단 진단: {log.termination.promptBlockReason ? `입력 ${log.termination.promptBlockReason}` : `응답 ${log.termination.finishReason || 'UNKNOWN'}`}
                          </p>
                        )}
                        {log.timing && (
                          <p className="mt-1 text-xs text-gray-500">
                            실패까지 {formatGenerationDuration(log.timing.totalMs)}
                            {log.timing.firstTokenMs === undefined ? ' · 본문 수신 전 실패' : ` · 첫 글자 ${formatGenerationDuration(log.timing.firstTokenMs)}`}
                            {` · 캐시 ${formatGenerationDuration(log.timing.cachePreparationMs)}`}
                          </p>
                        )}
                      </div>
                    )}
                    <div className="mt-2">
                      <p className="font-semibold text-gray-400">생성된 내용:</p>
                      <p className="text-gray-300 whitespace-pre-wrap bg-gray-900 p-2 rounded-md mt-1 text-xs max-h-40 overflow-y-auto">{log.content || '[내용 없음]'}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )) : (
          <p className="text-center text-gray-500 py-4">저장된 집필 기록이 없습니다.</p>
        )}
      </div>
    </div>
  );
}

export function AnalysisTab({
  novel,
  onUpdateNovel,
  isAnalyzing,
  requestConfirmation,
  onAnalyze,
}: AnalysisTabProps) {
  const onClickAnalyze = () => {
    requestConfirmation(
      '소설 전체 분석 확인',
      <p>소설의 전체 내용을 AI에게 보내 인물 관계도와 핵심 사건 타임라인을 분석합니다.</p>,
      '분석 시작',
      onAnalyze
    );
  };

  return (
    <div className="font-sans space-y-8 max-w-4xl mx-auto">
      <div className="space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-2xl font-bold mb-2">소설 구조 분석</h2>
            <p className="text-gray-400">AI가 소설의 전체 구조를 분석하여 관계도와 타임라인을 제공합니다.</p>
          </div>
          <button
            onClick={onClickAnalyze}
            disabled={isAnalyzing}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:bg-gray-700 disabled:cursor-wait whitespace-nowrap"
          >
            {isAnalyzing ? '분석 중...' : (novel.analysis ? '다시 분석하기' : '소설 전체 분석하기')}
          </button>
        </div>

        {isAnalyzing ? (
          <div className="text-center py-10">
            <ChartBarIcon className="w-12 h-12 mx-auto text-indigo-400 animate-pulse" />
            <p className="mt-4 text-gray-400">AI가 소설 전체를 읽고 분석하고 있습니다. 잠시만 기다려주세요...</p>
          </div>
        ) : novel.analysis ? (
          <div className="space-y-6">
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 text-indigo-400 text-lg">주요 인물 관계도 (요약)</h3>
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {novel.analysis.relationships}
              </div>
            </div>
            <div className="bg-gray-700 p-4 rounded-lg">
              <h3 className="font-semibold mb-3 text-indigo-400 text-lg">핵심 사건 타임라인 (요약)</h3>
              <div className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">
                {novel.analysis.timeline}
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 border-2 border-dashed border-gray-700 rounded-lg">
            <ChartBarIcon className="w-12 h-12 mx-auto text-gray-600" />
            <p className="mt-4 text-gray-500">아직 분석된 데이터가 없습니다. 버튼을 눌러 분석을 시작하세요.</p>
          </div>
        )}
      </div>

      <div className="border-t border-gray-600 pt-8 mt-8">
        <GenerationLogArchive novel={novel} onUpdateNovel={onUpdateNovel} requestConfirmation={requestConfirmation} />
      </div>

      <div className="border-t border-gray-600 pt-8 mt-8">
        <AuthorConsultationArchive novel={novel} onUpdateNovel={onUpdateNovel} requestConfirmation={requestConfirmation} />
      </div>
    </div>
  );
}

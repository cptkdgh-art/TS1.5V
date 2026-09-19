/**
 * ============================================================
 * @module modules/editor/modals
 * @file TreatmentModal.tsx
 * ============================================================
 * @description 트리트먼트 모달 - 총괄설계도 v2 (에피소드별 상세 설계)
 * ============================================================
 */

import { useState } from 'react';
import type { Novel, Series, Treatment } from '@core/types';
import { generateTreatment } from '@services/ai';
import { XMarkIcon, WandSparklesIcon, toast } from '@shared/components';

interface TreatmentModalProps {
  novel: Novel;
  series: Series | null;
  onClose: () => void;
  onSave: (treatment: Treatment) => void;
}

export function TreatmentModal({
  novel,
  series,
  onClose,
  onSave,
}: TreatmentModalProps) {
  const [episodeCount, setEpisodeCount] = useState(10);
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState<Treatment | null>(novel.treatment || null);
  const [expandedEpisode, setExpandedEpisode] = useState<number | null>(null);

  const handleGenerate = async () => {
    const plotSummary = series ? series.seriesPlotSummary : novel.plotSummary;
    if (!plotSummary?.trim()) {
      toast.warning('먼저 설계도(줄거리)를 입력해주세요.');
      return;
    }

    setIsGenerating(true);
    try {
      const worldviewFiles = series?.worldviewFiles ?? novel.worldviewFiles ?? [];
      const worldviewSummary = worldviewFiles.map(f => `[${f.filename}]\n${f.content}`).join('\n\n');

      const characters = series?.characters ?? novel.characters ?? [];
      const charactersSummary = characters.map(c =>
        `[${c.name}] ${c.personality} | 배경: ${c.background}`
      ).join('\n');

      const treatment = await generateTreatment({
        plotSummary,
        title: novel.title,
        subject: novel.subject,
        mood: novel.mood,
        worldviewSummary,
        charactersSummary,
        episodeCount,
      });

      setResult(treatment);
      toast.success('트리트먼트가 생성되었습니다!');
    } catch (error) {
      toast.error('트리트먼트 생성 실패: ' + (error as Error).message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl relative max-h-[90vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex items-center justify-between p-6 pb-4 border-b border-gray-700">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <WandSparklesIcon className="w-6 h-6 text-purple-400" />
            트리트먼트 (총괄설계도)
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* 설정 바 */}
        <div className="px-6 py-3 bg-gray-750 border-b border-gray-700 flex items-center gap-4">
          <label className="text-sm text-gray-300">에피소드 수:</label>
          <input
            type="number"
            min={3}
            max={30}
            value={episodeCount}
            onChange={(e) => setEpisodeCount(Math.max(3, Math.min(30, parseInt(e.target.value) || 10)))}
            className="w-20 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-white text-sm"
          />
          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="ml-auto bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-5 rounded-lg text-sm transition-colors disabled:bg-gray-600 flex items-center gap-2"
          >
            <WandSparklesIcon className="w-4 h-4" />
            {isGenerating ? '생성 중...' : result ? '재생성' : '트리트먼트 생성'}
          </button>
        </div>

        {/* 결과 */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {!result && !isGenerating && (
            <div className="text-center text-gray-500 py-12">
              <p className="text-lg mb-2">세계관 + 설계도를 기반으로</p>
              <p className="text-lg">에피소드별 상세 트리트먼트를 생성합니다.</p>
              <p className="text-sm mt-4 text-gray-600">세계관, 등장인물, 장르 정보가 있으면 더 정확합니다.</p>
            </div>
          )}

          {isGenerating && (
            <div className="text-center text-purple-400 py-12 animate-pulse">
              트리트먼트를 설계하고 있습니다...
            </div>
          )}

          {result && !isGenerating && (
            <>
              {/* 개요 섹션 */}
              <div className="space-y-3">
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-purple-400 uppercase mb-1">로그라인</h3>
                  <p className="text-white text-sm">{result.premise}</p>
                </div>
                <div className="bg-gray-900 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-purple-400 uppercase mb-1">시놉시스</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{result.synopsis}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-purple-400 uppercase mb-1">톤/무드</h3>
                    <p className="text-gray-300 text-sm">{result.tone}</p>
                  </div>
                  <div className="bg-gray-900 rounded-lg p-4">
                    <h3 className="text-xs font-semibold text-purple-400 uppercase mb-1">장르 전략</h3>
                    <p className="text-gray-300 text-sm">{result.genreStrategy}</p>
                  </div>
                </div>
              </div>

              {/* 에피소드 리스트 */}
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-400 mb-3">
                  에피소드 구조 ({result.episodes.length}화)
                </h3>
                <div className="space-y-2">
                  {result.episodes.map((ep) => (
                    <div
                      key={ep.episodeNumber}
                      className="bg-gray-900 rounded-lg overflow-hidden"
                    >
                      {/* 에피소드 헤더 */}
                      <button
                        onClick={() => setExpandedEpisode(
                          expandedEpisode === ep.episodeNumber ? null : ep.episodeNumber
                        )}
                        className="w-full flex items-center justify-between p-3 hover:bg-gray-800 transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-purple-400 font-mono text-sm font-bold w-8">
                            {String(ep.episodeNumber).padStart(2, '0')}
                          </span>
                          <span className="text-white text-sm font-semibold">{ep.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{ep.emotion}</span>
                          <span className="text-gray-500 text-xs">
                            {expandedEpisode === ep.episodeNumber ? '▲' : '▼'}
                          </span>
                        </div>
                      </button>

                      {/* 에피소드 상세 (펼쳤을 때) */}
                      {expandedEpisode === ep.episodeNumber && (
                        <div className="px-4 pb-4 space-y-3 border-t border-gray-800">
                          <div className="pt-3">
                            <span className="text-xs text-teal-400 font-semibold">목표</span>
                            <p className="text-gray-300 text-sm mt-1">{ep.goal}</p>
                          </div>
                          <div>
                            <span className="text-xs text-teal-400 font-semibold">주요 장면</span>
                            <p className="text-gray-300 text-sm mt-1 whitespace-pre-wrap">{ep.scenes}</p>
                          </div>
                          {ep.characters.length > 0 && (
                            <div>
                              <span className="text-xs text-teal-400 font-semibold">등장인물</span>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {ep.characters.map((name, i) => (
                                  <span key={i} className="bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded">
                                    {name}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          <div className="bg-gray-800 rounded p-2">
                            <span className="text-xs text-orange-400 font-semibold">엔딩 훅</span>
                            <p className="text-gray-300 text-sm mt-1">{ep.hook}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* 하단 버튼 */}
        {result && !isGenerating && (
          <div className="flex justify-end p-6 pt-4 border-t border-gray-700 gap-3">
            <button
              onClick={onClose}
              className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm"
            >
              닫기
            </button>
            <button
              onClick={() => {
                onSave(result);
                onClose();
              }}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm"
            >
              트리트먼트 저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

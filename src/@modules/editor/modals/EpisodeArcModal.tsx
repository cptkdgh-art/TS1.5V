/**
 * ============================================================
 * @module modules/editor/modals
 * @file EpisodeArcModal.tsx
 * ============================================================
 * @description 에피소드 기획실 모달
 * ============================================================
 */

import React, { useState } from 'react';
import type { Novel, Series, EpisodeArc, EpisodeArcChapter } from '@core/types';
import { generateEpisodeArc, suggestIntermediateChapter, suggestEpisodeGoals } from '@services/ai';
import { XMarkIcon, TrashIcon, PlusIcon, ArrowPathIcon, ClipboardDocumentListIcon, toast } from '@shared/components';

interface EpisodeArcModalProps {
  novel: Novel;
  series: Series | null;
  onClose: () => void;
  onSave: (arc: EpisodeArc) => void;
}

export function EpisodeArcModal({
  novel,
  series,
  onClose,
  onSave,
}: EpisodeArcModalProps) {
  const [goal, setGoal] = useState(novel.episodeArc?.goal || '');
  const [count, setCount] = useState(novel.episodeArc?.chapters?.length || 3);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [result, setResult] = useState<EpisodeArcChapter[] | null>(novel.episodeArc?.chapters || null);
  const [suggestedGoals, setSuggestedGoals] = useState<string[]>([]);
  const [insertingIndex, setInsertingIndex] = useState<number | null>(null);

  const handleGenerate = async () => {
    setIsLoading(true);
    try {
      let targetGoal = goal;
      const context = series ? series.seriesPlotSummary : novel.plotSummary;

      if (!targetGoal.trim()) {
        const suggestions = await suggestEpisodeGoals(context || '', novel.chapters[novel.chapters.length - 1]?.content || '');
        if (suggestions && suggestions.length > 0) {
          targetGoal = suggestions[0];
          setGoal(targetGoal);
        } else {
          throw new Error("AI가 적절한 목표를 찾지 못했습니다. 목표를 입력해주세요.");
        }
      }

      const arc = await generateEpisodeArc(targetGoal, count, context || '');
      setResult(arc);
    } catch (e) {
      toast.error('에피소드 생성 실패: ' + (e as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestGoals = async () => {
    setIsSuggesting(true);
    try {
      const context = series ? series.seriesPlotSummary : novel.plotSummary;
      const lastChapter = novel.chapters[novel.chapters.length - 1]?.content || '';
      const suggestions = await suggestEpisodeGoals(context || '', lastChapter);
      setSuggestedGoals(suggestions);
    } catch (error) {
      toast.error(`목표 추천 실패: ${(error as Error).message}`);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleInsertChapter = async (index: number) => {
    if (!result) return;
    setInsertingIndex(index);
    try {
      const prevChapter = result[index];
      const nextChapter = result[index + 1];

      if (!prevChapter || !nextChapter) {
        toast.warning("중간 챕터 삽입은 앞뒤 챕터가 모두 존재할 때 가장 정확합니다.");
        setInsertingIndex(null);
        return;
      }

      const newChapter = await suggestIntermediateChapter(prevChapter, nextChapter);
      const newChapters = [...result];
      newChapters.splice(index + 1, 0, newChapter);
      setResult(newChapters);
      setCount(newChapters.length);
    } catch (error) {
      toast.error((error as Error).message || '중간 챕터 생성 실패');
    } finally {
      setInsertingIndex(null);
    }
  };

  const handleDeleteChapter = (index: number) => {
    if (result && result.length > 1) {
      const newChapters = result.filter((_, i) => i !== index);
      setResult(newChapters);
      setCount(newChapters.length);
    }
  };

  const handleUpdateChapter = (index: number, field: keyof EpisodeArcChapter, value: string) => {
    if (result) {
      const newChapters = [...result];
      newChapters[index] = { ...newChapters[index], [field]: value };
      setResult(newChapters);
    }
  };

  const handleApply = () => {
    if (result) {
      onSave({
        goal,
        chapters: result,
        startChapterIndex: novel.chapters.length
      });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-5xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-6 h-6 text-teal-400" /> 에피소드 기획실
          </h3>
          <button onClick={onClose}><XMarkIcon className="w-6 h-6 text-gray-400 hover:text-white" /></button>
        </div>

        <div className="flex flex-col gap-4 mb-6 bg-gray-700 p-4 rounded-lg">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="flex-1 w-full">
              <label className="block text-sm text-gray-300 mb-1">에피소드 목표</label>
              <div className="flex gap-2">
                <input
                  className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white placeholder-gray-500"
                  placeholder="비워두면 AI가 알아서 설정합니다."
                  value={goal}
                  onChange={e => setGoal(e.target.value)}
                />
                <button onClick={handleSuggestGoals} disabled={isSuggesting} className="bg-indigo-600 hover:bg-indigo-700 px-3 rounded text-white text-sm whitespace-nowrap disabled:bg-gray-600">
                  {isSuggesting ? '생각 중...' : '목표 추천'}
                </button>
              </div>
            </div>
            <div className="w-24">
              <label className="block text-sm text-gray-300 mb-1">챕터 수</label>
              <input type="number" min="1" max="10" className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white" value={count} onChange={e => setCount(parseInt(e.target.value))} />
            </div>
            <button onClick={handleGenerate} disabled={isLoading} className="w-full md:w-auto bg-teal-600 hover:bg-teal-700 text-white px-4 py-2 rounded font-bold h-10 disabled:bg-gray-600 whitespace-nowrap">
              {isLoading ? '설계 중...' : (goal ? '설계도 생성' : 'AI 자동 설계 (Auto)')}
            </button>
          </div>

          {suggestedGoals.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {suggestedGoals.map((sg, idx) => (
                <button key={idx} onClick={() => setGoal(sg)} className="bg-indigo-900/50 hover:bg-indigo-800 text-indigo-200 text-xs px-3 py-1.5 rounded-full border border-indigo-700/50 transition-colors text-left">
                  {sg}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 pb-4">
          {result ? result.map((chap, idx) => (
            <React.Fragment key={idx}>
              <div className="bg-gray-700 p-4 rounded-lg border border-gray-600 relative group">
                <div className="flex justify-between mb-2 items-center">
                  <h4 className="font-bold text-teal-300">Chapter {idx + 1}</h4>
                  <div className="flex items-center gap-2">
                    <select
                      value={chap.pacing}
                      onChange={(e) => handleUpdateChapter(idx, 'pacing', e.target.value)}
                      className="text-xs bg-gray-600 px-2 py-1 rounded text-gray-300 border-none focus:ring-0"
                    >
                      <option value="slow">느림</option>
                      <option value="normal">보통</option>
                      <option value="fast">빠름</option>
                    </select>
                    <button onClick={() => handleDeleteChapter(idx)} className="text-gray-500 hover:text-red-400"><TrashIcon className="w-4 h-4" /></button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div>
                    <span className="text-xs text-gray-400 block">목표</span>
                    <input
                      value={chap.goal}
                      onChange={(e) => handleUpdateChapter(idx, 'goal', e.target.value)}
                      className="w-full bg-gray-800/50 border-none rounded p-1 text-sm text-white focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">핵심 사건</span>
                    <textarea
                      value={chap.keyEvents}
                      onChange={(e) => handleUpdateChapter(idx, 'keyEvents', e.target.value)}
                      className="w-full bg-gray-800/50 border-none rounded p-1 text-sm text-white focus:ring-teal-500 resize-none h-16"
                    />
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">클리프행어</span>
                    <input
                      value={chap.cliffhanger}
                      onChange={(e) => handleUpdateChapter(idx, 'cliffhanger', e.target.value)}
                      className="w-full bg-gray-800/50 border-none rounded p-1 text-sm text-white focus:ring-teal-500"
                    />
                  </div>
                </div>
              </div>
              {idx < result.length - 1 && (
                <div className="flex justify-center py-2 relative group/add">
                  <div className="absolute inset-0 flex items-center" aria-hidden="true">
                    <div className="w-full border-t border-gray-700 group-hover/add:border-gray-600"></div>
                  </div>
                  <button
                    onClick={() => handleInsertChapter(idx)}
                    disabled={insertingIndex !== null}
                    className="relative bg-gray-800 text-gray-400 group-hover/add:text-white group-hover/add:bg-gray-600 rounded-full p-1 border border-gray-700 group-hover/add:border-gray-500 transition-all z-10"
                    title="이 사이에 징검다리 챕터 자동 생성"
                  >
                    {insertingIndex === idx ? <ArrowPathIcon className="w-5 h-5 animate-spin" /> : <PlusIcon className="w-5 h-5" />}
                  </button>
                </div>
              )}
            </React.Fragment>
          )) : (
            <div className="text-center text-gray-500 mt-20 flex flex-col items-center">
              <ClipboardDocumentListIcon className="w-12 h-12 text-gray-600 mb-4" />
              <p>목표를 입력하거나, 'AI 자동 설계' 버튼을 눌러주세요.</p>
              <p className="text-sm mt-2">AI가 현재 줄거리를 파악하여 최적의 에피소드를 제안합니다.</p>
            </div>
          )}
        </div>

        {result && (
          <div className="mt-6 flex justify-end pt-4 border-t border-gray-700">
            <button onClick={handleApply} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg shadow-indigo-900/50 transition-transform hover:scale-105">
              이 설계도로 집필 시작
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

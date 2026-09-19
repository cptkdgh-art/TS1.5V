/**
 * ============================================================
 * @module modules/novel/components
 * @file CreateWorkModal.tsx
 * ============================================================
 * @description 새 작품 생성 모달
 * ============================================================
 */

import { useState } from 'react';
import type { AiAuthor } from '@core/types';
import { Modal, Button, Input, Textarea, UserPlusIcon, WandSparklesIcon, toast } from '@shared/components';
import { generateInitialWorldviewDraft } from '@services/ai';
import { WorkspaceAuthorImportModal } from '@modules/author/components';
import { buildStoryClassificationText } from '@core/constants/story-guides';
import { StoryGuideFields } from './StoryGuideFields';

export type WorkType = 'novel' | 'series';

export interface CreateNovelData {
  title: string;
  subject: string;
  mood: string;
  primaryGenre: string;
  subgenres: string[];
  themes: string[];
  plotSummary: string;
  aiAuthorId: string | null;
  worldviewDraft: string | null;
}

export interface CreateSeriesData {
  seriesTitle: string;
  seriesPlotSummary: string;
  volume1: CreateNovelData;
  worldviewDraft: string | null;
}

interface CreateWorkModalProps {
  authors: AiAuthor[];
  onClose: () => void;
  onCreateNovel: (data: CreateNovelData) => void;
  onCreateSeries: (data: CreateSeriesData) => void;
}

export function CreateWorkModal({
  authors,
  onClose,
  onCreateNovel,
  onCreateSeries,
}: CreateWorkModalProps) {
  const [workType, setWorkType] = useState<WorkType>('novel');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [mood, setMood] = useState('');
  const [primaryGenre, setPrimaryGenre] = useState('');
  const [subgenres, setSubgenres] = useState<string[]>([]);
  const [themes, setThemes] = useState<string[]>([]);
  const [plotSummary, setPlotSummary] = useState('');
  const [seriesTitle, setSeriesTitle] = useState('');
  const [seriesPlotSummary, setSeriesPlotSummary] = useState('');
  const [volume1PlotSummary, setVolume1PlotSummary] = useState('');
  // 기본: 첫 번째 기본작가 선택 (자유 모드도 가능)
  const [selectedAuthorId, setSelectedAuthorId] = useState<string | null>(
    authors.find((a) => a.isDefault)?.id || null
  );
  const [isWorkspaceImportOpen, setWorkspaceImportOpen] = useState(false);

  // AI 세계관 생성 관련
  const [worldviewDraft, setWorldviewDraft] = useState<string | null>(null);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  // 세계관 생성 가능 여부 확인
  const hasStoryDirection = !!(primaryGenre || subject.trim());
  const canGenerateForStandalone = !!(title && hasStoryDirection && mood && plotSummary);
  const canGenerateForSeries = !!(seriesTitle && hasStoryDirection && mood && seriesPlotSummary);
  const canGenerate = workType === 'novel' ? canGenerateForStandalone : canGenerateForSeries;
  const missingForWorldview = [
    !hasStoryDirection ? '주 장르 또는 주제·소재' : null,
    !mood.trim() ? '분위기' : null,
    workType === 'novel' && !title.trim() ? '소설 제목' : null,
    workType === 'novel' && !plotSummary.trim() ? '총괄 설계도' : null,
    workType === 'series' && !seriesTitle.trim() ? '시리즈 제목' : null,
    workType === 'series' && !seriesPlotSummary.trim() ? '시리즈 설계도' : null,
  ].filter(Boolean);

  const handleGenerateDraft = async () => {
    if (!canGenerate) {
      toast.warning('세계관 초안을 생성하려면 모든 필수 정보를 입력해야 합니다.');
      return;
    }
    setIsGeneratingDraft(true);
    try {
      const draftTitle = workType === 'novel' ? title : `${seriesTitle} 1권: ${title}`;
      const draftPlot = workType === 'novel' ? plotSummary : `${seriesPlotSummary}\n\n${volume1PlotSummary}`;
      const classification = buildStoryClassificationText({ primaryGenre, subgenres, themes, subject });
      const draft = await generateInitialWorldviewDraft(draftTitle, classification, mood, draftPlot);
      setWorldviewDraft(draft);
    } catch (e) {
      toast.error((e as Error).message || '세계관 생성에 실패했습니다.');
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleSubmit = () => {
    if (workType === 'novel') {
      if (!title.trim()) {
        toast.warning('소설 제목을 입력해주세요.');
        return;
      }
      onCreateNovel({
        title: title.trim(),
        subject: subject.trim(),
        mood: mood.trim(),
        primaryGenre,
        subgenres,
        themes,
        plotSummary: plotSummary.trim(),
        aiAuthorId: selectedAuthorId,
        worldviewDraft,
      });
    } else {
      if (!seriesTitle.trim()) {
        toast.warning('시리즈 제목을 입력해주세요.');
        return;
      }
      // 1권 제목이 없으면 기본값 사용
      const volume1Title = title.trim() || `${seriesTitle.trim()} 1권`;
      onCreateSeries({
        seriesTitle: seriesTitle.trim(),
        seriesPlotSummary: seriesPlotSummary.trim(),
        volume1: {
          title: volume1Title,
          subject: subject.trim(),
          mood: mood.trim(),
          primaryGenre,
          subgenres,
          themes,
          plotSummary: volume1PlotSummary.trim(),
          aiAuthorId: selectedAuthorId,
          worldviewDraft: null,
        },
        worldviewDraft,
      });
    }
    onClose();
  };

  return (
    <>
    <Modal isOpen={true} onClose={onClose} title="새 작품 만들기" size="full">
      <div className="space-y-4">
        {/* 작품 유형 선택 */}
        <div role="group" aria-label="작품 유형" className="flex gap-4 mb-4">
          <button
            type="button"
            onClick={() => setWorkType('novel')}
            aria-pressed={workType === 'novel'}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              workType === 'novel'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            단편/독립 소설
          </button>
          <button
            type="button"
            onClick={() => setWorkType('series')}
            aria-pressed={workType === 'series'}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              workType === 'series'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            시리즈
          </button>
        </div>

        <div className="rounded-lg border border-gray-700 bg-gray-900/35 p-4">
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-indigo-300">작품 방향 가이드</h3>
            <p className="mt-1 text-xs leading-5 text-gray-400">
              아는 만큼만 고르고 나머지는 비워도 됩니다. 선택값은 담당 작가가 작품을 이해하는 참고 정보로만 사용됩니다.
            </p>
          </div>
          <StoryGuideFields
            idPrefix="create-work"
            primaryGenre={primaryGenre}
            subgenres={subgenres}
            themes={themes}
            subject={subject}
            mood={mood}
            onPrimaryGenreChange={(value) => {
              setPrimaryGenre(value);
              setSubgenres([]);
            }}
            onSubgenresChange={setSubgenres}
            onThemesChange={setThemes}
            onSubjectChange={setSubject}
            onMoodChange={setMood}
          />
        </div>

        {/* 단편/독립 소설 모드 */}
        {workType === 'novel' && (
          <>
            <Input
              label="소설 제목"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="작품 제목"
            />
            <Textarea
              label="총괄 설계도 (Master Blueprint)"
              value={plotSummary}
              onChange={(e) => setPlotSummary(e.target.value)}
              placeholder="소설의 핵심 뼈대, 주요 사건, 원하는 결말의 방향 등을 기록합니다."
              rows={4}
            />
          </>
        )}

        {/* 시리즈 모드 */}
        {workType === 'series' && (
          <>
            <Input
              label="시리즈 제목"
              value={seriesTitle}
              onChange={(e) => setSeriesTitle(e.target.value)}
              placeholder="예: 아퀼라 연대기"
            />
            <Textarea
              label="총괄 설계도 (시리즈 전체)"
              value={seriesPlotSummary}
              onChange={(e) => setSeriesPlotSummary(e.target.value)}
              placeholder="시리즈 전체를 관통하는 핵심 목표, 최종 결말의 방향 등을 기록합니다."
              rows={3}
            />
            <div className="border-t border-gray-700 pt-4">
              <h3 className="font-semibold text-lg text-indigo-400 mb-3">1권 정보</h3>
              <Input
                label="1권 제목 (선택 사항)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={seriesTitle ? `${seriesTitle} 1권` : '예: 시작의 여정'}
              />
              <div className="mt-4">
                <Textarea
                  label="권별 설계도 (1권)"
                  value={volume1PlotSummary}
                  onChange={(e) => setVolume1PlotSummary(e.target.value)}
                  placeholder="이번 1권에서 일어날 주요 사건과 목표를 기록합니다."
                  rows={3}
                />
              </div>
            </div>
          </>
        )}

        {/* AI 세계관 생성 섹션 */}
        <div className="border-t border-gray-700 pt-4 space-y-3">
          <button
            type="button"
            onClick={handleGenerateDraft}
            disabled={!canGenerate || isGeneratingDraft}
            title={!canGenerate ? `필수 입력 필요: ${missingForWorldview.join(', ')}` : undefined}
            className="w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <WandSparklesIcon className="w-5 h-5" />
            {isGeneratingDraft ? '생성 중...' : 'AI로 기본 세계관 생성하기'}
          </button>
          {!canGenerate && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
              <p className="font-semibold">세계관 생성 전 필수 입력: {missingForWorldview.join(', ')}</p>
              <p className="mt-1 text-amber-200/80">
                짧게 한 줄씩만 채워도 됩니다. 설계도에는 핵심 사건이나 결말 방향을 적어두면 품질이 좋아집니다.
              </p>
            </div>
          )}
          {worldviewDraft !== null && (
            <div>
              <label htmlFor="worldview-draft" className="block text-sm font-medium text-gray-300 mb-1">
                AI가 생성한 세계관 초안 (편집 가능)
              </label>
              <textarea
                id="worldview-draft"
                value={worldviewDraft}
                onChange={(e) => setWorldviewDraft(e.target.value)}
                rows={6}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg p-3 text-sm text-white focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="생성된 세계관이 여기에 표시됩니다."
              />
            </div>
          )}
        </div>

        {/* AI 작가 선택 */}
        <div>
          <div className="mb-1 flex items-center justify-between gap-3">
            <label htmlFor="create-work-author" className="block text-sm font-medium text-gray-300">
              AI 작가
            </label>
            <button
              type="button"
              onClick={() => setWorkspaceImportOpen(true)}
              data-testid="create-work-author-import"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-300 hover:text-indigo-200"
            >
              <UserPlusIcon className="h-4 w-4" />
              작가 불러오기
            </button>
          </div>
          <select
            id="create-work-author"
            value={selectedAuthorId || ''}
            onChange={(e) => setSelectedAuthorId(e.target.value || null)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">자유 모드 (지시사항 없이 시작)</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name}
                {author.isDefault && ' (기본)'}
              </option>
            ))}
          </select>
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {workType === 'series' ? '시리즈 시작' : '소설 시작'}
          </Button>
        </div>
      </div>
    </Modal>
    {isWorkspaceImportOpen && (
      <WorkspaceAuthorImportModal
        onClose={() => setWorkspaceImportOpen(false)}
        onImported={(author) => setSelectedAuthorId(author.id)}
      />
    )}
    </>
  );
}

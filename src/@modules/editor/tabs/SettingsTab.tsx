/**
 * ============================================================
 * @module modules/editor/tabs
 * @file SettingsTab.tsx
 * ============================================================
 * @description 설정 탭 - 소설 설정, 청사진 강화, 스냅샷 관리
 * ============================================================
 */

import { useState } from 'react';
import type { Novel, AiAuthor, Snapshot, Series, Content, Treatment } from '@core/types';
import {
  CameraIcon,
  ClockIcon,
  PhotoIcon,
  TrashIcon,
  PencilIcon,
  ClipboardDocumentListIcon,
  WandSparklesIcon,
  BookOpenIcon,
  ChartBarIcon,
  UserPlusIcon,
  toast,
} from '@shared/components';
import { BlueprintArchitectModal } from '../modals/BlueprintArchitectModal';
import { TreatmentModal } from '../modals/TreatmentModal';
import { OpeningStyleSection } from '../components/OpeningStyleSection';
import {
  bindNovelToSeriesVolume,
  clearNovelSeriesVolume,
  getVolumeDisplayLabel,
  resolveSeriesVolume,
  restoreSnapshotForNovel,
} from '@services/novel';
import { WorkspaceAuthorImportModal } from '@modules/author/components';
import { StoryGuideFields } from '@modules/novel/components/StoryGuideFields';

// ============================================================
// SettingsCard - 설정 카드 컴포넌트
// ============================================================
function SettingsCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-md">
      <h3 className="font-bold text-lg text-indigo-400 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}

// ============================================================
// SettingsTab Props
// ============================================================
interface SettingsTabProps {
  novel: Novel;
  series: Series | null;
  onUpdateNovel: (updatedNovel: Novel) => void;
  onUpdateSeries: (updatedSeries: Series) => void;
  onDetachFromSeries: (novelId: string) => Promise<void> | void;
  authors: AiAuthor[];
  setCoverModalOpen: (isOpen: boolean) => void;
  setSnapshotToDelete: (snapshot: Snapshot | null) => void;
  setCreateAuthorModalOpen: (isOpen: boolean) => void;
  setNovelToDelete: (novel: Novel | null) => void;
  isCloningAuthor: boolean;
  requestConfirmation: (
    title: string,
    message: React.ReactNode,
    confirmText: string,
    onConfirm: () => void
  ) => void;
  onTriggerSnapshotModal: () => void;
  onEditDirective: (index: number, content: Content) => void;
  onCloneAuthor: () => void;
  onEnhanceBlueprint?: (plotSummary: string) => Promise<string[]>;
  title: string;
  onTitleChange: (value: string) => void;
  isSavingTitle: boolean;
  plotSummary: string;
  onPlotSummaryChange: (value: string) => void;
  isSavingPlotSummary: boolean;
  seriesPlotSummary: string;
  onSeriesPlotSummaryChange: (value: string) => void;
  isSavingSeriesPlotSummary: boolean;
  subject: string;
  onSubjectChange: (value: string) => void;
  isSavingSubject: boolean;
  mood: string;
  onMoodChange: (value: string) => void;
  isSavingMood: boolean;
}

// ============================================================
// SettingsTab 메인 컴포넌트
// ============================================================
export function SettingsTab({
  novel,
  series,
  onUpdateNovel,
  onUpdateSeries,
  onDetachFromSeries,
  authors,
  setCoverModalOpen,
  setSnapshotToDelete,
  setCreateAuthorModalOpen,
  setNovelToDelete,
  isCloningAuthor,
  requestConfirmation,
  onTriggerSnapshotModal,
  onEditDirective,
  onCloneAuthor,
  onEnhanceBlueprint,
  title,
  onTitleChange,
  isSavingTitle,
  plotSummary,
  onPlotSummaryChange,
  isSavingPlotSummary,
  seriesPlotSummary,
  onSeriesPlotSummaryChange,
  isSavingSeriesPlotSummary,
  subject,
  onSubjectChange,
  isSavingSubject,
  mood,
  onMoodChange,
  isSavingMood,
}: SettingsTabProps) {
  // 청사진 강화 상태
  const [isEnhancingBlueprint, setIsEnhancingBlueprint] = useState(false);
  const [blueprintSuggestions, setBlueprintSuggestions] = useState<string[]>([]);
  const [isBlueprintModalOpen, setIsBlueprintModalOpen] = useState(false);

  // 트리트먼트 모달 상태
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [isWorkspaceImportOpen, setWorkspaceImportOpen] = useState(false);

  // 시리즈 권수 계산
  const autoVolumeNumber = series ? series.novelIds.indexOf(novel.id) + 1 : undefined;
  const currentVolumePlan = resolveSeriesVolume(series, novel);
  const currentVolumeNumber = currentVolumePlan?.volumeNumber ?? novel.volumeNumber ?? autoVolumeNumber;
  const currentVolumeLabel = currentVolumePlan
    ? getVolumeDisplayLabel(currentVolumePlan)
    : currentVolumeNumber ? `${currentVolumeNumber}권` : '권 미지정';

  // 글자 수 계산
  const currentCharacterCount = novel.chapters.reduce((sum, ch) => sum + ch.content.length, 0);
  const targetCount = novel.targetCharacterCount || 0;
  const progressPercent =
    targetCount > 0 ? Math.min(100, (currentCharacterCount / targetCount) * 100) : 0;

  // 챕터 수 계산
  const currentChapterCount = novel.chapters.length;
  const targetChapterCount = novel.targetChapterCount || 0;
  const chapterProgressPercent =
    targetChapterCount > 0 ? Math.min(100, (currentChapterCount / targetChapterCount) * 100) : 0;

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val > 0) {
      onUpdateNovel({ ...novel, volumeNumber: val });
    } else {
      onUpdateNovel({ ...novel, volumeNumber: undefined });
    }
  };

  const handleVolumePlanChange = (volumeId: string) => {
    if (!series) return;
    if (!volumeId) {
      const cleared = clearNovelSeriesVolume(series, novel);
      onUpdateSeries(cleared.series);
      onUpdateNovel(cleared.novel);
      return;
    }
    const target = series.blueprint?.volumes.find((volume) => volume.id === volumeId);
    if (!target) return;
    if (target.linkedNovelId && target.linkedNovelId !== novel.id) {
      toast.warning('이 권 계획에는 이미 다른 작품이 연결되어 있습니다. 시리즈 건축실에서 연결을 교체해주세요.');
      return;
    }
    const bound = bindNovelToSeriesVolume(series, novel, volumeId);
    onUpdateSeries(bound.series);
    onUpdateNovel(bound.novel);
    toast.success(`${getVolumeDisplayLabel(target)} 계획을 이 작품에 적용했습니다.`);
  };

  const handleDetachFromSeries = () => {
    if (!series) return;
    requestConfirmation(
      '시리즈에서 독립 분리',
      <p>
        이 작품을 <strong>{series.title}</strong>에서 분리할까요? 원고는 그대로 두고,
        공용 인물·세계관과 현재 권 계획을 작품에 복사해 독립 작품으로 보존합니다.
      </p>,
      '독립 작품으로 분리',
      () => void onDetachFromSeries(novel.id),
    );
  };

  const handleTargetCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      onUpdateNovel({ ...novel, targetCharacterCount: val });
    }
  };

  const handleTargetChapterCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value, 10);
    if (!isNaN(val) && val >= 0) {
      onUpdateNovel({ ...novel, targetChapterCount: val });
    }
  };

  const handlePreventAutoEndingChange = (checked: boolean) => {
    onUpdateNovel({ ...novel, preventAutoEnding: checked });
  };

  const handleRestoreSnapshot = (snapshot: Snapshot) => {
    requestConfirmation(
      '스냅샷 복원',
      <p>'{snapshot.description}' 스냅샷으로 복원하시겠습니까? 현재 작업 내용은 스냅샷 내용으로 대체됩니다.</p>,
      '복원',
      () => {
      const restoredNovel = restoreSnapshotForNovel(novel, snapshot);
      onUpdateNovel(restoredNovel);
      }
    );
  };

  // 청사진 강화 핸들러
  const handleEnhanceBlueprint = async () => {
    const plotToEnhance = series ? seriesPlotSummary : plotSummary;
    if (!plotToEnhance.trim()) {
      toast.warning('먼저 설계도의 내용을 입력해주세요.');
      return;
    }

    if (!onEnhanceBlueprint) {
      // AI 기능 미연결 시 placeholder
      toast.warning('AI 청사진 강화 기능은 아직 연결되지 않았습니다.');
      return;
    }

    setIsEnhancingBlueprint(true);
    try {
      const suggestions = await onEnhanceBlueprint(plotToEnhance);
      setBlueprintSuggestions(suggestions);
      setIsBlueprintModalOpen(true);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setIsEnhancingBlueprint(false);
    }
  };

  const onClickCloneAuthor = () => {
    requestConfirmation(
      '작가 스타일 분석 확인',
      <p>
        현재 소설의 전체 작업 내역을 AI에게 보내, 이 소설만의 고유한 스타일을 가진 새로운 작가
        프로필을 생성합니다.
      </p>,
      '분석 시작',
      onCloneAuthor
    );
  };

  const onClickGenerateCover = () => {
    requestConfirmation(
      '표지 이미지 생성 확인',
      <p>AI가 소설의 제목, 줄거리, 분위기를 바탕으로 표지 이미지를 생성합니다.</p>,
      '생성 시작',
      () => setCoverModalOpen(true)
    );
  };

  return (
    <div className="font-sans space-y-8 max-w-2xl mx-auto">
      {/* 청사진 건축실 모달 */}
      {isBlueprintModalOpen && (
        <BlueprintArchitectModal
          originalPlot={series ? seriesPlotSummary : plotSummary}
          suggestions={blueprintSuggestions}
          onClose={() => setIsBlueprintModalOpen(false)}
          onApply={(suggestion) => {
            if (series) {
              onSeriesPlotSummaryChange(suggestion);
            } else {
              onPlotSummaryChange(suggestion);
            }
            setIsBlueprintModalOpen(false);
          }}
        />
      )}

      {/* 트리트먼트 모달 */}
      {isTreatmentModalOpen && (
        <TreatmentModal
          novel={novel}
          series={series}
          onClose={() => setIsTreatmentModalOpen(false)}
          onSave={(treatment: Treatment) => {
            onUpdateNovel({ ...novel, treatment });
            toast.success('트리트먼트가 저장되었습니다!');
          }}
        />
      )}

      <SettingsCard title="소설 기본 정보">
        <div className="space-y-4">
          {/* 제목 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="novel-title" className="block text-sm font-medium text-gray-300">
                소설 제목
              </label>
              {isSavingTitle && (
                <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>
              )}
            </div>
            <input
              id="novel-title"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="소설의 제목"
            />
          </div>

          <StoryGuideFields
            idPrefix="novel-settings"
            primaryGenre={novel.primaryGenre || ''}
            subgenres={novel.subgenres || []}
            themes={novel.themes || []}
            subject={subject}
            mood={mood}
            onPrimaryGenreChange={(primaryGenre) => onUpdateNovel({
              ...novel,
              primaryGenre: primaryGenre || undefined,
            })}
            onSubgenresChange={(subgenres) => onUpdateNovel({ ...novel, subgenres })}
            onThemesChange={(themes) => onUpdateNovel({ ...novel, themes })}
            onSubjectChange={onSubjectChange}
            onMoodChange={onMoodChange}
            isSavingSubject={isSavingSubject}
            isSavingMood={isSavingMood}
          />

          {/* 목표 분량 설정 */}
          <div className="bg-gray-700/50 p-4 rounded-md border border-gray-600 space-y-4">
            <h4 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4" />
              목표 분량 설정
            </h4>

            {/* 목표 챕터 수 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label
                  htmlFor="target-chapter-count"
                  className="block text-sm font-medium text-gray-300"
                >
                  목표 챕터 수
                </label>
                <input
                  id="target-chapter-count"
                  type="number"
                  min="0"
                  step="10"
                  value={targetChapterCount || ''}
                  onChange={handleTargetChapterCountChange}
                  className="w-28 bg-gray-800 border border-gray-600 rounded-md p-1 text-right text-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="예: 150"
                />
              </div>
              {targetChapterCount > 0 && (
                <div className="w-full bg-gray-800 rounded-full h-2 mb-1 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      chapterProgressPercent > 90
                        ? 'bg-purple-500'
                        : chapterProgressPercent > 80
                          ? 'bg-indigo-500'
                          : 'bg-blue-500'
                    }`}
                    style={{ width: `${chapterProgressPercent}%` }}
                  ></div>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-400">
                <span>현재: {currentChapterCount}화</span>
                {targetChapterCount > 0 && (
                  <span>
                    목표: {targetChapterCount}화 ({chapterProgressPercent.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>

            {/* 목표 글자 수 */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label
                  htmlFor="target-count"
                  className="block text-sm font-medium text-gray-300"
                >
                  목표 글자 수
                </label>
                <input
                  id="target-count"
                  type="number"
                  min="0"
                  step="10000"
                  value={targetCount || ''}
                  onChange={handleTargetCountChange}
                  className="w-28 bg-gray-800 border border-gray-600 rounded-md p-1 text-right text-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="예: 500000"
                />
              </div>
              {targetCount > 0 && (
                <div className="w-full bg-gray-800 rounded-full h-2 mb-1 overflow-hidden">
                  <div
                    className={`h-2 rounded-full transition-all duration-500 ${
                      progressPercent > 90
                        ? 'bg-red-500'
                        : progressPercent > 80
                          ? 'bg-yellow-500'
                          : 'bg-teal-500'
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
              )}
              <div className="flex justify-between text-xs text-gray-400">
                <span>현재: {currentCharacterCount.toLocaleString()}자</span>
                {targetCount > 0 && (
                  <span>
                    목표: {targetCount.toLocaleString()}자 ({progressPercent.toFixed(1)}%)
                  </span>
                )}
              </div>
            </div>

            {/* 자동 완결 방지 토글 */}
            <div className="pt-2 border-t border-gray-600">
              <label className="flex items-center justify-between cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-gray-300">자동 완결 방지</span>
                  <p className="text-xs text-gray-500 mt-0.5">
                    AI가 목표 도달 전에 결말을 준비하지 않도록 합니다
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={novel.preventAutoEnding || false}
                    onChange={(e) => handlePreventAutoEndingChange(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-indigo-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </div>
              </label>
            </div>

            {/* 안내 메시지 */}
            <div className="text-xs text-gray-500 bg-gray-900/50 p-2 rounded">
              {novel.preventAutoEnding ? (
                <p className="text-indigo-400">
                  <strong>자동 완결 방지 ON:</strong> AI가 목표에 도달할 때까지 결말을 준비하지 않습니다.
                  장편 연재에 적합합니다.
                </p>
              ) : (
                <p>
                  * 목표 분량의 80%가 넘으면 AI가 자동으로 결말을 준비합니다.
                  (0으로 설정하면 비활성화)
                </p>
              )}
            </div>
          </div>

          {/* 오프닝 스타일 설정 (1화 시작 방식) */}
          <OpeningStyleSection novel={novel} onUpdateNovel={onUpdateNovel} />

          {/* 시리즈 설정 */}
          {series && (
            <div className="bg-gray-900/50 p-4 rounded-md border border-indigo-900/50 space-y-4 mt-4">
              <h4 className="font-bold text-indigo-400 flex items-center gap-2">
                <BookOpenIcon className="w-4 h-4" />
                시리즈 구성 설정
              </h4>

              {/* 권 청사진 매핑 */}
              <div>
                <label
                  htmlFor="volume-number"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  적용할 권 청사진
                </label>
                {series.blueprint?.volumes.length ? (
                  <>
                    <select
                      id="volume-number"
                      value={currentVolumePlan?.id || ''}
                      onChange={(e) => handleVolumePlanChange(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    >
                      <option value="">권 미지정</option>
                      {[...series.blueprint.volumes]
                        .sort((a, b) => a.volumeNumber - b.volumeNumber)
                        .map((volume) => {
                          const occupied = volume.linkedNovelId && volume.linkedNovelId !== novel.id;
                          return (
                            <option key={volume.id} value={volume.id} disabled={!!occupied}>
                              {getVolumeDisplayLabel(volume)} · {volume.title || '제목 없음'}{occupied ? ' (다른 작품 연결됨)' : ''}
                            </option>
                          );
                        })}
                    </select>
                    <p className="text-xs text-gray-400 mt-1">
                      권 번호나 순서가 바뀌어도 내부 계획 ID로 연결되어 같은 청사진이 유지됩니다.
                    </p>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                  <input
                    id="volume-number"
                    type="number"
                    min="1"
                    value={currentVolumeNumber || ''}
                    onChange={handleVolumeChange}
                    className="w-24 bg-gray-800 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                    placeholder={autoVolumeNumber ? `${autoVolumeNumber} (자동)` : '권수'}
                  />
                  <p className="text-xs text-gray-400">
                    {novel.volumeNumber
                      ? '사용자가 수동으로 지정한 권수입니다. (자동 계산 무시됨)'
                      : `현재 시리즈 내 순서에 따라 ${autoVolumeNumber}권으로 자동 계산되었습니다.`}
                  </p>
                  </div>
                )}
              </div>

              {/* AI 식별 헤더 미리보기 */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  AI 식별 헤더 미리보기
                </label>
                <div className="p-2 bg-black/30 rounded text-xs font-mono text-green-400 whitespace-pre-wrap border border-gray-700">
                  {`[CONTEXT HEADER: CURRENTLY WRITING]
**SERIES:** ${series.title}
**VOLUME:** ${currentVolumeLabel}
**VOLUME TITLE:** ${novel.title}`}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  * AI는 위 헤더와 연결된 권 청사진의 목표·갈등·핵심 사건을 작품 설계도에 추가하여 사용합니다.
                </p>
              </div>

              {currentVolumePlan && (
                <div className="border border-indigo-800/70 bg-indigo-950/25 p-3 text-xs text-gray-300 space-y-1">
                  <p className="font-semibold text-indigo-300">적용된 계획 · {getVolumeDisplayLabel(currentVolumePlan)}</p>
                  <p><span className="text-gray-500">권 전용 설정:</span> {currentVolumePlan.localSetting || '미정'}</p>
                  <p><span className="text-gray-500">목표:</span> {currentVolumePlan.goal || '미정'}</p>
                  <p><span className="text-gray-500">갈등:</span> {currentVolumePlan.mainConflict || '미정'}</p>
                  <p><span className="text-gray-500">핵심 사건:</span> {currentVolumePlan.keyEvents || '미정'}</p>
                </div>
              )}

              {!currentVolumePlan && novel.seriesVolumePlanSnapshot && (
                <div className="border border-gray-700 bg-gray-950/30 p-3 text-xs text-gray-400 space-y-1">
                  <p className="font-semibold text-gray-300">
                    이전 계획 보존 · {novel.seriesVolumePlanSnapshot.displayLabel}
                  </p>
                  <p>현재 권에는 연결되지 않았지만, 다시 매핑하기 전까지 AI 참고자료로만 유지됩니다.</p>
                </div>
              )}

              <div className="pt-3 border-t border-gray-700">
                <button
                  type="button"
                  onClick={handleDetachFromSeries}
                  className="w-full border border-gray-600 bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium py-2 px-3 rounded-md text-sm transition-colors"
                >
                  이 작품을 시리즈에서 독립 분리
                </button>
                <p className="text-xs text-gray-500 mt-1">
                  원고는 삭제되지 않으며, 공용 인물·세계관과 현재 권 계획이 작품에 보존됩니다.
                </p>
              </div>

              {/* 시리즈 전체 설계도 */}
              <div className="pt-2 border-t border-gray-700">
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="series-plot" className="block text-sm font-medium text-gray-300">
                    총괄 설계도 (시리즈 전체)
                  </label>
                  {isSavingSeriesPlotSummary && (
                    <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>
                  )}
                </div>
                <textarea
                  id="series-plot"
                  value={seriesPlotSummary}
                  onChange={(e) => onSeriesPlotSummaryChange(e.target.value)}
                  rows={5}
                  className="w-full bg-gray-800 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="시리즈 전체를 관통하는 핵심 줄거리, 최종 목표 등을 기록합니다."
                />
                <button
                  onClick={handleEnhanceBlueprint}
                  disabled={isEnhancingBlueprint}
                  className="mt-2 w-full flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors disabled:bg-gray-600"
                >
                  <WandSparklesIcon className="w-5 h-5" />
                  {isEnhancingBlueprint ? '분석 중...' : 'AI로 설계도 강화'}
                </button>
              </div>
            </div>
          )}

          {/* 권별/단권 설계도 */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label htmlFor="novel-plot" className="block text-sm font-medium text-gray-300">
                {series ? '권별 설계도 (이 권의 목표)' : '총괄 설계도 (Master Blueprint)'}
              </label>
              {isSavingPlotSummary && (
                <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>
              )}
            </div>
            <textarea
              id="novel-plot"
              value={plotSummary}
              onChange={(e) => onPlotSummaryChange(e.target.value)}
              rows={5}
              className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              placeholder="소설의 핵심 뼈대, 주요 사건, 원하는 결말의 방향 등을 기록합니다. AI는 이 설계도를 바탕으로 글을 씁니다."
            />
            {/* 설계도 관련 버튼들 */}
            <div className="mt-2 flex gap-2">
              {!series && (
                <button
                  onClick={handleEnhanceBlueprint}
                  disabled={isEnhancingBlueprint}
                  className="flex-1 flex items-center justify-center gap-2 bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors disabled:bg-gray-600"
                >
                  <WandSparklesIcon className="w-5 h-5" />
                  {isEnhancingBlueprint ? '분석 중...' : 'AI로 설계도 강화'}
                </button>
              )}
              <button
                onClick={() => setIsTreatmentModalOpen(true)}
                className={`${!series ? 'flex-1' : 'w-full'} flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm transition-colors`}
              >
                <ClipboardDocumentListIcon className="w-5 h-5" />
                {novel.treatment ? '트리트먼트 보기/재생성' : '트리트먼트 생성'}
              </button>
            </div>
            <div className="mt-2 text-xs text-gray-400 space-y-2 p-3 bg-gray-900/50 rounded-md">
              <p>
                <strong className="text-teal-400">Tip:</strong> AI의 나침반이자 헌법입니다. 단순한
                줄거리보다, 이야기의 '규칙'과 '목표'를 명확히 제시하면 AI가 훨씬 더 똑똑하게
                작동합니다.
              </p>
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* 스냅샷 관리 */}
      <SettingsCard title="스냅샷 관리" icon={<ClockIcon className="w-5 h-5" />}>
        <p className="text-sm text-gray-400 mb-3">
          중요한 시점의 소설을 백업하고 언제든지 복원할 수 있습니다.
        </p>
        <button
          onClick={onTriggerSnapshotModal}
          className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg text-sm"
        >
          현재 상태로 스냅샷 생성
        </button>
        <ul className="mt-4 space-y-2">
          {(novel.snapshots || []).map((snap) => (
            <li key={snap.id} className="bg-gray-600 p-3 rounded-md flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-gray-200 break-words">{snap.description}</p>
                  {snap.kind === 'auto-recovery' && (
                    <span className="text-[10px] font-bold text-teal-200 bg-teal-900/70 px-2 py-0.5 rounded-full">
                      자동 복구
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <ClockIcon className="w-3 h-3" /> {new Date(snap.createdAt).toLocaleString()}
                </p>
                {snap.recoveryMeta && (
                  <p className="mt-1 text-xs text-gray-400">
                    복원 시 {snap.recoveryMeta.chapterCountBefore}화 상태 · {snap.recoveryMeta.targetChapterNumber}화 작업 전
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRestoreSnapshot(snap)}
                  className="text-sm text-indigo-400 hover:text-indigo-300"
                >
                  복원
                </button>
                <button
                  onClick={() => setSnapshotToDelete(snap)}
                  className="p-1 text-gray-400 hover:text-red-400"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </SettingsCard>

      {/* 표지 이미지 */}
      <SettingsCard title="표지 이미지" icon={<CameraIcon className="w-5 h-5" />}>
        <div className="flex items-center gap-4">
          <div className="w-28 h-40 shrink-0 bg-gray-600 rounded-md flex items-center justify-center overflow-hidden">
            {novel.coverImage ? (
              <img src={novel.coverImage} alt="소설 표지" className="w-full h-full object-cover" />
            ) : (
              <PhotoIcon className="w-10 h-10 text-gray-500" />
            )}
          </div>
          <div className="flex-grow">
            <p className="text-sm text-gray-400 mb-3">
              AI가 소설의 내용을 바탕으로 표지를 생성합니다.
            </p>
            <button
              onClick={onClickGenerateCover}
              className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg text-sm"
            >
              {novel.coverImage ? '새 표지 생성하기' : '표지 이미지 생성'}
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* 담당 작가 */}
      <SettingsCard title="담당 작가">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={novel.aiAuthorId ?? ''}
            onChange={(e) => onUpdateNovel({ ...novel, aiAuthorId: e.target.value || null })}
            className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 text-white focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">기본 만능 작가</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {author.name} ({author.specialty})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWorkspaceImportOpen(true)}
              data-testid="settings-author-import"
              className="inline-flex flex-1 items-center justify-center gap-1.5 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-3 rounded-lg text-sm whitespace-nowrap"
            >
              <UserPlusIcon className="h-4 w-4" />
              작가 불러오기
            </button>
            <button
              type="button"
              onClick={() => setCreateAuthorModalOpen(true)}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-lg text-sm whitespace-nowrap"
            >
              새 작가 생성
            </button>
          </div>
        </div>
      </SettingsCard>

      {/* 핵심 연출 지침 */}
      <SettingsCard title="핵심 연출 지침 (AI 기억)" icon={<ClipboardDocumentListIcon className="w-5 h-5" />}>
        <p className="text-sm text-gray-400 mb-3">
          AI가 글을 쓸 때 반드시 따르는 영구적인 규칙들입니다. 제어 패널에서 피드백을 '승격'하여
          추가할 수 있습니다.
        </p>
        {novel.writingDirectives && novel.writingDirectives.length > 0 ? (
          <ul className="space-y-2">
            {novel.writingDirectives.map((directive, index) => (
              <li
                key={index}
                className="bg-gray-600 p-3 rounded-md flex items-center justify-between gap-4"
              >
                <p className="text-gray-300 text-sm flex-grow">
                  {directive.parts?.[0]?.text as string}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => onEditDirective(index, directive)}
                    className="p-1 text-gray-400 hover:text-indigo-400"
                    title="수정"
                  >
                    <PencilIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      requestConfirmation(
                        '지시사항 삭제',
                        <p>이 지시사항을 삭제하시겠습니까?</p>,
                        '삭제',
                        () => {
                        onUpdateNovel({
                          ...novel,
                          writingDirectives: (novel.writingDirectives || []).filter(
                            (_, i) => i !== index
                          ),
                        });
                        }
                      );
                    }}
                    className="p-1 text-gray-400 hover:text-red-400"
                    title="삭제"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 italic">
            확정된 지시사항이 없습니다. AI와의 대화나 제어 패널에서 좋은 아이디어를 채택하여 추가할
            수 있습니다.
          </p>
        )}
      </SettingsCard>

      {/* 작가 진화 */}
      <SettingsCard title="작가 진화">
        <p className="text-sm text-gray-400 mb-3">
          현재 소설의 작업 내역을 분석하여, 이 소설만의 스타일을 가진 새로운 AI 작가를 생성합니다.
        </p>
        <button
          onClick={onClickCloneAuthor}
          disabled={isCloningAuthor}
          className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-2 px-4 rounded-lg text-sm disabled:bg-teal-800 disabled:cursor-wait"
        >
          {isCloningAuthor ? '스타일 분석 중...' : '현재 스타일로 새 작가 만들기'}
        </button>
      </SettingsCard>

      {/* 위험 구역 */}
      <div className="border-t border-gray-600 pt-6 bg-red-900/20 p-4 rounded-lg">
        <h3 className="text-lg font-bold text-red-500 mb-2">위험 구역</h3>
        <p className="text-sm text-gray-400 mb-3">
          이 소설과 모든 챕터를 영구적으로 삭제합니다. 이 작업은 되돌릴 수 없습니다.
        </p>
        <button
          onClick={() => setNovelToDelete(novel)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg text-sm"
        >
          이 소설 삭제하기
        </button>
      </div>

      {isWorkspaceImportOpen && (
        <WorkspaceAuthorImportModal
          onClose={() => setWorkspaceImportOpen(false)}
          onImported={(author) => onUpdateNovel({ ...novel, aiAuthorId: author.id })}
        />
      )}
    </div>
  );
}

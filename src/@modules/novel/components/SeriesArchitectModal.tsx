/**
 * ============================================================
 * @module modules/novel/components
 * @file SeriesArchitectModal.tsx
 * ============================================================
 * @description 시리즈 아키텍트 - 전체 권 구조 설계 모달
 * ============================================================
 */

import { useState, useCallback, useRef } from 'react';
import type { Series, SeriesBlueprint, VolumeBlueprint, Novel } from '@core/types';
import { XMarkIcon, WandSparklesIcon, LockClosedIcon, LockOpenIcon, TrashIcon, ArrowPathIcon, toast, useConfirmDialog } from '@shared/components';
import { generateSeriesBlueprint, regenerateSingleVolume, rebalanceSeriesStructure } from '@services/ai';
import { createVolumeBlueprint, ensureSeriesVolumeIds, getVolumeDisplayLabel } from '@services/novel';

interface SeriesArchitectModalProps {
  series: Series;
  novelsInSeries: Novel[];
  onClose: () => void;
  onUpdateSeries: (updatedSeries: Series) => void;
}

type ViewMode = 'overview' | 'detail';

export function SeriesArchitectModal({
  series,
  novelsInSeries,
  onClose,
  onUpdateSeries,
}: SeriesArchitectModalProps) {
  const normalizedSeries = ensureSeriesVolumeIds(series);
  const initialBlueprint = normalizedSeries.blueprint || null;
  const [blueprint, setBlueprint] = useState<SeriesBlueprint | null>(initialBlueprint);
  const blueprintRef = useRef<SeriesBlueprint | null>(initialBlueprint);
  const applyBlueprint = useCallback((nextBlueprint: SeriesBlueprint | null) => {
    blueprintRef.current = nextBlueprint;
    setBlueprint(nextBlueprint);
  }, []);
  const [isGenerating, setIsGenerating] = useState(false);
  const [targetVolumeCount, setTargetVolumeCount] = useState(series.blueprint?.volumes.length || 5);
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedVolume, setSelectedVolume] = useState<VolumeBlueprint | null>(null);
  const [regeneratingVolumeNum, setRegeneratingVolumeNum] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const confirm = useConfirmDialog();

  // 청사진 최초 생성
  const handleGenerate = async () => {
    if (!series.seriesPlotSummary || series.seriesPlotSummary.trim().length < 20) {
      toast.warning('청사진을 생성하려면 시리즈 줄거리가 필요합니다. 최소 20자 이상 입력해주세요.');
      return;
    }
    const confirmed = await confirm({
      title: '시리즈 구조 생성',
      message: `AI가 ${targetVolumeCount}권 분량의 시리즈 구조를 설계합니다. 계속하시겠습니까?`,
      confirmText: '생성',
      variant: 'primary',
    });
    if (!confirmed) {
      return;
    }

    setIsGenerating(true);
    try {
      const newBlueprint = await generateSeriesBlueprint(series, targetVolumeCount);
      applyBlueprint(ensureSeriesVolumeIds({ ...series, blueprint: newBlueprint }).blueprint || newBlueprint);
      toast.success('시리즈 청사진이 생성되었습니다!');
    } catch (error) {
      toast.error(`청사진 생성 실패: ${(error as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 특정 권 재생성
  const handleRegenerateVolume = async (volumeId: string) => {
    if (!blueprint) return;
    const targetVolume = blueprint.volumes.find((volume) => volume.id === volumeId);
    if (!targetVolume) return;
    const confirmed = await confirm({
      title: `${getVolumeDisplayLabel(targetVolume)} 재생성`,
      message: `${getVolumeDisplayLabel(targetVolume)}의 설계를 재생성합니다. 기존 설계가 덮어씌워집니다.`,
      confirmText: '재생성',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setRegeneratingVolumeNum(targetVolume.volumeNumber);
    try {
      const newVolume = await regenerateSingleVolume(series, blueprint, targetVolume.volumeNumber);
      const updatedVolumes = blueprint.volumes.map(v =>
        v.id === volumeId ? { ...newVolume, id: v.id, isLocked: v.isLocked } : v
      );
      applyBlueprint({ ...blueprint, volumes: updatedVolumes, lastUpdated: Date.now() });
      setSelectedVolume((current) => current?.id === volumeId ? { ...newVolume, id: current.id } : current);
      toast.success(`${getVolumeDisplayLabel(targetVolume)} 설계가 재생성되었습니다.`);
    } catch (error) {
      toast.error(`재생성 실패: ${(error as Error).message}`);
    } finally {
      setRegeneratingVolumeNum(null);
    }
  };

  // 권 삭제
  const handleDeleteVolume = async (volumeId: string) => {
    if (!blueprint) return;
    const vol = blueprint.volumes.find(v => v.id === volumeId);
    if (!vol) return;
    if (vol?.isLocked) {
      toast.warning('잠긴 권은 삭제할 수 없습니다. 잠금을 먼저 해제하세요.');
      return;
    }
    const confirmed = await confirm({
      title: `${getVolumeDisplayLabel(vol)} 삭제`,
      message: `${getVolumeDisplayLabel(vol)} 계획만 삭제합니다. 연결된 작품과 원고는 삭제되지 않고 '권 미지정' 상태로 남습니다.`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) {
      return;
    }

    const updatedVolumes = blueprint.volumes.filter(v => v.id !== volumeId);

    applyBlueprint({ ...blueprint, volumes: updatedVolumes, lastUpdated: Date.now() });
    setSelectedVolume(null);
    setViewMode('overview');
    toast.success(`${getVolumeDisplayLabel(vol)} 계획이 삭제되었습니다. 기존 작품의 원고는 유지됩니다.`);
  };

  // 잠금 토글
  const handleToggleLock = (volumeId: string) => {
    if (!blueprint) return;
    const updatedVolumes = blueprint.volumes.map(v =>
      v.id === volumeId ? { ...v, isLocked: !v.isLocked } : v
    );
    applyBlueprint({ ...blueprint, volumes: updatedVolumes, lastUpdated: Date.now() });
    setSelectedVolume((current) => current?.id === volumeId
      ? { ...current, isLocked: !current.isLocked }
      : current);
  };

  // 전체 재균형
  const handleRebalance = async () => {
    if (!blueprint) return;
    const confirmed = await confirm({
      title: '시리즈 구조 재균형',
      message: 'AI가 시리즈 전체 구조를 재분석하고 균형을 조정합니다. 잠긴 권은 유지됩니다.',
      confirmText: '재균형',
      variant: 'primary',
    });
    if (!confirmed) {
      return;
    }

    setIsGenerating(true);
    try {
      const rebalanced = await rebalanceSeriesStructure(series, blueprint);
      applyBlueprint({ ...rebalanced, lastUpdated: Date.now() });
      toast.success('시리즈 구조가 재균형되었습니다.');
    } catch (error) {
      toast.error(`재균형 실패: ${(error as Error).message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // 새 권 추가
  const handleAddVolume = () => {
    if (!blueprint) return;
    const newVolumeNumber = Math.max(0, ...blueprint.volumes.map((volume) => volume.volumeNumber)) + 1;
    const newVolume = createVolumeBlueprint(newVolumeNumber);
    applyBlueprint({
      ...blueprint,
      volumes: [...blueprint.volumes, newVolume],
      lastUpdated: Date.now(),
    });
  };

  // 저장
  const handleSave = async () => {
    const latestBlueprint = blueprintRef.current;
    if (!latestBlueprint) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      await onUpdateSeries({ ...series, blueprint: latestBlueprint });
      toast.success('청사진이 저장되었습니다.');
      onClose();
    } catch (error) {
      toast.error(`청사진 저장 실패: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  // 수동 편집
  const handleEditVolume = useCallback((volumeId: string, field: keyof VolumeBlueprint, value: string) => {
    if (!blueprint) return;
    const updatedVolumes = blueprint.volumes.map(v =>
      v.id === volumeId ? { ...v, [field]: value } : v
    );
    applyBlueprint({ ...blueprint, volumes: updatedVolumes });
    setSelectedVolume((current) => current?.id === volumeId ? { ...current, [field]: value } : current);
  }, [applyBlueprint, blueprint]);

  const handleVolumeNumberChange = (volumeId: string, nextNumber: number) => {
    if (!blueprint || nextNumber < 1) return;
    const current = blueprint.volumes.find((volume) => volume.id === volumeId);
    if (!current || current.volumeNumber === nextNumber) return;
    const occupied = blueprint.volumes.find((volume) => volume.volumeNumber === nextNumber);
    const updateDefaultLabel = (volume: VolumeBlueprint, number: number) =>
      !volume.displayLabel?.trim() || volume.displayLabel === `${volume.volumeNumber}권`
        ? `${number}권`
        : volume.displayLabel;
    const volumes = blueprint.volumes.map((volume) => {
      if (volume.id === volumeId) {
        return { ...volume, volumeNumber: nextNumber, displayLabel: updateDefaultLabel(volume, nextNumber) };
      }
      if (occupied && volume.id === occupied.id) {
        return { ...volume, volumeNumber: current.volumeNumber, displayLabel: updateDefaultLabel(volume, current.volumeNumber) };
      }
      return volume;
    });
    applyBlueprint({ ...blueprint, volumes, lastUpdated: Date.now() });
    setSelectedVolume((selected) => selected?.id === volumeId
      ? { ...selected, volumeNumber: nextNumber, displayLabel: updateDefaultLabel(selected, nextNumber) }
      : selected);
  };

  const handleLinkNovel = async (volumeId: string, novelId: string) => {
    if (!blueprint) return;
    const target = blueprint.volumes.find((volume) => volume.id === volumeId);
    if (target?.linkedNovelId && novelId && target.linkedNovelId !== novelId) {
      const approved = await confirm({
        title: '연결 작품 교체',
        message: `${getVolumeDisplayLabel(target)}의 기존 연결을 풀고 선택한 작품으로 교체합니다. 두 작품의 원고는 삭제되지 않습니다.`,
        confirmText: '교체',
        variant: 'primary',
      });
      if (!approved) return;
    }
    const volumes = blueprint.volumes.map((volume) => {
      if (volume.linkedNovelId === novelId) return { ...volume, linkedNovelId: undefined };
      if (volume.id === volumeId) return { ...volume, linkedNovelId: novelId || undefined };
      return volume;
    });
    applyBlueprint({ ...blueprint, volumes, lastUpdated: Date.now() });
    setSelectedVolume((current) => current?.id === volumeId
      ? { ...current, linkedNovelId: novelId || undefined }
      : current);
  };

  const handleEditBlueprint = useCallback((field: keyof SeriesBlueprint, value: string) => {
    if (!blueprint) return;
    applyBlueprint({ ...blueprint, [field]: value });
  }, [applyBlueprint, blueprint]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-5xl relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>

        <h2 className="text-2xl font-bold mb-2 text-white flex items-center gap-2">
          📐 시리즈 아키텍트: {series.title}
        </h2>
        <p className="text-sm text-gray-400 mb-4">
          시리즈의 전체 권 구조를 설계합니다. AI가 각 권의 목표, 갈등, 핵심 사건을 미리 설계하여 일관된 서사를 유지할 수 있습니다.
        </p>

        {/* 탭 전환 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setViewMode('overview')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'overview'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            전체 개요
          </button>
          <button
            onClick={() => setViewMode('detail')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === 'detail'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            권별 상세
          </button>
        </div>

        {/* 청사진이 없을 때 */}
        {!blueprint && (
          <div className="flex-grow flex flex-col items-center justify-center py-12">
            <p className="text-gray-400 mb-6 text-center">
              아직 청사진이 없습니다.<br />
              AI 아키텍트가 시리즈 구조를 설계하게 하거나, 직접 작성할 수 있습니다.
            </p>
            <div className="flex items-center gap-4 mb-6">
              <label className="text-sm text-gray-300">목표 권 수:</label>
              <input
                type="number"
                min={2}
                max={20}
                value={targetVolumeCount}
                onChange={(e) => setTargetVolumeCount(Number(e.target.value))}
                className="w-20 bg-gray-900 border border-gray-600 rounded px-3 py-1 text-white"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-6 rounded-lg flex items-center gap-2 disabled:bg-gray-700"
              >
                <WandSparklesIcon className="w-5 h-5" />
                {isGenerating ? 'AI 설계 중...' : 'AI로 청사진 생성'}
              </button>
              <button
                onClick={() => {
                  // 빈 청사진 생성
                  const emptyBlueprint: SeriesBlueprint = {
                    worldview: '',
                    mainConflict: '',
                    characterArcs: '',
                    volumes: Array.from({ length: targetVolumeCount }, (_, i) => createVolumeBlueprint(i + 1)),
                    lastUpdated: Date.now(),
                  };
                  applyBlueprint(emptyBlueprint);
                }}
                className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-3 px-6 rounded-lg"
              >
                직접 작성하기
              </button>
            </div>
          </div>
        )}

        {/* 청사진이 있을 때 */}
        {blueprint && viewMode === 'overview' && (
          <div className="flex-grow overflow-y-auto pr-2 space-y-4">
            {/* 시리즈 전체 정보 */}
            <div className="bg-gray-900 rounded-lg p-4 space-y-3">
              <h3 className="text-lg font-semibold text-indigo-400">시리즈 메타 정보</h3>
              <div>
                <label className="block text-xs text-gray-400 mb-1">세계관 핵심</label>
                <textarea
                  value={blueprint.worldview}
                  onChange={(e) => handleEditBlueprint('worldview', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">메인 갈등</label>
                <textarea
                  value={blueprint.mainConflict}
                  onChange={(e) => handleEditBlueprint('mainConflict', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white"
                  rows={2}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">인물 성장 아크</label>
                <textarea
                  value={blueprint.characterArcs}
                  onChange={(e) => handleEditBlueprint('characterArcs', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white"
                  rows={2}
                />
              </div>
            </div>

            {/* 권 목록 미리보기 */}
            <div className="bg-gray-900 rounded-lg p-4">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-semibold text-indigo-400">
                  권 구조 ({blueprint.volumes.length}권)
                </h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddVolume}
                    className="text-sm bg-gray-700 hover:bg-gray-600 text-white py-1 px-3 rounded"
                  >
                    + 권 추가
                  </button>
                  <button
                    onClick={handleRebalance}
                    disabled={isGenerating}
                    className="text-sm bg-amber-600 hover:bg-amber-700 text-white py-1 px-3 rounded flex items-center gap-1 disabled:bg-gray-700"
                  >
                    <ArrowPathIcon className="w-4 h-4" />
                    재균형
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...blueprint.volumes].sort((a, b) => a.volumeNumber - b.volumeNumber).map((vol) => {
                  const linkedNovel = novelsInSeries.find(n => n.id === vol.linkedNovelId);
                  const progressLabel = vol.status === 'completed'
                    ? '완성'
                    : linkedNovel?.chapters.length
                      ? '집필 중'
                      : linkedNovel
                        ? '적용됨'
                        : '계획됨';
                  return (
                    <div
                      key={vol.id}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        vol.isLocked
                          ? 'bg-gray-700 border-amber-500'
                          : 'bg-gray-800 border-gray-600 hover:border-indigo-500'
                      }`}
                      onClick={() => {
                        setSelectedVolume(vol);
                        setViewMode('detail');
                      }}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-white">{getVolumeDisplayLabel(vol)}</span>
                        <div className="flex gap-1">
                          {vol.isLocked ? (
                            <LockClosedIcon className="w-4 h-4 text-amber-500" />
                          ) : (
                            <LockOpenIcon className="w-4 h-4 text-gray-500" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-indigo-300 truncate">{vol.title || '제목 없음'}</p>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{vol.goal || '목표 미설정'}</p>
                      <label className="block text-xs text-gray-400 mt-3 mb-1">연결 작품</label>
                      <select
                        value={vol.linkedNovelId || ''}
                        onClick={(event) => event.stopPropagation()}
                        onChange={(event) => handleLinkNovel(vol.id || '', event.target.value)}
                        className="w-full min-w-0 bg-gray-900 border border-gray-600 px-2 py-1.5 text-xs text-white"
                      >
                        <option value="">미연결 계획</option>
                        {novelsInSeries.map((novel) => (
                          <option key={novel.id} value={novel.id}>{novel.title}</option>
                        ))}
                      </select>
                      <span
                        className={`text-xs mt-2 inline-block px-2 py-0.5 rounded ${
                          progressLabel === '완성'
                            ? 'bg-green-600'
                            : progressLabel === '집필 중'
                            ? 'bg-blue-600'
                            : progressLabel === '적용됨'
                            ? 'bg-teal-700'
                            : 'bg-gray-600'
                        }`}
                      >
                        {progressLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 권별 상세 뷰 */}
        {blueprint && viewMode === 'detail' && (
          <div className="flex-grow overflow-y-auto pr-2">
            {/* 권 선택 드롭다운 */}
            <div className="flex items-center gap-4 mb-4">
              <select
                value={selectedVolume?.id || ''}
                onChange={(e) => {
                  const vol = blueprint.volumes.find(v => v.id === e.target.value);
                  setSelectedVolume(vol || null);
                }}
                className="bg-gray-900 border border-gray-600 rounded px-3 py-2 text-white"
              >
                <option value="">권 선택...</option>
                {[...blueprint.volumes].sort((a, b) => a.volumeNumber - b.volumeNumber).map((vol) => (
                  <option key={vol.id} value={vol.id}>
                    {getVolumeDisplayLabel(vol)} - {vol.title || '제목 없음'}
                  </option>
                ))}
              </select>
            </div>

            {selectedVolume && (
              <div className="bg-gray-900 rounded-lg p-4 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-white">
                    {getVolumeDisplayLabel(selectedVolume)} 상세 설정
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleToggleLock(selectedVolume.id || '')}
                      className={`text-sm py-1 px-3 rounded flex items-center gap-1 ${
                        selectedVolume.isLocked
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-gray-600 hover:bg-gray-500'
                      }`}
                    >
                      {selectedVolume.isLocked ? (
                        <>
                          <LockClosedIcon className="w-4 h-4" />
                          잠금 해제
                        </>
                      ) : (
                        <>
                          <LockOpenIcon className="w-4 h-4" />
                          Canon 잠금
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRegenerateVolume(selectedVolume.id || '')}
                      disabled={regeneratingVolumeNum === selectedVolume.volumeNumber || selectedVolume.isLocked}
                      className="text-sm bg-teal-600 hover:bg-teal-700 text-white py-1 px-3 rounded flex items-center gap-1 disabled:bg-gray-700"
                    >
                      <WandSparklesIcon className="w-4 h-4" />
                      {regeneratingVolumeNum === selectedVolume.volumeNumber ? '재생성 중...' : 'AI 재생성'}
                    </button>
                    <button
                      onClick={() => handleDeleteVolume(selectedVolume.id || '')}
                      disabled={selectedVolume.isLocked}
                      className="text-sm bg-red-600 hover:bg-red-700 text-white py-1 px-3 rounded flex items-center gap-1 disabled:bg-gray-700"
                    >
                      <TrashIcon className="w-4 h-4" />
                      삭제
                    </button>
                  </div>
                </div>

                {selectedVolume.isLocked && (
                  <div className="bg-amber-900/30 border border-amber-500 rounded p-3 text-sm text-amber-200">
                    ⚠️ 이 권은 Canon으로 잠겨있습니다. 이미 집필된 내용이 있어 AI가 수정할 수 없습니다.
                    편집이 필요하면 잠금을 해제하세요.
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">표시 권수·순서</label>
                    <input
                      type="number"
                      min="1"
                      value={selectedVolume.volumeNumber}
                      onChange={(e) => handleVolumeNumberChange(selectedVolume.id || '', Number(e.target.value))}
                      disabled={selectedVolume.isLocked}
                      className="w-full bg-gray-800 border border-gray-600 p-2 text-white disabled:opacity-50"
                    />
                    <p className="mt-1 text-xs text-gray-500">이미 있는 권수로 바꾸면 두 권의 순서가 서로 교환됩니다.</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">표시 헤더</label>
                    <input
                      type="text"
                      value={selectedVolume.displayLabel || ''}
                      onChange={(e) => handleEditVolume(selectedVolume.id || '', 'displayLabel', e.target.value)}
                      disabled={selectedVolume.isLocked}
                      placeholder={`${selectedVolume.volumeNumber}권 또는 외전 A`}
                      className="w-full bg-gray-800 border border-gray-600 p-2 text-white disabled:opacity-50"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">이 계획에 연결할 작품</label>
                  <select
                    value={selectedVolume.linkedNovelId || ''}
                    onChange={(e) => handleLinkNovel(selectedVolume.id || '', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-600 p-2 text-white"
                  >
                    <option value="">미연결 계획으로 보관</option>
                    {novelsInSeries.map((novel) => (
                      <option key={novel.id} value={novel.id}>{novel.title}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">권 제목</label>
                  <input
                    type="text"
                    value={selectedVolume.title}
                    onChange={(e) => handleEditVolume(selectedVolume.id || '', 'title', e.target.value)}
                    disabled={selectedVolume.isLocked}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-white disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">이 권만의 설정·변주</label>
                  <textarea
                    value={selectedVolume.localSetting || ''}
                    onChange={(e) => handleEditVolume(selectedVolume.id || '', 'localSetting', e.target.value)}
                    disabled={selectedVolume.isLocked}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white disabled:opacity-50"
                    rows={3}
                    placeholder="예: 이번 권의 지역, 조직, 계절, 분위기, 한시적 규칙. 시리즈 공통 세계관은 위에서 별도로 유지됩니다."
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">이 권의 목표</label>
                  <textarea
                    value={selectedVolume.goal}
                    onChange={(e) => handleEditVolume(selectedVolume.id || '', 'goal', e.target.value)}
                    disabled={selectedVolume.isLocked}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white disabled:opacity-50"
                    rows={3}
                    placeholder="이 권에서 달성하고자 하는 서사적 목표"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">주요 갈등</label>
                  <textarea
                    value={selectedVolume.mainConflict}
                    onChange={(e) => handleEditVolume(selectedVolume.id || '', 'mainConflict', e.target.value)}
                    disabled={selectedVolume.isLocked}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white disabled:opacity-50"
                    rows={3}
                    placeholder="이 권의 핵심 갈등 구조"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">핵심 사건</label>
                  <textarea
                    value={selectedVolume.keyEvents}
                    onChange={(e) => handleEditVolume(selectedVolume.id || '', 'keyEvents', e.target.value)}
                    disabled={selectedVolume.isLocked}
                    className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm text-white disabled:opacity-50"
                    rows={4}
                    placeholder="이 권에서 반드시 일어나야 하는 핵심 사건들"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 mb-1">상태</label>
                  <select
                    value={selectedVolume.status}
                    onChange={(e) => handleEditVolume(selectedVolume.id || '', 'status', e.target.value)}
                    disabled={selectedVolume.isLocked}
                    className="bg-gray-800 border border-gray-600 rounded px-3 py-2 text-white disabled:opacity-50"
                  >
                    <option value="planned">계획됨</option>
                    <option value="drafting">집필 중</option>
                    <option value="completed">완성</option>
                  </select>
                </div>
              </div>
            )}

            {!selectedVolume && (
              <div className="flex items-center justify-center h-64 text-gray-400">
                권을 선택하면 상세 설정을 편집할 수 있습니다.
              </div>
            )}
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex justify-end items-center pt-4 mt-4 border-t border-gray-700 gap-3">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 font-bold py-2 px-4 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!blueprint || isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 font-bold py-2 px-4 rounded-lg disabled:bg-gray-700"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

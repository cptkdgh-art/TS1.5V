import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  AiAuthor,
  Novel,
  ProductionPackage,
  ProductionPackagePurpose,
  ProductionPackageReceipt,
  ProductionPackageSection,
  ProductionPackageSectionSelection,
  Series,
  StudioWorkspace,
} from '@core/types';
import {
  COMMISSION_PACKAGE_SECTIONS,
  createProductionPackage,
  DELIVERY_PACKAGE_SECTIONS,
  importProductionPackage,
  parseProductionPackage,
  PLANNING_PACKAGE_SECTIONS,
  PRODUCTION_PACKAGE_SECTIONS,
  recordProductionPackageExport,
} from '@services/production-package';
import { readWorkspaceBackupContent } from '@services/studio-backup';
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  CheckCircleIcon,
  CubeIcon,
  ExclamationTriangleIcon,
  Modal,
  toast,
} from '@shared/components';

interface ProductionPackageCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWorkspace: StudioWorkspace;
  workspaces: StudioWorkspace[];
  authors: AiAuthor[];
  novels: Novel[];
  series: Series[];
  onCreateWorkspace: (name: string) => Promise<StudioWorkspace>;
  onImported: (workspaceId: string) => Promise<void>;
}

const SECTION_LABELS: Record<ProductionPackageSection, { title: string; description: string }> = {
  authors: { title: '담당 작가', description: '작가 프로필과 집필 지침' },
  workCore: { title: '작품 기본정보', description: '제목, 줄거리, 목표 분량' },
  planning: { title: '기획·집필 설정', description: '트리트먼트, 아크, 복선, 문체 설정' },
  worldbuilding: { title: '세계관·인물', description: '세계관 파일과 등장인물' },
  manuscript: { title: '원고', description: '저장된 챕터 본문' },
  memory: { title: '기억·요약', description: '작품 기억, 화별 요약, 스냅샷' },
  collaboration: { title: '지시·협업 기록', description: '글쓰기 지시와 방향성 대화' },
  assets: { title: '이미지', description: '표지 이미지 포함' },
};

const PURPOSE_LABELS: Record<ProductionPackagePurpose, string> = {
  planning: '기획안 전달',
  commission: '집필 의뢰',
  continuation: '이어쓰기 의뢰',
  delivery: '원고 납품',
  'settings-share': '설정 공유',
};

function triggerDownload(value: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(url);
  }, 1000);
}

function safeFilename(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_').trim() || '제작패키지';
}

function SectionGrid({
  value,
  available,
  onChange,
}: {
  value: ProductionPackageSectionSelection;
  available?: ProductionPackageSectionSelection;
  onChange: (value: ProductionPackageSectionSelection) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" data-testid="production-package-sections">
      {PRODUCTION_PACKAGE_SECTIONS.map((section) => {
        const disabled = available ? !available[section] : false;
        return (
          <label
            key={section}
            className={`flex min-h-16 items-start gap-3 rounded-lg border p-3 transition-colors ${
              value[section] && !disabled
                ? 'border-emerald-500 bg-emerald-950/30'
                : 'border-gray-700 bg-gray-900/50'
            } ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer hover:border-gray-600'}`}
          >
            <input
              type="checkbox"
              checked={value[section] && !disabled}
              disabled={disabled}
              onChange={(event) => onChange({ ...value, [section]: event.target.checked })}
              className="mt-1 h-4 w-4 accent-emerald-500"
            />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-gray-100">{SECTION_LABELS[section].title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-gray-400">{SECTION_LABELS[section].description}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}

export function ProductionPackageCenterModal({
  isOpen,
  onClose,
  activeWorkspace,
  workspaces,
  authors,
  novels,
  series,
  onCreateWorkspace,
  onImported,
}: ProductionPackageCenterModalProps) {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [purpose, setPurpose] = useState<ProductionPackagePurpose>('planning');
  const [exportTarget, setExportTarget] = useState('authors');
  const [packageTitle, setPackageTitle] = useState('진폭 제작 패키지');
  const [exportSections, setExportSections] = useState<ProductionPackageSectionSelection>(PLANNING_PACKAGE_SECTIONS);
  const [selectedExportAuthorIds, setSelectedExportAuthorIds] = useState<string[]>([]);
  const [workspaceReceipts, setWorkspaceReceipts] = useState<ProductionPackageReceipt[]>([]);

  const fileRef = useRef<HTMLInputElement>(null);
  const [incoming, setIncoming] = useState<ProductionPackage | null>(null);
  const [importSections, setImportSections] = useState<ProductionPackageSectionSelection>(PLANNING_PACKAGE_SECTIONS);
  const [selectedImportAuthorIds, setSelectedImportAuthorIds] = useState<string[]>([]);
  const [selectedImportNovelIds, setSelectedImportNovelIds] = useState<string[]>([]);
  const [destination, setDestination] = useState<string>('new');
  const [destinationNovels, setDestinationNovels] = useState<Novel[]>([]);
  const [targetNovelId, setTargetNovelId] = useState('');
  const [importMode, setImportMode] = useState<'copy' | 'merge'>('copy');
  const [manuscriptMode, setManuscriptMode] = useState<'append' | 'replace'>('append');
  const [isImporting, setIsImporting] = useState(false);

  const exportNovelIds = useMemo(() => {
    if (exportTarget.startsWith('novel:')) return [exportTarget.slice(6)];
    if (exportTarget.startsWith('series:')) {
      return series.find((item) => item.id === exportTarget.slice(7))?.novelIds ?? [];
    }
    return [];
  }, [exportTarget, series]);

  useEffect(() => {
    if (!isOpen) return;
    if (authors.length > 0 && selectedExportAuthorIds.length === 0) {
      setSelectedExportAuthorIds(authors.filter((author) => !author.isDefault).map((author) => author.id));
    }
  }, [authors, isOpen, selectedExportAuthorIds.length]);

  useEffect(() => {
    if (!isOpen) return;
    void readWorkspaceBackupContent(activeWorkspace.id).then((content) => {
      setWorkspaceReceipts(content.productionPackageReceipts ?? []);
    });
  }, [activeWorkspace.id, isOpen]);

  useEffect(() => {
    if (exportTarget === 'authors') {
      setPackageTitle('AI 작가 제작 패키지');
      setExportSections({
        authors: true,
        workCore: false,
        planning: false,
        worldbuilding: false,
        manuscript: false,
        memory: false,
        collaboration: false,
        assets: false,
      });
      return;
    }
    const selectedNovel = novels.find((novel) => novel.id === exportNovelIds[0]);
    const selectedSeries = series.find((item) => exportTarget === `series:${item.id}`);
    setPackageTitle(`${selectedSeries?.title ?? selectedNovel?.title ?? '작품'} 제작 패키지`);
  }, [exportNovelIds, exportTarget, novels, series]);

  useEffect(() => {
    if (destination === 'new') {
      setDestinationNovels([]);
      setTargetNovelId('');
      setImportMode('copy');
      return;
    }
    void readWorkspaceBackupContent(destination).then((content) => {
      setDestinationNovels(content.novels);
      const lineageReceipt = incoming
        ? [...(content.productionPackageReceipts ?? [])]
          .reverse()
          .find((receipt) => receipt.lineageId === incoming.package.lineageId)
        : undefined;
      const linkedNovelId = lineageReceipt
        ? Object.values(lineageReceipt.idMap.novels).find((id) => content.novels.some((novel) => novel.id === id))
        : undefined;
      setTargetNovelId(linkedNovelId ?? content.novels[0]?.id ?? '');
      if (linkedNovelId && incoming?.payload.novels.length === 1) setImportMode('merge');
    });
  }, [destination, incoming]);

  const applyPreset = (nextPurpose: ProductionPackagePurpose) => {
    setPurpose(nextPurpose);
    if (nextPurpose === 'planning' || nextPurpose === 'settings-share') {
      setExportSections(PLANNING_PACKAGE_SECTIONS);
    } else if (nextPurpose === 'delivery') {
      setExportSections(DELIVERY_PACKAGE_SECTIONS);
    } else {
      setExportSections(COMMISSION_PACKAGE_SECTIONS);
    }
  };

  const handleExport = async () => {
    if (exportTarget === 'authors' && selectedExportAuthorIds.length === 0) {
      toast.error('보낼 작가를 한 명 이상 골라 주세요.');
      return;
    }
    if (exportTarget !== 'authors' && exportNovelIds.length === 0) {
      toast.error('보낼 작품이나 시리즈를 골라 주세요.');
      return;
    }
    const relatedAuthorIds = exportTarget === 'authors'
      ? selectedExportAuthorIds
      : novels
        .filter((novel) => exportNovelIds.includes(novel.id) && novel.aiAuthorId)
        .map((novel) => novel.aiAuthorId as string);
    const previousReceipt = [...workspaceReceipts]
      .reverse()
      .find((receipt) => exportNovelIds.some((id) => Object.values(receipt.idMap.novels).includes(id)));
    const productionPackage = createProductionPackage({
      workspace: activeWorkspace,
      authors,
      novels,
      series,
      selectedAuthorIds: relatedAuthorIds,
      selectedNovelIds: exportNovelIds,
      sections: exportSections,
      purpose,
      title: packageTitle,
      lineageId: previousReceipt?.lineageId,
      revision: previousReceipt ? previousReceipt.revision + 1 : 1,
      parentPackageId: previousReceipt?.packageId ?? null,
    });
    try {
      const receipt = await recordProductionPackageExport(activeWorkspace.id, productionPackage);
      setWorkspaceReceipts((current) => [...current, receipt]);
    } catch {
      toast.error('패키지 연결 기록을 저장하지 못했습니다. 다시 시도해 주세요.');
      return;
    }
    const date = new Date().toISOString().slice(0, 10);
    triggerDownload(productionPackage, `진폭_제작패키지_${safeFilename(packageTitle)}_${date}.jinpok.json`);
    toast.success('선택한 정보만 제작 패키지로 묶었습니다.');
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = typeof reader.result === 'string'
          ? parseProductionPackage(JSON.parse(reader.result))
          : null;
        if (!parsed) {
          toast.error('제작 패키지 형식이 아니거나 파일이 손상됐습니다.');
          return;
        }
        setIncoming(parsed);
        setImportSections(parsed.manifest.sections);
        setSelectedImportAuthorIds(parsed.payload.authors.map((author) => author.id));
        setSelectedImportNovelIds(parsed.payload.novels.map((novel) => novel.id));
        setDestination('new');
        setImportMode('copy');
        setTab('import');
      } catch {
        toast.error('JSON 파일을 읽지 못했습니다.');
      }
    };
    reader.onerror = () => toast.error('파일을 읽는 중 오류가 발생했습니다.');
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (!incoming || isImporting) return;
    if (selectedImportAuthorIds.length === 0 && selectedImportNovelIds.length === 0) {
      toast.error('가져올 작가나 작품을 골라 주세요.');
      return;
    }
    if (importMode === 'merge' && (selectedImportNovelIds.length !== 1 || !targetNovelId)) {
      toast.error('기존 작품 반영은 패키지 작품 하나와 대상 작품 하나를 골라 주세요.');
      return;
    }
    setIsImporting(true);
    try {
      const targetWorkspace = destination === 'new'
        ? await onCreateWorkspace(incoming.package.title)
        : workspaces.find((workspace) => workspace.id === destination);
      if (!targetWorkspace) throw new Error('가져올 작업실을 찾지 못했습니다.');
      const result = await importProductionPackage(incoming, {
        targetWorkspaceId: targetWorkspace.id,
        mode: importMode,
        sections: importSections,
        selectedAuthorIds: selectedImportAuthorIds,
        selectedNovelIds: selectedImportNovelIds,
        targetNovelId: importMode === 'merge' ? targetNovelId : undefined,
        manuscriptMode,
      });
      await onImported(targetWorkspace.id);
      toast.success(result.mergedNovelTitle
        ? `"${result.mergedNovelTitle}"에 선택한 정보만 반영했습니다.`
        : `${targetWorkspace.slot} · ${targetWorkspace.name}에 작가 ${result.importedAuthors}명, 작품 ${result.importedNovels}개를 넣었습니다.`);
      setIncoming(null);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '제작 패키지를 가져오지 못했습니다.');
    } finally {
      setIsImporting(false);
    }
  };

  const selectedImportChapters = incoming?.payload.novels
    .filter((novel) => selectedImportNovelIds.includes(novel.id))
    .reduce((sum, novel) => sum + novel.chapters.length, 0) ?? 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="제작 패키지 센터" size="full" isDismissible={!isImporting}>
      <div className="space-y-5" data-testid="production-package-center">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-gray-900 p-1">
          <button
            type="button"
            onClick={() => setTab('export')}
            className={`h-10 rounded-md text-sm font-semibold ${tab === 'export' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            패키지 보내기
          </button>
          <button
            type="button"
            onClick={() => setTab('import')}
            className={`h-10 rounded-md text-sm font-semibold ${tab === 'import' ? 'bg-emerald-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            패키지 가져오기
          </button>
        </div>

        {tab === 'export' ? (
          <div className="space-y-5">
            <section className="space-y-2">
              <label htmlFor="package-export-target" className="text-sm font-semibold text-gray-200">무엇을 보낼까?</label>
              <select
                id="package-export-target"
                data-testid="package-export-target"
                value={exportTarget}
                onChange={(event) => setExportTarget(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
              >
                <option value="authors">AI 작가만</option>
                {novels.filter((novel) => !novel.seriesId).map((novel) => (
                  <option key={novel.id} value={`novel:${novel.id}`}>독립 작품 · {novel.title}</option>
                ))}
                {series.map((item) => (
                  <option key={item.id} value={`series:${item.id}`}>시리즈 · {item.title}</option>
                ))}
              </select>
            </section>

            {exportTarget === 'authors' && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-200">보낼 작가</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  {authors.map((author) => (
                    <label key={author.id} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-sm text-gray-200">
                      <input
                        type="checkbox"
                        checked={selectedExportAuthorIds.includes(author.id)}
                        onChange={(event) => setSelectedExportAuthorIds(event.target.checked
                          ? [...selectedExportAuthorIds, author.id]
                          : selectedExportAuthorIds.filter((id) => id !== author.id))}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      <span>{author.name}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            {exportTarget !== 'authors' && (
              <section className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-200">용도</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(['planning', 'commission', 'continuation', 'delivery'] as ProductionPackagePurpose[]).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => applyPreset(item)}
                      className={`min-h-10 rounded-lg border px-2 text-xs font-semibold ${purpose === item ? 'border-emerald-500 bg-emerald-950/40 text-emerald-200' : 'border-gray-700 bg-gray-900 text-gray-300'}`}
                    >
                      {PURPOSE_LABELS[item]}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-gray-200">패키지에 넣을 정보</h3>
                <p className="mt-1 text-xs text-gray-500">체크한 정보만 JSON에 들어가요. API 키와 서버 캐시는 항상 빠집니다.</p>
              </div>
              <SectionGrid
                value={exportSections}
                available={exportTarget === 'authors' ? {
                  authors: true,
                  workCore: false,
                  planning: false,
                  worldbuilding: false,
                  manuscript: false,
                  memory: true,
                  collaboration: true,
                  assets: false,
                } : undefined}
                onChange={setExportSections}
              />
            </section>

            <section className="space-y-2">
              <label htmlFor="package-title" className="text-sm font-semibold text-gray-200">패키지 이름</label>
              <input
                id="package-title"
                value={packageTitle}
                onChange={(event) => setPackageTitle(event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white outline-none focus:border-emerald-500"
              />
            </section>

            <div className="flex items-center justify-between gap-3 border-t border-gray-700 pt-4">
              <p className="text-xs leading-5 text-gray-500">현재 작업실 자료는 바뀌지 않습니다.</p>
              <button
                type="button"
                onClick={() => void handleExport()}
                data-testid="package-export-button"
                className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                <ArrowDownTrayIcon className="h-5 w-5" />
                JSON 만들기
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <input
              ref={fileRef}
              type="file"
              accept=".json,.jinpok.json,application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) handleFile(file);
                event.target.value = '';
              }}
            />
            {!incoming ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                data-testid="package-file-button"
                className="flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-600 bg-gray-900/50 px-5 text-center hover:border-emerald-500 hover:bg-emerald-950/20"
              >
                <CubeIcon className="h-10 w-10 text-emerald-400" />
                <span className="font-semibold text-white">받은 제작 패키지 JSON 열기</span>
                <span className="text-xs text-gray-500">열어본 뒤 가져올 정보와 들어갈 위치를 고를 수 있어요.</span>
              </button>
            ) : (
              <>
                <section className="rounded-lg border border-emerald-800 bg-emerald-950/20 p-4">
                  <div className="flex items-start gap-3">
                    <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white">{incoming.package.title}</h3>
                      <p className="mt-1 text-xs text-gray-400">
                        {incoming.sourceWorkspace.name} · 작가 {incoming.payload.authors.length}명 · 작품 {incoming.payload.novels.length}개 · 원고 {incoming.manifest.counts.chapters}화
                      </p>
                    </div>
                    <button type="button" onClick={() => setIncoming(null)} className="ml-auto text-xs text-gray-400 hover:text-white">다른 파일</button>
                  </div>
                </section>

                {incoming.payload.authors.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-200">가져올 작가</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {incoming.payload.authors.map((author) => (
                        <label key={author.id} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-sm text-gray-200">
                          <input
                            type="checkbox"
                            checked={selectedImportAuthorIds.includes(author.id)}
                            onChange={(event) => setSelectedImportAuthorIds(event.target.checked
                              ? [...selectedImportAuthorIds, author.id]
                              : selectedImportAuthorIds.filter((id) => id !== author.id))}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          {author.name}
                        </label>
                      ))}
                    </div>
                  </section>
                )}

                {incoming.payload.novels.length > 0 && (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold text-gray-200">가져올 작품</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {incoming.payload.novels.map((novel) => (
                        <label key={novel.id} className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900/60 p-3 text-sm text-gray-200">
                          <input
                            type="checkbox"
                            checked={selectedImportNovelIds.includes(novel.id)}
                            onChange={(event) => setSelectedImportNovelIds(event.target.checked
                              ? [...selectedImportNovelIds, novel.id]
                              : selectedImportNovelIds.filter((id) => id !== novel.id))}
                            className="h-4 w-4 accent-emerald-500"
                          />
                          <span className="min-w-0 truncate">{novel.title} <span className="text-gray-500">({novel.chapters.length}화)</span></span>
                        </label>
                      ))}
                    </div>
                  </section>
                )}

                <section className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-200">가져올 정보</h3>
                  <SectionGrid value={importSections} available={incoming.manifest.sections} onChange={setImportSections} />
                </section>

                <section className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-2 text-sm font-semibold text-gray-200">
                    <span className="block">들어갈 위치</span>
                    <select
                      value={destination}
                      onChange={(event) => setDestination(event.target.value)}
                      data-testid="package-import-destination"
                      className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white"
                    >
                      <option value="new">+ 새 작업실로 안전하게 입고</option>
                      {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>{workspace.slot} · {workspace.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-2 text-sm font-semibold text-gray-200">
                    <span className="block">넣는 방식</span>
                    <select
                      value={importMode}
                      onChange={(event) => setImportMode(event.target.value as 'copy' | 'merge')}
                      disabled={destination === 'new'}
                      className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white disabled:opacity-50"
                    >
                      <option value="copy">새 자료로 추가</option>
                      <option value="merge">기존 작품에 선택 정보만 반영</option>
                    </select>
                  </label>
                </section>

                {importMode === 'merge' && destination !== 'new' && (
                  <section className="grid gap-3 rounded-lg border border-amber-800 bg-amber-950/20 p-4 sm:grid-cols-2">
                    <label className="space-y-2 text-sm font-semibold text-gray-200">
                      <span className="block">반영할 기존 작품</span>
                      <select value={targetNovelId} onChange={(event) => setTargetNovelId(event.target.value)} className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white">
                        {destinationNovels.map((novel) => <option key={novel.id} value={novel.id}>{novel.title}</option>)}
                      </select>
                    </label>
                    {importSections.manuscript && (
                      <label className="space-y-2 text-sm font-semibold text-gray-200">
                        <span className="block">원고 처리</span>
                        <select value={manuscriptMode} onChange={(event) => setManuscriptMode(event.target.value as 'append' | 'replace')} className="h-11 w-full rounded-lg border border-gray-700 bg-gray-900 px-3 text-sm text-white">
                          <option value="append">기존 원고 뒤에 이어 붙이기</option>
                          <option value="replace">기존 원고 교체 후 복구본 남기기</option>
                        </select>
                      </label>
                    )}
                  </section>
                )}

                <section className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 text-sm">
                  <h3 className="font-semibold text-white">입고 전 확인</h3>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                    <div><strong className="block text-lg text-emerald-300">{selectedImportAuthorIds.length}</strong><span className="text-xs text-gray-500">작가</span></div>
                    <div><strong className="block text-lg text-emerald-300">{selectedImportNovelIds.length}</strong><span className="text-xs text-gray-500">작품</span></div>
                    <div><strong className="block text-lg text-emerald-300">{importSections.manuscript ? selectedImportChapters : 0}</strong><span className="text-xs text-gray-500">원고 화수</span></div>
                  </div>
                  {importMode === 'merge' && (
                    <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-amber-300">
                      <ExclamationTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                      체크한 정보만 기존 작품에 반영됩니다. 체크하지 않은 정보는 그대로 유지됩니다.
                    </p>
                  )}
                </section>

                <div className="flex justify-end border-t border-gray-700 pt-4">
                  <button
                    type="button"
                    onClick={() => void handleImport()}
                    disabled={isImporting}
                    data-testid="package-import-button"
                    className="flex h-11 items-center gap-2 rounded-lg bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    <ArrowUpTrayIcon className="h-5 w-5" />
                    {isImporting ? '가져오는 중...' : '선택한 정보 가져오기'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}

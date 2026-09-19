import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CharacterChatCandidate,
  CharacterChatModel,
  CharacterChatSource,
  Novel,
  Series,
} from '@core/types';
import {
  ArrowLeftIcon,
  BookOpenIcon,
  DocumentTextIcon,
  PlusIcon,
  UserGroupIcon,
  WandSparklesIcon,
  useConfirmDialog,
} from '@shared/components';
import { extractCharacterChatCandidates } from '@services/ai';
import {
  DEFAULT_CHARACTER_CHAT_MODEL,
  createManualChatSource,
  createNovelChatSource,
  createTextChatSource,
  getNovelSourceCharacters,
  registeredCharacterToCandidate,
} from '@services/character-chat';
import { ModelSelect } from './ModelSelect';

type ImportMode = 'novel' | 'text' | 'manual';

interface SourceImportViewProps {
  novels: Novel[];
  series: Series[];
  onBack: () => void;
  onSelect: (source: CharacterChatSource, candidate: CharacterChatCandidate, model: CharacterChatModel) => void;
}

function normalizeName(name: string) {
  return name.replace(/\s+/g, '').toLowerCase();
}

function combineCandidates(registered: CharacterChatCandidate[], detected: CharacterChatCandidate[]) {
  const known = new Set(registered.map((candidate) => normalizeName(candidate.name)));
  return [...registered, ...detected.filter((candidate) => !known.has(normalizeName(candidate.name)))];
}

export function SourceImportView({ novels, series, onBack, onSelect }: SourceImportViewProps) {
  const [mode, setMode] = useState<ImportMode>(novels.length > 0 ? 'novel' : 'manual');
  const [model, setModel] = useState<CharacterChatModel>(DEFAULT_CHARACTER_CHAT_MODEL);
  const [selectedNovelId, setSelectedNovelId] = useState(novels[0]?.id || '');
  const [knowledgeChapterCount, setKnowledgeChapterCount] = useState(novels[0]?.chapters.length || 0);
  const [detectedCandidates, setDetectedCandidates] = useState<CharacterChatCandidate[]>([]);
  const [analysisSource, setAnalysisSource] = useState<CharacterChatSource | null>(null);
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [manualName, setManualName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const confirm = useConfirmDialog();
  const analysisGeneration = useRef(0);
  const mounted = useRef(true);

  const selectedNovel = novels.find((novel) => novel.id === selectedNovelId) || null;
  const selectedSeries = selectedNovel?.seriesId
    ? series.find((item) => item.id === selectedNovel.seriesId) || null
    : null;
  const isFullCanon = Boolean(selectedNovel && knowledgeChapterCount >= selectedNovel.chapters.length);
  const registeredCandidates = useMemo(() => {
    if (!selectedNovel) return [];
    return getNovelSourceCharacters(selectedNovel, selectedSeries)
      .map((character) => registeredCharacterToCandidate(character, isFullCanon));
  }, [selectedNovel, selectedSeries, isFullCanon]);
  const sourceSignature = useMemo(
    () => JSON.stringify([mode, model, selectedNovel, selectedSeries, knowledgeChapterCount, textTitle, textContent]),
    [mode, model, selectedNovel, selectedSeries, knowledgeChapterCount, textTitle, textContent]
  );
  const currentSignature = useRef(sourceSignature);
  currentSignature.current = sourceSignature;
  const [analysisSignature, setAnalysisSignature] = useState('');
  const validDetectedCandidates = analysisSignature === sourceSignature ? detectedCandidates : [];
  const candidates = combineCandidates(registeredCandidates, validDetectedCandidates);
  const knowledgeNovelId = useRef(selectedNovelId);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; analysisGeneration.current += 1; };
  }, []);

  useEffect(() => {
    analysisGeneration.current += 1;
    setIsAnalyzing(false);
    setDetectedCandidates([]);
    setAnalysisSource(null);
    setProgress('');
  }, [sourceSignature]);

  useEffect(() => {
    if (!selectedNovel) return;
    const novelChanged = knowledgeNovelId.current !== selectedNovelId;
    knowledgeNovelId.current = selectedNovelId;
    setKnowledgeChapterCount((current) => novelChanged ? selectedNovel.chapters.length : Math.min(current, selectedNovel.chapters.length));
    setDetectedCandidates([]);
    setAnalysisSource(null);
  }, [selectedNovelId, selectedNovel]);

  const buildNovelSource = () => {
    if (!selectedNovel) return null;
    return createNovelChatSource(selectedNovel, selectedSeries, knowledgeChapterCount);
  };

  const runAnalysis = async (source: CharacterChatSource, signature: string) => {
    if (!mounted.current || currentSignature.current !== signature) return;
    const generation = ++analysisGeneration.current;
    const isCurrent = () => mounted.current && generation === analysisGeneration.current && currentSignature.current === signature;
    setIsAnalyzing(true);
    setError('');
    setProgress('분석 준비 중...');
    try {
      const found = await extractCharacterChatCandidates(source, model, (completed, total) => {
        if (isCurrent()) setProgress(`원고 분석 ${completed}/${total}`);
      });
      if (!isCurrent()) return;
      setDetectedCandidates(found);
      setAnalysisSource(source);
      setAnalysisSignature(signature);
      setProgress(`${found.length}명의 후보를 찾았어.`);
    } catch (analysisError) {
      if (!isCurrent()) return;
      setError(analysisError instanceof Error ? analysisError.message : '캐릭터 분석에 실패했습니다.');
      setProgress('');
    } finally {
      if (isCurrent()) setIsAnalyzing(false);
    }
  };

  const handleNovelAnalysis = async () => {
    const signature = sourceSignature;
    const source = buildNovelSource();
    if (!source || !source.text.trim()) {
      setError('분석할 챕터 본문이 없습니다.');
      return;
    }
    const approved = await confirm({
      title: '캐릭터 추출',
      message: <p><b>{source.title}</b>의 선택한 원고 범위를 Gemini에 보내 등장인물을 분석합니다.</p>,
      confirmText: '분석 시작',
    });
    if (approved) await runAnalysis(source, signature);
  };

  const handleTextFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 12 * 1024 * 1024) {
      setError('TXT 파일은 12MB 이하로 선택해 주세요.');
      return;
    }
    const generation = ++analysisGeneration.current;
    const signature = currentSignature.current;
    const content = await file.text();
    if (!mounted.current || generation !== analysisGeneration.current || signature !== currentSignature.current) return;
    setTextTitle(file.name.replace(/\.(txt|md)$/i, ''));
    setTextContent(content);
    setDetectedCandidates([]);
    setAnalysisSource(null);
  };

  const handleTextAnalysis = async () => {
    const signature = sourceSignature;
    if (!textContent.trim()) {
      setError('TXT 파일을 선택하거나 원문을 붙여넣어 주세요.');
      return;
    }
    const source = createTextChatSource(textTitle, textContent);
    const approved = await confirm({
      title: '외부 원고 캐릭터 추출',
      message: <p><b>{source.title}</b> 원문을 Gemini에 보내 등장인물을 분석합니다.</p>,
      confirmText: '분석 시작',
    });
    if (approved) await runAnalysis(source, signature);
  };

  const handleCandidateSelect = (candidate: CharacterChatCandidate) => {
    if (sourceSignature !== currentSignature.current) return;
    const isRegistered = registeredCandidates.some((item) => item.id === candidate.id);
    if (!isRegistered && (analysisSignature !== currentSignature.current || !validDetectedCandidates.some((item) => item.id === candidate.id))) return;
    const source = mode === 'novel' ? buildNovelSource() : analysisSignature === currentSignature.current ? analysisSource : null;
    if (source) onSelect(source, candidate, model);
  };

  const handleManualCreate = () => {
    if (!manualName.trim()) {
      setError('캐릭터 이름을 입력해 주세요.');
      return;
    }
    const source = createManualChatSource();
    onSelect(source, {
      id: crypto.randomUUID(),
      name: manualName.trim(),
      aliases: [],
      role: '',
      personality: '',
      speakingStyle: '',
      values: '',
      behaviorRules: '',
      appearance: '',
      background: '',
      storyContext: '',
      confidence: 'registered',
    }, model);
  };

  return (
    <div className="min-h-screen bg-[#141215] text-zinc-100">
      <header className="border-b border-zinc-800 bg-[#19161a]">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-4 sm:px-6">
          <button type="button" onClick={onBack} className="rounded-md p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white" title="캐릭터챗 홈">
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold">캐릭터 가져오기</h1>
            <p className="text-xs text-zinc-500">원본은 바뀌지 않고 캐릭터챗용 복사본만 만들어져.</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl px-4 py-7 sm:px-6">
        <div className="mb-6 grid grid-cols-3 gap-2" role="tablist" aria-label="캐릭터 생성 방식">
          {([
            ['novel', '내 소설', BookOpenIcon],
            ['text', '외부 TXT', DocumentTextIcon],
            ['manual', '직접 만들기', PlusIcon],
          ] as const).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={mode === value}
              onClick={() => { setMode(value); setError(''); setDetectedCandidates([]); setAnalysisSource(null); }}
              className={`flex min-h-12 items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold ${
                mode === value
                  ? 'border-rose-400 bg-rose-500/10 text-rose-200'
                  : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <ModelSelect value={model} onChange={setModel} className="mb-6 max-w-md" />

        {mode === 'novel' && (
          <section className="space-y-6">
            {novels.length === 0 ? (
              <p className="border-y border-zinc-800 py-10 text-center text-zinc-500">소설 스튜디오에 저장된 작품이 없어.</p>
            ) : (
              <>
                <div className="grid gap-5 border-y border-zinc-800 py-5 md:grid-cols-[1fr_1.2fr]">
                  <label className="space-y-2 text-sm text-zinc-300">
                    <span>가져올 소설</span>
                    <select
                      aria-label="가져올 소설"
                      value={selectedNovelId}
                      onChange={(event) => setSelectedNovelId(event.target.value)}
                      className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-rose-400"
                    >
                      {novels.map((novel) => <option key={novel.id} value={novel.id}>{novel.title}</option>)}
                    </select>
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-300">AI가 알 수 있는 진행도</span>
                      <span className="font-medium text-emerald-300">
                        {isFullCanon ? '전체 원고' : `${knowledgeChapterCount}화까지`}
                      </span>
                    </div>
                    <input
                      aria-label="AI 캐릭터 지식 진행도"
                      type="range"
                      min={0}
                      max={selectedNovel?.chapters.length || 0}
                      value={knowledgeChapterCount}
                      disabled={!selectedNovel?.chapters.length}
                      onChange={(event) => {
                        setKnowledgeChapterCount(Number(event.target.value));
                        setDetectedCandidates([]);
                        setAnalysisSource(null);
                      }}
                      className="w-full accent-rose-400"
                    />
                    <p className="text-xs text-zinc-500">선택 범위 뒤의 원고는 캐릭터 추출과 대화 컨텍스트에 들어가지 않아.</p>
                  </div>
                </div>

                <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <h2 className="font-semibold">등장인물 선택</h2>
                    <p className="text-sm text-zinc-500">등록된 인물은 바로 가져오고, 본문 분석으로 빠진 인물을 더 찾을 수 있어.</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleNovelAnalysis}
                    disabled={isAnalyzing || !selectedNovel?.chapters.length}
                    className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <WandSparklesIcon className="h-4 w-4" />
                    {isAnalyzing ? progress : '본문에서 더 찾기'}
                  </button>
                </div>
                <CandidateList candidates={candidates} onSelect={handleCandidateSelect} />
              </>
            )}
          </section>
        )}

        {mode === 'text' && (
          <section className="space-y-5">
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,text/plain,text/markdown"
              className="hidden"
              onChange={(event) => handleTextFile(event.target.files?.[0])}
            />
            <div className="flex flex-col gap-3 border-y border-zinc-800 py-5 sm:flex-row">
              <button
                type="button"
                onClick={() => { if (fileInputRef.current) fileInputRef.current.value = ''; fileInputRef.current?.click(); }}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-semibold hover:border-rose-400"
              >
                <DocumentTextIcon className="h-5 w-5 text-rose-300" />
                TXT 파일 선택
              </button>
              <input
                aria-label="외부 원고 제목"
                value={textTitle}
                onChange={(event) => setTextTitle(event.target.value)}
                placeholder="원고 제목"
                className="min-w-0 flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-3 text-white outline-none focus:border-rose-400"
              />
            </div>
            <textarea
              aria-label="외부 원고 내용"
              value={textContent}
              onChange={(event) => { setTextContent(event.target.value); setDetectedCandidates([]); setAnalysisSource(null); }}
              rows={12}
              placeholder="TXT를 선택하거나 원문을 여기에 붙여넣어도 돼."
              className="w-full resize-y rounded-md border border-zinc-700 bg-zinc-900 p-4 leading-7 text-zinc-200 outline-none focus:border-rose-400"
            />
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-zinc-500">{textContent.length.toLocaleString()}자</span>
              <button
                type="button"
                onClick={handleTextAnalysis}
                disabled={isAnalyzing || !textContent.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                <WandSparklesIcon className="h-4 w-4" />
                {isAnalyzing ? progress : '캐릭터 찾기'}
              </button>
            </div>
            {validDetectedCandidates.length > 0 && <CandidateList candidates={validDetectedCandidates} onSelect={handleCandidateSelect} />}
          </section>
        )}

        {mode === 'manual' && (
          <section className="mx-auto max-w-xl border-y border-zinc-800 py-8">
            <UserGroupIcon className="mb-4 h-9 w-9 text-rose-300" />
            <h2 className="text-xl font-semibold">빈 페르소나에서 시작</h2>
            <p className="mt-1 text-sm text-zinc-500">이름만 정한 뒤 직접 작성하거나 AI로 필요한 항목을 골라 채울 수 있어.</p>
            <label className="mt-6 block space-y-2 text-sm text-zinc-300">
              <span>캐릭터 이름</span>
              <input
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter') handleManualCreate(); }}
                placeholder="이름"
                className="w-full rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-white outline-none focus:border-rose-400"
              />
            </label>
            <button
              type="button"
              onClick={handleManualCreate}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-400"
            >
              <PlusIcon className="h-4 w-4" />
              페르소나 만들기
            </button>
          </section>
        )}

        {error && <p role="alert" className="mt-5 rounded-md border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</p>}
        {!error && progress && !isAnalyzing && <p className="mt-5 text-sm text-emerald-300">{progress}</p>}
      </main>
    </div>
  );
}

function CandidateList({
  candidates,
  onSelect,
}: {
  candidates: CharacterChatCandidate[];
  onSelect: (candidate: CharacterChatCandidate) => void;
}) {
  if (candidates.length === 0) {
    return <p className="border-y border-zinc-800 py-8 text-center text-sm text-zinc-500">등록된 인물이 없어. 본문에서 찾아보자.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {candidates.map((candidate) => (
        <button
          key={candidate.id}
          type="button"
          onClick={() => onSelect(candidate)}
          className="rounded-md border border-zinc-800 bg-[#1d191e] p-4 text-left hover:border-rose-400/70 hover:bg-zinc-900"
        >
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-white">{candidate.name}</h3>
            <span className={`text-[11px] ${candidate.confidence === 'registered' ? 'text-emerald-300' : 'text-amber-300'}`}>
              {candidate.confidence === 'registered' ? '등록됨' : '원문 추출'}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-zinc-500">{candidate.role || '역할 미정'}</p>
          <p className="mt-3 line-clamp-3 text-sm leading-5 text-zinc-400">{candidate.personality || candidate.storyContext || '선택 후 AI로 설정을 채울 수 있어.'}</p>
        </button>
      ))}
    </div>
  );
}

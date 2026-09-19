/**
 * ============================================================
 * @module modules/reading
 * @file ReadingRoom.tsx
 * ============================================================
 * @description 리딩룸 - 소설 독서 모드 컴포넌트
 * ============================================================
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Novel } from '@core/types';
import { useReadingSettings, type ReadingSettings } from './hooks';
import {
  XMarkIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ChatBubbleThoughtIcon,
  ChartBarIcon,
  WandSparklesIcon,
  SunIcon,
  MoonIcon,
  SwatchIcon,
  PlusIcon,
  MinusIcon,
  BarsArrowUpIcon,
  BarsArrowDownIcon,
  Cog6ToothIcon,
} from '@shared/components';

interface ReadingRoomProps {
  novel: Novel;
  onClose: () => void;
  onGenerateInterlude: (chapterIndex: number) => Promise<void>;
  onUpdateNovel: (updatedNovel: Novel) => void;
  startChapterIndex?: number;
}

export function ReadingRoom({
  novel,
  onClose,
  onGenerateInterlude,
  onUpdateNovel: _onUpdateNovel,
  startChapterIndex = 0,
}: ReadingRoomProps) {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(startChapterIndex);
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const [isInsightSidebarOpen, setIsInsightSidebarOpen] = useState(false);
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settings, setSettings] = useReadingSettings();
  const [interludeLoading, setInterludeLoading] = useState<number | null>(null);

  const chapterRefs = useRef<(HTMLDivElement | null)[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const controlTimeoutRef = useRef<number | null>(null);
  const settingsPanelRef = useRef<HTMLDivElement>(null);

  // Initial scroll to chapter
  useEffect(() => {
    setTimeout(() => {
      if (chapterRefs.current[startChapterIndex]) {
        chapterRefs.current[startChapterIndex]?.scrollIntoView({ behavior: 'auto' });
      }
    }, 100);
  }, [startChapterIndex]);

  // Intersection observer for chapter tracking
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = parseInt(entry.target.getAttribute('data-chapter-index') || '0', 10);
            setCurrentChapterIndex(index);
          }
        });
      },
      { root: scrollContainerRef.current, rootMargin: '0px', threshold: 0.5 }
    );

    chapterRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref);
    });

    return () => observer.disconnect();
  }, [novel.chapters]);

  // Handle scroll to show/hide controls
  const handleScroll = useCallback(() => {
    setIsControlsVisible(true);
    setIsSettingsOpen(false);
    setIsTocOpen(false);
    if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    controlTimeoutRef.current = window.setTimeout(() => setIsControlsVisible(false), 3000);
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', handleScroll);
    return () => {
      container?.removeEventListener('scroll', handleScroll);
      if (controlTimeoutRef.current) clearTimeout(controlTimeoutRef.current);
    };
  }, [handleScroll]);

  // Click outside to close settings
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsPanelRef.current && !settingsPanelRef.current.contains(event.target as Node)) {
        if (!(event.target as HTMLElement).closest('button[title="읽기 설정"]')) {
          setIsSettingsOpen(false);
        }
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGenerateInterludeClick = async (index: number) => {
    setInterludeLoading(index);
    await onGenerateInterlude(index);
    setInterludeLoading(null);
  };

  const themeClasses = {
    dark: 'bg-gray-900 text-gray-300',
    light: 'bg-white text-gray-800',
    sepia: 'bg-[#fbf0d9] text-[#5b4636]',
  };

  const goToChapter = (index: number) => {
    chapterRefs.current[index]?.scrollIntoView({ behavior: 'smooth' });
    setIsTocOpen(false);
  };

  const handleSettingChange = <K extends keyof ReadingSettings>(
    key: K,
    value: ReadingSettings[K]
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (
      (e.target as HTMLElement).closest('button') ||
      (e.target as HTMLElement).closest('[role="dialog"]')
    )
      return;
    if (settingsPanelRef.current && settingsPanelRef.current.contains(e.target as Node)) return;
    setIsControlsVisible((prev) => !prev);
  };

  return (
    <div
      className={`fixed inset-0 flex max-w-full overflow-x-hidden flex-col transition-colors duration-300 ${themeClasses[settings.theme]}`}
      style={{
        fontSize: `${settings.fontSize}px`,
        lineHeight: settings.lineHeight,
      }}
    >
      {/* Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-black/10 backdrop-blur-sm transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <h1 className="text-lg font-bold truncate">{novel.title}</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsSettingsOpen((prev) => !prev)}
            className="p-2 rounded-full hover:bg-white/10"
            title="읽기 설정"
          >
            <Cog6ToothIcon className="w-6 h-6" />
          </button>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10">
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
      </header>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <div
          ref={settingsPanelRef}
          role="dialog"
          aria-label="읽기 설정"
          className="fixed top-20 right-4 z-30 bg-gray-800/80 backdrop-blur-md text-white p-4 rounded-lg shadow-lg w-72"
        >
          <div className="space-y-4">
            <div>
              <label className="text-sm font-semibold">테마</label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleSettingChange('theme', 'light')}
                  className={`py-2 rounded-md border-2 ${
                    settings.theme === 'light'
                      ? 'border-indigo-500 bg-white'
                      : 'border-transparent bg-gray-700'
                  }`}
                >
                  <SunIcon className="w-5 h-5 mx-auto text-yellow-500" />
                </button>
                <button
                  onClick={() => handleSettingChange('theme', 'sepia')}
                  className={`py-2 rounded-md border-2 ${
                    settings.theme === 'sepia'
                      ? 'border-indigo-500 bg-[#fbf0d9]'
                      : 'border-transparent bg-gray-700'
                  }`}
                >
                  <SwatchIcon className="w-5 h-5 mx-auto text-[#856d5b]" />
                </button>
                <button
                  onClick={() => handleSettingChange('theme', 'dark')}
                  className={`py-2 rounded-md border-2 ${
                    settings.theme === 'dark'
                      ? 'border-indigo-500 bg-gray-600'
                      : 'border-transparent bg-gray-700'
                  }`}
                >
                  <MoonIcon className="w-5 h-5 mx-auto text-indigo-300" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">글꼴</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSettingChange('fontFamily', 'serif')}
                  className={`py-2 rounded-md text-sm ${
                    settings.fontFamily === 'serif' ? 'bg-indigo-500' : 'bg-gray-700'
                  }`}
                >
                  명조체
                </button>
                <button
                  onClick={() => handleSettingChange('fontFamily', 'sans-serif')}
                  className={`py-2 rounded-md text-sm ${
                    settings.fontFamily === 'sans-serif' ? 'bg-indigo-500' : 'bg-gray-700'
                  }`}
                >
                  고딕체
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">글자 크기</label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() =>
                    handleSettingChange('fontSize', Math.max(12, settings.fontSize - 1))
                  }
                  className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
                >
                  <MinusIcon className="w-5 h-5" />
                </button>
                <span className="flex-1 text-center font-mono">{settings.fontSize}px</span>
                <button
                  onClick={() =>
                    handleSettingChange('fontSize', Math.min(24, settings.fontSize + 1))
                  }
                  className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
                >
                  <PlusIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold">줄 간격</label>
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={() =>
                    handleSettingChange(
                      'lineHeight',
                      Math.max(1.4, Math.round((settings.lineHeight - 0.1) * 10) / 10)
                    )
                  }
                  className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
                >
                  <BarsArrowDownIcon className="w-5 h-5" />
                </button>
                <span className="flex-1 text-center font-mono">
                  {settings.lineHeight.toFixed(1)}
                </span>
                <button
                  onClick={() =>
                    handleSettingChange(
                      'lineHeight',
                      Math.min(2.5, Math.round((settings.lineHeight + 0.1) * 10) / 10)
                    )
                  }
                  className="p-2 rounded-full bg-gray-700 hover:bg-gray-600"
                >
                  <BarsArrowUpIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Insight Sidebar Toggle */}
      <button
        onClick={() => setIsInsightSidebarOpen(!isInsightSidebarOpen)}
        className={`fixed top-1/2 right-0 z-20 p-3 bg-indigo-600/80 text-white rounded-l-full transform -translate-y-1/2 transition-all duration-300 ease-in-out ${
          isInsightSidebarOpen ? 'translate-x-[-384px]' : 'translate-x-0'
        } ${isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <ChatBubbleThoughtIcon className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <div
        ref={scrollContainerRef}
        onClick={handleContentClick}
        className="min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto pt-20 pb-20 px-4 md:px-16 lg:px-32"
      >
        <div
          className={`w-full min-w-0 max-w-3xl mx-auto ${settings.fontFamily === 'serif' ? 'font-serif' : ''}`}
        >
          {novel.chapters.map((chapter, index) => (
            <div
              key={index}
              ref={(el) => {
                chapterRefs.current[index] = el;
              }}
              data-chapter-index={index}
              className="mb-16"
            >
              <h2 className="break-words text-xl sm:text-2xl font-bold leading-snug mb-6 text-center text-indigo-400">
                {chapter.title}
              </h2>
              <p className="jinpok-manuscript-text whitespace-pre-wrap">{chapter.content}</p>

              {/* Author's Interlude Section */}
              {chapter.authorInterlude ? (
                <blockquote className="mt-8 p-4 border-l-4 border-teal-500 bg-teal-500/10 rounded-r-lg">
                  <p className="jinpok-manuscript-text text-teal-200 italic whitespace-pre-wrap">
                    {chapter.authorInterlude}
                  </p>
                </blockquote>
              ) : (
                <div className="mt-8 text-center">
                  <button
                    onClick={() => handleGenerateInterludeClick(index)}
                    disabled={interludeLoading === index}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full transition-all duration-300
                      ${
                        (index + 1) % 5 === 0
                          ? 'bg-teal-500/20 text-teal-300 hover:bg-teal-500/30 animate-pulse'
                          : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                      }
                      disabled:bg-gray-600 disabled:cursor-wait ${
                        isControlsVisible ? 'opacity-100' : 'opacity-0'
                      }`}
                  >
                    <WandSparklesIcon className="w-4 h-4" />
                    {interludeLoading === index ? '생성 중...' : '작가의 회고 요청'}
                  </button>
                  {(index + 1) % 5 === 0 && (
                    <p className="text-xs text-teal-400/70 mt-2">
                      이쯤에서 작가의 생각을 들어보는 건 어떨까요?
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Controls */}
      <footer
        className={`fixed bottom-0 left-0 right-0 z-20 p-4 bg-black/10 backdrop-blur-sm transition-opacity duration-300 ${
          isControlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={() => goToChapter(Math.max(0, currentChapterIndex - 1))}
            disabled={currentChapterIndex === 0}
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-50"
          >
            <ArrowLeftIcon className="w-6 h-6" />
          </button>

          <div className="relative">
            <button onClick={() => setIsTocOpen(!isTocOpen)} className="text-center">
              <p className="font-semibold">
                {novel.chapters[currentChapterIndex]?.title || '소설의 끝'}
              </p>
              <p className="text-sm opacity-75">
                {currentChapterIndex + 1} / {novel.chapters.length}
              </p>
            </button>
            {isTocOpen && (
              <div
                role="dialog"
                className="absolute bottom-full mb-4 left-1/2 -translate-x-1/2 w-72 bg-gray-800 text-white rounded-lg shadow-lg max-h-80 overflow-y-auto"
              >
                <ul className="p-2">
                  {novel.chapters.map((ch, idx) => (
                    <li key={idx}>
                      <button
                        onClick={() => goToChapter(idx)}
                        className={`w-full text-left p-2 rounded-md text-sm ${
                          idx === currentChapterIndex ? 'bg-indigo-600' : 'hover:bg-gray-700'
                        }`}
                      >
                        {ch.title}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={() => goToChapter(Math.min(novel.chapters.length - 1, currentChapterIndex + 1))}
            disabled={currentChapterIndex >= novel.chapters.length - 1}
            className="p-2 rounded-full hover:bg-white/10 disabled:opacity-50"
          >
            <ArrowRightIcon className="w-6 h-6" />
          </button>
        </div>
      </footer>

      {/* Insight Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-96 bg-gray-800/90 backdrop-blur-md z-30 shadow-2xl transition-transform duration-300 ease-in-out ${
          isInsightSidebarOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="p-4 h-full flex flex-col">
          <h2 className="text-xl font-bold text-white mb-4">인사이트</h2>
          <div className="flex-1 overflow-y-auto space-y-4 text-white">
            <div>
              <h3 className="font-semibold mb-2 text-indigo-400 flex items-center gap-2">
                <ChatBubbleThoughtIcon className="w-5 h-5" />
                작가의 코멘터리
              </h3>
              <div className="bg-gray-900/50 p-3 rounded-lg text-sm space-y-2">
                {(novel.chapters[currentChapterIndex]?.feedbackChat || []).map((msg, idx) => (
                  <p
                    key={idx}
                    className={msg.role === 'user' ? 'text-indigo-300' : 'text-gray-300'}
                  >
                    <strong>{msg.role === 'user' ? '당신:' : '작가:'}</strong>{' '}
                    {msg.parts?.[0]?.text as string}
                  </p>
                ))}
                {(!novel.chapters[currentChapterIndex]?.feedbackChat ||
                  novel.chapters[currentChapterIndex]?.feedbackChat?.length === 0) && (
                  <p className="text-gray-500 italic">이 챕터에 대한 대화 기록이 없습니다.</p>
                )}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-indigo-400 flex items-center gap-2">
                <ChartBarIcon className="w-5 h-5" />
                이야기 구조
              </h3>
              <div className="bg-gray-900/50 p-3 rounded-lg text-sm">
                {novel.analysis ? (
                  <p className="text-gray-300">
                    인물 관계도 및 타임라인 정보를 보려면 편집기 '분석' 탭을 확인하세요.
                  </p>
                ) : (
                  <p className="text-gray-500 italic">아직 분석된 데이터가 없습니다.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

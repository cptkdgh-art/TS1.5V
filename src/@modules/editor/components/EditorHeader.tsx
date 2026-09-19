/**
 * ============================================================
 * @module modules/editor/components
 * @file EditorHeader.tsx
 * ============================================================
 * @description 에디터 헤더 컴포넌트
 * ============================================================
 */

import type { Novel } from '@core/types';
import { ArrowLeftIcon, EyeIcon, Bars3Icon, CameraIcon } from '@shared/components';
import type { EditorTab } from '../types';

interface EditorHeaderProps {
  novel: Novel;
  activeTab: EditorTab;
  onBack: () => void;
  onOpenReadingRoom: () => void;
  onOpenCoverModal: () => void;
  onToggleSidebar: () => void;
}

const TAB_LABELS: Record<EditorTab, string> = {
  content: '집필',
  characters: '등장인물',
  worldview: '세계관',
  foreshadowing: '복선 관리',
  settings: '설정',
  analysis: '분석',
  cache: '캐시 관리',
};

export function EditorHeader({
  novel,
  activeTab,
  onBack,
  onOpenReadingRoom,
  onOpenCoverModal,
  onToggleSidebar,
}: EditorHeaderProps) {
  return (
    <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="사이드바 토글"
          aria-expanded="false"
          className="lg:hidden p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <Bars3Icon className="w-6 h-6" aria-hidden="true" />
        </button>
        <button
          onClick={onBack}
          aria-label="소설 목록으로 돌아가기"
          className="flex items-center text-indigo-400 hover:text-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg px-2 py-1"
        >
          <ArrowLeftIcon className="w-5 h-5 mr-2" aria-hidden="true" />
          <span className="hidden sm:inline">목록으로</span>
          <span className="sm:hidden sr-only">목록으로</span>
        </button>
        <div className="h-6 w-px bg-gray-700 hidden sm:block" aria-hidden="true" />
        <div className="hidden sm:block">
          <h1 className="text-lg font-bold text-white truncate max-w-xs">
            {novel.title}
          </h1>
          <p className="text-xs text-gray-400">
            {TAB_LABELS[activeTab]} · {novel.chapters.length}장
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCoverModal}
          aria-label="표지 생성"
          className="p-2 text-gray-400 hover:text-indigo-400 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <CameraIcon className="w-5 h-5" aria-hidden="true" />
        </button>
        <button
          onClick={onOpenReadingRoom}
          aria-label="독서 모드 열기"
          className="p-2 text-gray-400 hover:text-indigo-400 rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <EyeIcon className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}

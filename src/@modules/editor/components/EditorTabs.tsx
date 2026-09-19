/**
 * ============================================================
 * @module modules/editor/components
 * @file EditorTabs.tsx
 * ============================================================
 * @description 에디터 탭 네비게이션 컴포넌트
 * ============================================================
 */

import {
  DocumentTextIcon,
  UserGroupIcon,
  GlobeAltIcon,
  Cog6ToothIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
  LightBulbIcon,
} from '@shared/components';
import type { EditorTab } from '../types';

interface EditorTabsProps {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
}

const TABS: { id: EditorTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'content', label: '집필', icon: DocumentTextIcon },
  { id: 'characters', label: '인물', icon: UserGroupIcon },
  { id: 'worldview', label: '세계관', icon: GlobeAltIcon },
  { id: 'foreshadowing', label: '복선', icon: LightBulbIcon },
  { id: 'settings', label: '설정', icon: Cog6ToothIcon },
  { id: 'analysis', label: '분석', icon: ChartBarIcon },
  { id: 'cache', label: '캐시', icon: ArchiveBoxIcon },
];

export function EditorTabs({ activeTab, onTabChange }: EditorTabsProps) {
  return (
    <nav
      className="bg-gray-800 border-b border-gray-700 px-4 py-2 shrink-0 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent"
      role="tablist"
      aria-label="에디터 탭 네비게이션"
    >
      <div className="flex gap-1 min-w-max">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm transition-colors whitespace-nowrap focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-800 ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" aria-hidden="true" />
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden sr-only">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

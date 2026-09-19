import type { CharacterChatEmotion, CharacterChatSource } from '@core/types';
import type { ReactNode } from 'react';
import {
  BookOpenIcon,
  BrainIcon,
  PinIcon,
  SparklesIcon,
} from '@shared/components';
import { getEmotionLabel } from '@services/character-chat';

interface CharacterStatusBarProps {
  affinity: number;
  relationshipStage: string;
  emotion: CharacterChatEmotion;
  turnCount: number;
  pinnedCount: number;
  summarizedMessageCount: number;
  messageCount: number;
  source: CharacterChatSource;
  isSummarizing: boolean;
}

export function CharacterStatusBar({
  affinity,
  relationshipStage,
  emotion,
  turnCount,
  pinnedCount,
  summarizedMessageCount,
  messageCount,
  source,
  isSummarizing,
}: CharacterStatusBarProps) {
  const affinityPercent = Math.max(0, Math.min(100, (affinity + 100) / 2));
  const storyProgress = source.type === 'novel'
    ? source.isFullCanon
      ? '전체 원고'
      : `${source.knowledgeChapterCount}화까지`
    : source.type === 'text' ? '가져온 TXT' : '직접 설정';

  return (
    <section aria-label="캐릭터 상태창" className="grid shrink-0 grid-cols-2 border-b border-[#f0dce3] bg-white text-[#44363d] sm:grid-cols-4">
      <div className="col-span-2 border-b border-[#f0dce3] px-4 py-3 sm:col-span-1 sm:border-b-0 sm:border-r">
        <div className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#b04d70]">
            <SparklesIcon className="h-3.5 w-3.5" /> 관계
          </span>
          <span className="text-xs font-bold text-[#6f3c50]">{relationshipStage}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#f7e6ec]" aria-label={`호감도 ${affinity}`}>
          <div className="h-full rounded-full bg-[#ed6c96] transition-all duration-300" style={{ width: `${affinityPercent}%` }} />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[#a58c96]">
          <span>호감도</span><span>{affinity}</span>
        </div>
      </div>

      <StatusItem
        icon={<SparklesIcon className="h-4 w-4" />}
        label="지금 표정"
        value={getEmotionLabel(emotion)}
        tone="coral"
      />
      <StatusItem
        icon={<BookOpenIcon className="h-4 w-4" />}
        label="장면"
        value={`${turnCount}턴 · ${storyProgress}`}
        tone="mint"
      />
      <StatusItem
        icon={isSummarizing ? <BrainIcon className="h-4 w-4 animate-pulse" /> : <PinIcon className="h-4 w-4" />}
        label="기억"
        value={isSummarizing ? '정리 중' : `${pinnedCount}개 고정 · ${summarizedMessageCount}/${messageCount}`}
        tone="butter"
        wideOnMobile
      />
    </section>
  );
}

function StatusItem({
  icon,
  label,
  value,
  tone,
  wideOnMobile = false,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: 'coral' | 'mint' | 'butter';
  wideOnMobile?: boolean;
}) {
  const toneClass = {
    coral: 'bg-[#fff0f4] text-[#d85882]',
    mint: 'bg-[#eaf8f3] text-[#3e8c76]',
    butter: 'bg-[#fff7d9] text-[#9b7927]',
  }[tone];
  return (
    <div className={`flex min-w-0 items-center gap-2.5 border-r border-[#f0dce3] px-3 py-3 last:border-r-0 ${wideOnMobile ? 'col-span-2 sm:col-span-1' : ''}`}>
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${toneClass}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold text-[#a58c96]">{label}</p>
        <p className="truncate text-xs font-bold text-[#55434b]">{value}</p>
      </div>
    </div>
  );
}

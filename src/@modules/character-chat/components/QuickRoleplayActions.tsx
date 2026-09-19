import { SparklesIcon } from '@shared/components';

const QUICK_ACTIONS = [
  { label: '표정 살피기', value: '*상대의 표정을 가만히 살핀다.*' },
  { label: '다가가기', value: '*조심스럽게 한 걸음 가까이 다가간다.*' },
  { label: '괜찮아?', value: '“괜찮아?” 하고 조심스럽게 묻는다.' },
  { label: '솔직히 말해줘', value: '“나한테는 솔직히 말해줘.”' },
] as const;

export function QuickRoleplayActions({
  disabled,
  onSelect,
}: {
  disabled: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-2 flex min-w-0 items-center gap-2 overflow-x-auto pb-1 scrollbar-hide" aria-label="빠른 장면 행동">
      <span className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-[#bd5a7a]">
        <SparklesIcon className="h-3.5 w-3.5" /> 행동
      </span>
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(action.value)}
          className="shrink-0 rounded-full border border-[#edccd7] bg-white px-3 py-1.5 text-xs font-medium text-[#75535f] shadow-sm transition-colors hover:border-[#ef8fab] hover:bg-[#fff0f4] hover:text-[#a43e62] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}

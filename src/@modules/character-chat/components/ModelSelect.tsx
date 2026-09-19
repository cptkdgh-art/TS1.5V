import type { CharacterChatModel } from '@core/types';
import { CHARACTER_CHAT_MODELS } from '@services/character-chat';

interface ModelSelectProps {
  value: CharacterChatModel;
  onChange: (model: CharacterChatModel) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export function ModelSelect({
  value,
  onChange,
  label = '대화 모델',
  disabled,
  className = '',
}: ModelSelectProps) {
  return (
    <label className={`flex items-center gap-2 text-sm text-zinc-300 ${className}`}>
      <span className="whitespace-nowrap">{label}</span>
      <select
        aria-label={label}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as CharacterChatModel)}
        className="min-w-0 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white outline-none focus:border-rose-400 disabled:opacity-60"
      >
        {CHARACTER_CHAT_MODELS.map((model) => (
          <option key={model.value} value={model.value}>{model.label}</option>
        ))}
      </select>
    </label>
  );
}

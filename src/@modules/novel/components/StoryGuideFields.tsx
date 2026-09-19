import { useMemo, useState } from 'react';
import {
  STORY_GENRE_GUIDES,
  STORY_MOOD_PRESETS,
  STORY_THEME_PRESETS,
  combineMood,
  parseMood,
} from '@core/constants/story-guides';

interface StoryGuideFieldsProps {
  primaryGenre: string;
  subgenres: string[];
  themes: string[];
  subject: string;
  mood: string;
  onPrimaryGenreChange: (value: string) => void;
  onSubgenresChange: (value: string[]) => void;
  onThemesChange: (value: string[]) => void;
  onSubjectChange: (value: string) => void;
  onMoodChange: (value: string) => void;
  isSavingSubject?: boolean;
  isSavingMood?: boolean;
  idPrefix: string;
}

const chipClass = (selected: boolean) => `px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
  selected
    ? 'bg-indigo-600 text-white ring-1 ring-indigo-400'
    : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
}`;

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

function AddableTags({
  values,
  suggestions,
  onChange,
  placeholder,
  label,
}: {
  values: string[];
  suggestions: readonly string[];
  onChange: (values: string[]) => void;
  placeholder: string;
  label: string;
}) {
  const [customValue, setCustomValue] = useState('');
  const options = useMemo(() => [...new Set([...suggestions, ...values])], [suggestions, values]);
  const addCustomValue = () => {
    const next = customValue.trim();
    if (!next || values.includes(next)) return;
    onChange([...values, next]);
    setCustomValue('');
  };

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={values.includes(option)}
            onClick={() => onChange(toggleValue(values, option))}
            className={chipClass(values.includes(option))}
          >
            {option}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={customValue}
          onChange={(event) => setCustomValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              addCustomValue();
            }
          }}
          className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder={placeholder}
        />
        <button
          type="button"
          onClick={addCustomValue}
          disabled={!customValue.trim()}
          className="shrink-0 rounded-md bg-gray-600 px-3 py-2 text-xs font-semibold text-white hover:bg-gray-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          추가
        </button>
      </div>
    </div>
  );
}

export function StoryGuideFields({
  primaryGenre,
  subgenres,
  themes,
  subject,
  mood,
  onPrimaryGenreChange,
  onSubgenresChange,
  onThemesChange,
  onSubjectChange,
  onMoodChange,
  isSavingSubject,
  isSavingMood,
  idPrefix,
}: StoryGuideFieldsProps) {
  const selectedGenre = STORY_GENRE_GUIDES.find((genre) => genre.id === primaryGenre);
  const parsedMood = useMemo(() => parseMood(mood), [mood]);

  return (
    <div className="space-y-4" data-testid="story-guide-fields">
      <div>
        <label htmlFor={`${idPrefix}-primary-genre`} className="mb-1 block text-sm font-medium text-gray-300">
          주 장르
        </label>
        <select
          id={`${idPrefix}-primary-genre`}
          value={primaryGenre}
          onChange={(event) => onPrimaryGenreChange(event.target.value)}
          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">선택 안 함 · 아래에 직접 설명</option>
          {STORY_GENRE_GUIDES.map((genre) => (
            <option key={genre.id} value={genre.id}>{genre.label}</option>
          ))}
        </select>
        <p className="mt-1.5 text-xs leading-5 text-gray-400">
          {selectedGenre?.guide || '독자가 기대할 큰 분류만 골라도 됩니다. 장르 공식은 AI 작가에게 강제되지 않습니다.'}
        </p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-300">부 장르</span>
          <span className="text-xs text-gray-500">0~3개 권장</span>
        </div>
        <AddableTags
          values={subgenres}
          suggestions={selectedGenre?.subgenres || []}
          onChange={onSubgenresChange}
          placeholder="다른 부 장르 추가"
          label="부 장르 선택"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-300">주제</span>
          <span className="text-xs text-gray-500">여러 개 선택 가능</span>
        </div>
        <AddableTags
          values={themes}
          suggestions={STORY_THEME_PRESETS}
          onChange={onThemesChange}
          placeholder="다른 주제 추가"
          label="주제 선택"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <label htmlFor={`${idPrefix}-subject`} className="text-sm font-medium text-gray-300">
            주제·소재 추가 설명
          </label>
          {isSavingSubject && <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>}
        </div>
        <input
          id={`${idPrefix}-subject`}
          value={subject}
          onChange={(event) => onSubjectChange(event.target.value)}
          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="예: 퇴사한 헌터가 낡은 여관을 되살리는 이야기"
        />
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-gray-300">분위기</span>
          {isSavingMood && <span className="text-xs text-gray-400 animate-pulse">저장 중...</span>}
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="분위기 선택">
          {STORY_MOOD_PRESETS.map((tag) => (
            <button
              key={tag}
              type="button"
              aria-pressed={parsedMood.tags.includes(tag)}
              onClick={() => onMoodChange(combineMood(toggleValue(parsedMood.tags, tag), parsedMood.freeText))}
              className={chipClass(parsedMood.tags.includes(tag))}
            >
              {tag}
            </button>
          ))}
        </div>
        <input
          id={`${idPrefix}-mood-detail`}
          value={parsedMood.freeText}
          onChange={(event) => onMoodChange(combineMood(parsedMood.tags, event.target.value))}
          className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="추가 분위기 설명 (예: 따뜻하지만 사건 장면은 서늘하게)"
        />
      </div>
    </div>
  );
}

/**
 * ============================================================
 * @module shared/components/TranslateButton
 * @file TranslateButton.tsx
 * ============================================================
 * @description 텍스트 번역 버튼 컴포넌트
 * ============================================================
 */

import { useState } from 'react';
import {
  translate,
  translateLongText,
  SUPPORTED_LANGUAGES,
  type LanguageCode,
} from '@services/ai/translation';

interface TranslateButtonProps {
  text: string;
  onTranslated: (translatedText: string) => void;
  className?: string;
}

export function TranslateButton({ text, onTranslated, className = '' }: TranslateButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTranslate = async (targetLang: LanguageCode) => {
    if (!text.trim()) {
      setError('번역할 텍스트가 없습니다.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 5000자 이상이면 긴 텍스트 번역 사용
      const translated = text.length > 5000
        ? await translateLongText(text, targetLang)
        : await translate(text, targetLang);

      onTranslated(translated);
      setIsOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : '번역 실패');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors disabled:opacity-50"
      >
        {isLoading ? (
          <>
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            번역 중...
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
              />
            </svg>
            번역
          </>
        )}
      </button>

      {isOpen && !isLoading && (
        <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-[160px]">
          <div className="p-2">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 px-2">
              번역할 언어 선택
            </p>
            {SUPPORTED_LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => handleTranslate(lang.code)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <span className="font-medium">{lang.name}</span>
                <span className="text-gray-400 ml-2">{lang.nativeName}</span>
              </button>
            ))}
          </div>
          {error && (
            <div className="px-3 py-2 text-xs text-red-500 border-t border-gray-200 dark:border-gray-700">
              {error}
            </div>
          )}
        </div>
      )}

      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

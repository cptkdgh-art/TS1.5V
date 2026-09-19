/**
 * ============================================================
 * @module modules/settings/components
 * @file ApiKeySetup.tsx
 * ============================================================
 * @description API 키 설정 화면 (카드 형식 UI)
 * - Gemini API 키 입력 카드
 * - xAI API 키 입력 카드
 * - 다크 테마 통일
 * ============================================================
 */

import { useState } from 'react';
import { KeyIcon, ClockIcon, ShieldCheckIcon, EyeIcon, toast } from '@shared/components';
import type { SessionDuration } from '@stores/settingsStore';

interface ApiKeySetupProps {
  onSubmit: (apiKey: string, sessionDuration: SessionDuration) => void;
}

export function ApiKeySetup({ onSubmit }: ApiKeySetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [sessionDuration, setSessionDuration] = useState<SessionDuration>('4h');
  const [showKey, setShowKey] = useState(false);

  const sessionOptions: { value: SessionDuration; label: string; desc: string }[] = [
    { value: '1h', label: '1시간', desc: '짧은 작업' },
    { value: '2h', label: '2시간', desc: '가벼운 집필' },
    { value: '4h', label: '4시간', desc: '일반 집필' },
    { value: '8h', label: '8시간', desc: '긴 집필' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) {
      toast.warning('API 키를 입력해주세요.');
      return;
    }
    onSubmit(apiKey.trim(), sessionDuration);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 및 타이틀 */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <KeyIcon className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AI 소설가 스튜디오</h1>
          <p className="text-gray-400">창작을 시작하려면 API 키를 입력해주세요</p>
        </div>

        <form onSubmit={handleSubmit}>
          {/* API 키 입력 */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Gemini API 키
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent pr-10"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <EyeIcon className="w-5 h-5" />
              </button>
            </div>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block mt-3 text-sm text-indigo-400 hover:text-indigo-300"
            >
              API 키 발급받기 →
            </a>
          </div>

          {/* 세션 시간 선택 */}
          <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-4">
              <ClockIcon className="w-4 h-4 text-indigo-400" />
              세션 지속 시간
            </label>
            <div className="grid grid-cols-4 gap-2">
              {sessionOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSessionDuration(option.value)}
                  className={`p-3 rounded-lg border-2 transition-all text-center ${
                    sessionDuration === option.value
                      ? 'border-indigo-500 bg-indigo-500/20 text-white'
                      : 'border-gray-700 bg-gray-900 text-gray-400 hover:border-gray-600'
                  }`}
                >
                  <div className="font-bold">{option.label}</div>
                  <div className="text-xs mt-0.5 opacity-70">{option.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 보안 안내 */}
          <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 mb-6">
            <div className="flex items-start gap-3">
              <ShieldCheckIcon className="w-5 h-5 text-green-400 mt-0.5 shrink-0" />
              <div className="text-sm text-gray-400">
                <p className="font-medium text-gray-300 mb-1">보안 안내</p>
                <ul className="space-y-0.5 text-xs">
                  <li>• API 키는 브라우저 로컬에만 저장</li>
                  <li>• 세션 종료 시 키가 자동으로 만료</li>
                  <li>• 외부 서버로 전송되지 않음</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 시작 버튼 */}
          <button
            type="submit"
            disabled={!apiKey.trim()}
            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-indigo-500/30 disabled:shadow-none"
          >
            {apiKey.trim() ? '스튜디오 시작하기' : 'API 키를 입력해주세요'}
          </button>
        </form>

        {/* 하단 링크 */}
        <p className="text-center text-gray-500 text-sm mt-6">
          진폭 스튜디오 - AI와 함께하는 창작의 세계
        </p>
      </div>
    </div>
  );
}

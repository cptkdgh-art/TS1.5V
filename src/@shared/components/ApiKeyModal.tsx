/**
 * ============================================================
 * @module shared/components
 * @file ApiKeyModal.tsx
 * ============================================================
 * @description API 키 설정 모달
 * ============================================================
 */

import { useState } from 'react';
import { Modal, Button, toast, useConfirmDialog } from '@shared/components';
import { BrainIcon, KeyIcon, ShieldCheckIcon } from '@shared/components';
import {
  useSettingsStore,
  type GeminiBackend,
  type SessionDuration,
} from '@stores/settingsStore';

interface ApiKeyModalProps {
  onClose: () => void;
}

export function ApiKeyModal({ onClose }: ApiKeyModalProps) {
  const {
    geminiApiKey, geminiBackend, isApiKeyConfigured,
    setApiKey, setGeminiBackend, setAiProvider, setSessionDuration, startSession, clearApiKey
  } = useSettingsStore();

  const [apiKey, setApiKeyInput] = useState(geminiApiKey);
  const [backend, setBackend] = useState<GeminiBackend>(geminiBackend);
  const [duration, setDuration] = useState<SessionDuration>('4h');
  const [isLoading, setIsLoading] = useState(false);
  const confirm = useConfirmDialog();

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.warning('AI 기능을 사용하려면 Gemini API 키를 입력해주세요.');
      return;
    }
    setIsLoading(true);
    try {
      await setApiKey(apiKey.trim());
      await setGeminiBackend(backend);
      await setAiProvider('gemini');
      await setSessionDuration(duration);
      await startSession();
      onClose();
    } catch (error) {
      console.error('API 키 저장 실패:', error);
      toast.error('API 키 저장에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClear = async () => {
    const confirmed = await confirm({
      title: 'API 키 삭제',
      message: '저장된 API 키를 모두 삭제합니다. 계속할까요?',
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    setIsLoading(true);
    try {
      await clearApiKey();
      setApiKeyInput('');
    } catch (error) {
      console.error('API 키 삭제 실패:', error);
      toast.error('API 키 삭제에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="API 설정" size="md" isDismissible={!isLoading}>
      <div className="space-y-6">
        <div>
          <p className="text-sm font-semibold text-gray-300 mb-2">AI 연결</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="AI 연결 방식">
            <div className="border border-indigo-500/50 bg-indigo-950/25 rounded p-3">
              <KeyIcon className="w-4 h-4 text-indigo-300 mb-2" />
              <p className="text-sm font-semibold text-white">Gemini API</p>
              <p className="text-xs text-gray-400 mt-1">앱에서 직접 생성</p>
            </div>
            <div className="border border-pink-500/40 bg-pink-950/20 rounded p-3">
              <BrainIcon className="w-4 h-4 text-pink-300 mb-2" />
              <p className="text-sm font-semibold text-white">Codex 브리지</p>
              <p className="text-xs text-green-300 mt-1">집필 컨텍스트 준비됨</p>
            </div>
          </div>
        </div>

        {/* 상태 표시 */}
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          isApiKeyConfigured
            ? 'bg-green-900/30 border border-green-700'
            : 'bg-yellow-900/30 border border-yellow-700'
        }`}>
          <ShieldCheckIcon className={`w-6 h-6 ${isApiKeyConfigured ? 'text-green-400' : 'text-yellow-400'}`} />
          <div>
            <p className={`font-semibold ${isApiKeyConfigured ? 'text-green-300' : 'text-yellow-300'}`}>
              {isApiKeyConfigured ? 'API 키가 설정되어 있습니다' : 'API 키가 설정되지 않았습니다'}
            </p>
            <p className="text-sm text-gray-400">
              {isApiKeyConfigured
                ? 'AI 기능을 사용할 수 있습니다.'
                : 'AI 기능을 사용하려면 Gemini API 키를 입력하세요.'}
            </p>
          </div>
        </div>

        {/* Gemini 호출 경로 */}
        <div>
          <p id="gemini-backend-label" className="block text-sm font-semibold text-gray-300 mb-2">
            Gemini 결제 경로
          </p>
          <div role="group" aria-labelledby="gemini-backend-label" className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setBackend('vertex')}
              aria-pressed={backend === 'vertex'}
              className={`rounded-lg border p-3 text-left transition-colors ${
                backend === 'vertex'
                  ? 'border-indigo-400 bg-indigo-950/40 text-white'
                  : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              disabled={isLoading}
            >
              <span className="block text-sm font-semibold">Google Cloud Vertex AI</span>
              <span className="mt-1 block text-xs text-indigo-200">Express Mode · Cloud 결제/크레딧</span>
            </button>
            <button
              type="button"
              onClick={() => setBackend('developer')}
              aria-pressed={backend === 'developer'}
              className={`rounded-lg border p-3 text-left transition-colors ${
                backend === 'developer'
                  ? 'border-indigo-400 bg-indigo-950/40 text-white'
                  : 'border-gray-600 bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              disabled={isLoading}
            >
              <span className="block text-sm font-semibold">Google AI Studio</span>
              <span className="mt-1 block text-xs text-gray-400">Developer API 무료·선불 결제</span>
            </button>
          </div>
        </div>

        {/* Gemini API 키 입력 */}
        <div>
          <label htmlFor="gemini-api-key" className="block text-sm font-semibold text-gray-300 mb-2">
            <KeyIcon className="w-4 h-4 inline mr-2 text-indigo-400" />
            Gemini API 키
          </label>
          <input
            id="gemini-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder={backend === 'vertex' ? 'AQ...' : 'AIza...'}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white placeholder-gray-500"
            disabled={isLoading}
          />
          {backend === 'vertex' ? (
            <p className="text-xs text-gray-500 mt-2">
              브라우저용 Vertex AI Express Mode API 키를 사용합니다. 선택 모델과 3.7 폴백 정책은 AI Studio 경로와 같습니다.
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-2">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-indigo-400 hover:text-indigo-300 underline"
              >
                Google AI Studio
              </a>
              에서 발급받을 수 있습니다.
            </p>
          )}
        </div>

        {/* 세션 지속 시간 */}
        <div>
          <p id="session-duration-label" className="block text-sm font-semibold text-gray-300 mb-2">
            세션 지속 시간
          </p>
          <div role="group" aria-labelledby="session-duration-label" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(['1h', '2h', '4h', '8h'] as SessionDuration[]).map((opt) => (
              <button
                type="button"
                key={opt}
                onClick={() => setDuration(opt)}
                aria-pressed={duration === opt}
                className={`py-2 px-3 rounded-lg border transition-colors ${
                  duration === opt
                    ? 'bg-indigo-600 border-indigo-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
                disabled={isLoading}
              >
                {opt === '1h' ? '1시간' : opt === '2h' ? '2시간' : opt === '4h' ? '4시간' : '8시간'}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ⚠️ 설정된 시간이 지나면 API 키가 자동 삭제됩니다.
          </p>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-between pt-4 border-t border-gray-700">
          {isApiKeyConfigured && (
            <Button variant="danger" onClick={handleClear} disabled={isLoading}>
              API 키 삭제
            </Button>
          )}
          <div className="flex gap-3 ml-auto">
            <Button variant="ghost" onClick={onClose} disabled={isLoading}>
              취소
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={isLoading || !apiKey.trim()}>
              {isLoading ? '저장 중...' : '저장'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

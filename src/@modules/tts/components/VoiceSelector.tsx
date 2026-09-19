/**
 * ============================================================
 * @module modules/tts/components/VoiceSelector
 * @file VoiceSelector.tsx
 * ============================================================
 * @description 음성 선택 컴포넌트
 * - 사용 가능한 음성 목록 표시
 * - 음성 미리듣기
 * - 음성 선택
 * ============================================================
 */

import React, { useState } from 'react';
import { useTTS } from '../hooks/useTTS';

interface VoiceSelectorProps {
  onSelect?: (voiceId: string) => void;
  className?: string;
}

export const VoiceSelector: React.FC<VoiceSelectorProps> = ({
  onSelect,
  className = '',
}) => {
  const { voices, selectedVoiceId, setVoice, speak } = useTTS();
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  // ========================================
  // 핸들러
  // ========================================

  const handleSelect = (voiceId: string) => {
    setVoice(voiceId);
    onSelect?.(voiceId);
  };

  const handlePreview = async (voiceId: string, name: string) => {
    setPreviewingId(voiceId);

    // 임시로 음성 변경
    const prevVoiceId = selectedVoiceId;
    setVoice(voiceId);

    // 미리듣기 텍스트
    await speak(`안녕하세요, ${name} 음성입니다.`);

    // 원래 음성으로 복원 (선택하지 않았다면)
    if (prevVoiceId !== voiceId) {
      setVoice(prevVoiceId);
    }

    setPreviewingId(null);
  };

  // 언어별 그룹핑
  const groupedVoices = voices.reduce<Record<string, typeof voices>>((acc, voice) => {
    const lang = voice.lang.split('-')[0]; // 'ko-KR' → 'ko'
    if (!acc[lang]) acc[lang] = [];
    acc[lang].push(voice);
    return acc;
  }, {});

  const langNames: Record<string, string> = {
    ko: '한국어',
    en: '영어',
    ja: '일본어',
    zh: '중국어',
  };

  // ========================================
  // 렌더
  // ========================================

  return (
    <div className={`bg-gray-800 rounded-lg p-4 ${className}`}>
      <h3 className="text-white font-medium mb-4">음성 선택</h3>

      {voices.length === 0 ? (
        <p className="text-gray-400 text-sm">
          사용 가능한 음성이 없습니다.
        </p>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedVoices).map(([lang, langVoices]) => (
            <div key={lang}>
              <h4 className="text-gray-400 text-sm mb-2">
                {langNames[lang] || lang.toUpperCase()}
              </h4>
              <div className="space-y-2">
                {langVoices.map((voice) => (
                  <div
                    key={voice.id}
                    className={`
                      flex items-center justify-between p-3 rounded-lg
                      cursor-pointer transition
                      ${selectedVoiceId === voice.id
                        ? 'bg-blue-500/20 border border-blue-500'
                        : 'bg-gray-700 hover:bg-gray-600'
                      }
                    `}
                    onClick={() => handleSelect(voice.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* 선택 표시 */}
                      <div
                        className={`
                          w-4 h-4 rounded-full border-2
                          ${selectedVoiceId === voice.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-500'
                          }
                        `}
                      >
                        {selectedVoiceId === voice.id && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                          </svg>
                        )}
                      </div>

                      {/* 음성 정보 */}
                      <div>
                        <p className="text-white text-sm">{voice.name}</p>
                        <p className="text-gray-400 text-xs">{voice.lang}</p>
                      </div>
                    </div>

                    {/* 미리듣기 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreview(voice.id, voice.name);
                      }}
                      disabled={previewingId === voice.id}
                      className={`
                        p-2 rounded-lg transition
                        ${previewingId === voice.id
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                        }
                      `}
                      title="미리듣기"
                    >
                      {previewingId === voice.id ? (
                        <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VoiceSelector;

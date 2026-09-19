/**
 * ============================================================
 * @module modules/tts/components/TTSPlayer
 * @file TTSPlayer.tsx
 * ============================================================
 * @description TTS 플레이어 컴포넌트
 * - 재생/일시정지/정지 컨트롤
 * - 진행률 표시
 * - 속도/음량 조절
 * ============================================================
 */

import React from 'react';
import { useTTS } from '../hooks/useTTS';

interface TTSPlayerProps {
  text: string;
  onClose?: () => void;
  className?: string;
}

export const TTSPlayer: React.FC<TTSPlayerProps> = ({
  text,
  onClose,
  className = '',
}) => {
  const {
    isReady,
    isPlaying,
    isPaused,
    progress,
    currentText,
    error,
    rate,
    volume,
    speakEpisode,
    pause,
    resume,
    stop,
    setRate,
    setVolume,
  } = useTTS();

  // ========================================
  // 핸들러
  // ========================================

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else if (isPaused) {
      resume();
    } else {
      speakEpisode(text);
    }
  };

  const handleStop = () => {
    stop();
    onClose?.();
  };

  // ========================================
  // 렌더
  // ========================================

  return (
    <div
      className={`bg-gray-900 rounded-lg p-4 shadow-lg ${className}`}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium">TTS 플레이어</h3>
        <button
          onClick={handleStop}
          className="text-gray-400 hover:text-white transition"
          title="닫기"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 에러 표시 */}
      {error && (
        <div className="bg-red-500/20 text-red-400 p-2 rounded mb-3 text-sm">
          {error}
        </div>
      )}

      {/* 현재 읽는 텍스트 */}
      {currentText && (
        <div className="bg-gray-800 rounded p-3 mb-3 max-h-20 overflow-y-auto">
          <p className="text-gray-300 text-sm leading-relaxed">
            {currentText}
          </p>
        </div>
      )}

      {/* 진행률 바 */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>진행률</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 컨트롤 버튼 */}
      <div className="flex items-center justify-center gap-4 mb-4">
        {/* 재생/일시정지 */}
        <button
          onClick={handlePlayPause}
          disabled={!isReady && !isPlaying && !isPaused}
          className={`
            w-12 h-12 rounded-full flex items-center justify-center
            transition-all
            ${isPlaying
              ? 'bg-yellow-500 hover:bg-yellow-600'
              : 'bg-blue-500 hover:bg-blue-600'
            }
            disabled:bg-gray-600 disabled:cursor-not-allowed
          `}
          title={isPlaying ? '일시정지' : '재생'}
        >
          {isPlaying ? (
            <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* 정지 */}
        <button
          onClick={stop}
          className="w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center transition"
          title="정지"
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M6 6h12v12H6z" />
          </svg>
        </button>
      </div>

      {/* 속도/음량 조절 */}
      <div className="space-y-3">
        {/* 속도 */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm w-12">속도</span>
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-gray-300 text-sm w-10 text-right">
            {rate.toFixed(1)}x
          </span>
        </div>

        {/* 음량 */}
        <div className="flex items-center gap-3">
          <span className="text-gray-400 text-sm w-12">음량</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-gray-300 text-sm w-10 text-right">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    </div>
  );
};

export default TTSPlayer;

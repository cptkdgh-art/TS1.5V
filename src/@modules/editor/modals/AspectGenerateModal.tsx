/**
 * ============================================================
 * @module modules/editor/modals
 * @file AspectGenerateModal.tsx
 * ============================================================
 * @description AI 세계관 설정 생성 모달
 * ============================================================
 */

import { useState } from 'react';

const QUICK_THEMES = [
  '마법 체계', '종교 및 신화', '정치 구조', '지리 및 기후',
  '역사적 사건', '사회 계급', '경제 시스템', '종족 특성'
] as const;

export type AspectMode = 'focused' | 'expanded';

interface AspectGenerateModalProps {
  isGenerating: boolean;
  onClose: () => void;
  onGenerate: (request: string, mode: AspectMode) => void;
}

export function AspectGenerateModal({
  isGenerating,
  onClose,
  onGenerate,
}: AspectGenerateModalProps) {
  const [aspectRequest, setAspectRequest] = useState('');
  const [aspectMode, setAspectMode] = useState<AspectMode>('focused');

  const handleThemeClick = (theme: string) => {
    setAspectRequest(prev => prev ? `${prev}, ${theme}` : theme);
  };

  const handleAutoGenerate = () => {
    setAspectRequest('종합 세계관 자동 생성');
    onGenerate('종합 세계관 자동 생성', 'expanded');
  };

  const handleClose = () => {
    setAspectRequest('');
    setAspectMode('focused');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg">
        <h3 className="text-xl font-bold mb-2 text-white">세계관 설정 추가 생성</h3>
        <p className="text-gray-400 text-sm mb-4">
          * 짧은 소설 정보와 입력한 주문 중심으로 빠르게 설정을 생성합니다.
        </p>

        {/* 빠른 테마 선택 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">빠른 테마 선택:</label>
          <div className="flex flex-wrap gap-2">
            {QUICK_THEMES.map((theme) => (
              <button
                key={theme}
                onClick={() => handleThemeClick(theme)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  aspectRequest.includes(theme)
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {theme}
              </button>
            ))}
          </div>
        </div>

        {/* 상세 입력 */}
        <div className="mb-4">
          <textarea
            className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600 placeholder:text-gray-500"
            rows={3}
            placeholder="생성하고 싶은 설정을 구체적으로 입력하세요. (예: 이 세계의 마법 시스템에 대해 자세히 써줘)"
            value={aspectRequest}
            onChange={e => setAspectRequest(e.target.value)}
          />
        </div>

        {/* 생성 모드 선택 */}
        <div className="mb-4 flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="aspectMode"
              checked={aspectMode === 'focused'}
              onChange={() => setAspectMode('focused')}
              className="text-purple-500"
            />
            <span className="text-gray-300 text-sm">집중 생성 <span className="text-gray-500">(요청한 것만 간결하게)</span></span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="aspectMode"
              checked={aspectMode === 'expanded'}
              onChange={() => setAspectMode('expanded')}
              className="text-purple-500"
            />
            <span className="text-gray-300 text-sm">확장 생성 <span className="text-gray-500">(풍부하고 상세하게)</span></span>
          </label>
        </div>

        {/* 버튼 영역 */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleAutoGenerate}
            disabled={isGenerating}
            className="text-purple-400 hover:text-purple-300 text-sm font-medium flex items-center gap-1"
          >
            <span className="text-lg">⟳</span> 종합 세계관 자동 생성 (Auto)
          </button>
          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold"
            >
              취소
            </button>
            <button
              onClick={() => onGenerate(aspectRequest, aspectMode)}
              disabled={isGenerating || !aspectRequest.trim()}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-bold"
            >
              {isGenerating ? '빠르게 생성 중...' : '생성'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

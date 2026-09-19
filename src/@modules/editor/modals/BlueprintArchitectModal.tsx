/**
 * ============================================================
 * @module modules/editor/modals
 * @file BlueprintArchitectModal.tsx
 * ============================================================
 * @description 청사진 건축실 - 설계도 강화 제안 비교/적용 모달
 * ============================================================
 */

import { useState } from 'react';
import { WandSparklesIcon, XMarkIcon } from '@shared/components';

interface BlueprintArchitectModalProps {
  originalPlot: string;
  suggestions: string[];
  onClose: () => void;
  onApply: (suggestion: string) => void;
}

export function BlueprintArchitectModal({
  originalPlot,
  suggestions,
  onClose,
  onApply,
}: BlueprintArchitectModalProps) {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-8 w-full max-w-4xl relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-2xl font-bold mb-6 text-white flex items-center gap-2">
          <WandSparklesIcon className="w-6 h-6 text-indigo-400" />
          청사진 건축실
        </h2>
        <div className="flex-grow grid grid-cols-1 md:grid-cols-2 gap-6 min-h-0">
          <div className="flex flex-col">
            <h3 className="text-lg font-semibold text-gray-400 mb-2">기존 설계도</h3>
            <div className="bg-gray-700 p-4 rounded-lg flex-1 overflow-y-auto text-sm">
              <p className="whitespace-pre-wrap">{originalPlot}</p>
            </div>
          </div>
          <div className="flex flex-col">
            <div className="flex border-b border-gray-600 mb-2">
              {['인물 중심', '사건 중심', '주제 중심'].map((name, index) => (
                <button
                  key={index}
                  onClick={() => setActiveTab(index)}
                  className={`px-4 py-2 text-sm font-semibold ${
                    activeTab === index
                      ? 'text-white border-b-2 border-indigo-500'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="bg-gray-900 p-4 rounded-lg flex-1 overflow-y-auto text-sm">
              <p className="whitespace-pre-wrap">{suggestions[activeTab]}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end pt-6 gap-3">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeTab < suggestions.length && suggestions[activeTab]) {
                onApply(suggestions[activeTab]);
              }
            }}
            disabled={activeTab >= suggestions.length || !suggestions[activeTab]}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            이 설계도로 적용
          </button>
        </div>
      </div>
    </div>
  );
}

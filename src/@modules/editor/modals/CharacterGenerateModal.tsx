/**
 * ============================================================
 * @module modules/editor/modals
 * @file CharacterGenerateModal.tsx
 * ============================================================
 * @description AI 캐릭터 생성 모달
 * ============================================================
 */

import { useState } from 'react';

export interface CharacterHints {
  name: string;
  role: string;
  keywords: string;
}

interface CharacterGenerateModalProps {
  isGenerating: boolean;
  onClose: () => void;
  onGenerate: (hints: CharacterHints) => void;
}

export function CharacterGenerateModal({
  isGenerating,
  onClose,
  onGenerate,
}: CharacterGenerateModalProps) {
  const [hints, setHints] = useState<CharacterHints>({
    name: '',
    role: '',
    keywords: '',
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-white">AI 캐릭터 생성</h3>
        <p className="text-gray-400 text-sm mb-4">짧은 소설 정보와 세계관 요약만 참고해 빠르게 새 캐릭터를 생성합니다.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">캐릭터 이름 (선택)</label>
            <input
              className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600"
              placeholder="비워두면 AI가 생성"
              value={hints.name}
              onChange={e => setHints({ ...hints, name: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">역할 (선택)</label>
            <input
              className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600"
              placeholder="예: 주인공의 멘토, 적대자 등"
              value={hints.role}
              onChange={e => setHints({ ...hints, role: e.target.value })}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">키워드 (선택, 쉼표로 구분)</label>
            <input
              className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600"
              placeholder="예: 신비로운, 지혜로운, 노인"
              value={hints.keywords}
              onChange={e => setHints({ ...hints, keywords: e.target.value })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold">취소</button>
          <button onClick={() => onGenerate(hints)} disabled={isGenerating} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold">
            {isGenerating ? '빠르게 생성 중...' : 'AI 생성'}
          </button>
        </div>
      </div>
    </div>
  );
}

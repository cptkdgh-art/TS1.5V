/**
 * ============================================================
 * @module modules/editor/modals
 * @file CharacterModal.tsx
 * ============================================================
 * @description 등장인물 추가/수정 모달
 * ============================================================
 */

import { useState } from 'react';
import type { Character } from '@core/types';
import { XMarkIcon } from '@shared/components';

interface CharacterModalProps {
  character: Character | null;
  onClose: () => void;
  onSave: (details: Omit<Character, 'id'>, isNew: boolean) => void;
}

export function CharacterModal({ character, onClose, onSave }: CharacterModalProps) {
  const [name, setName] = useState(character?.name || '');
  const [personality, setPersonality] = useState(character?.personality || '');
  const [appearance, setAppearance] = useState(character?.appearance || '');
  const [background, setBackground] = useState(character?.background || '');
  const [log, setLog] = useState(character?.log || '');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-white"><XMarkIcon className="w-6 h-6" /></button>
        <h3 className="text-xl font-bold mb-4 text-white">{character ? '등장인물 수정' : '새 등장인물 추가'}</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">이름</label>
            <input className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">성격 및 특징</label>
            <textarea className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" rows={3} value={personality} onChange={e => setPersonality(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">외모</label>
            <textarea className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" rows={2} value={appearance} onChange={e => setAppearance(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">배경 설정</label>
            <textarea className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" rows={3} value={background} onChange={e => setBackground(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">성장 및 변화 기록</label>
            <textarea className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600 focus:ring-indigo-500 focus:border-indigo-500" rows={2} value={log} onChange={e => setLog(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white font-bold py-2 px-4 rounded-lg">취소</button>
          <button onClick={() => onSave({ name, personality, appearance, background, log }, !character)} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-lg">저장</button>
        </div>
      </div>
    </div>
  );
}

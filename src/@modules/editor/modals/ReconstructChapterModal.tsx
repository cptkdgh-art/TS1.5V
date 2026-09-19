/**
 * ============================================================
 * @module modules/editor/modals
 * @file ReconstructChapterModal.tsx
 * ============================================================
 * @description 챕터 전체 재구성 모달
 * ============================================================
 */

import { useState } from 'react';
import { reconstructChapter } from '@services/ai/generation';
import { toast } from '@shared/components';

interface ReconstructChapterModalProps {
  chapter: { index: number; title: string; content: string };
  onClose: () => void;
  onApply: (newContent: string) => void;
}

export function ReconstructChapterModal({
  chapter,
  onClose,
  onApply,
}: ReconstructChapterModalProps) {
  const [instruction, setInstruction] = useState('');
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const handleReconstruct = async () => {
    setIsLoading(true);
    try {
      const newContent = await reconstructChapter(chapter.content, instruction || '전체적으로 더 자연스럽게 다듬어주세요');
      setVersions(newContent);
      setSelectedVersion(0);
    } catch (error) {
      toast.error((error as Error).message || '재구성 실패');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-4xl h-[85vh] flex flex-col">
        <h3 className="text-xl font-bold mb-4 text-white">챕터 재구성: {chapter.title}</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">재구성 지시사항</label>
          <input
            className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600"
            placeholder="예: 대화를 더 자연스럽게, 장면 묘사를 추가해줘"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
          />
        </div>
        <button
          onClick={handleReconstruct}
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded font-bold mb-4 disabled:bg-gray-600"
        >
          {isLoading ? 'AI 재구성 중...' : 'AI로 챕터 재구성 (3가지 버전)'}
        </button>
        {versions.length > 0 && (
          <div className="flex gap-2 mb-3">
            {versions.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedVersion(idx)}
                className={`px-4 py-2 rounded font-medium ${selectedVersion === idx ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              >
                버전 {idx + 1}
              </button>
            ))}
          </div>
        )}
        <div className="flex-1 grid grid-cols-2 gap-4 min-h-0">
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-400 mb-1">원본</label>
            <div className="flex-1 bg-gray-900 p-3 rounded text-gray-300 text-sm overflow-y-auto whitespace-pre-wrap">
              {chapter.content}
            </div>
          </div>
          <div className="flex flex-col">
            <label className="block text-sm font-medium text-gray-400 mb-1">
              {versions.length > 0 ? `재구성 결과 (버전 ${selectedVersion + 1})` : '재구성 결과'}
            </label>
            <div className="flex-1 bg-gray-900 p-3 rounded text-white text-sm overflow-y-auto whitespace-pre-wrap border border-gray-600">
              {versions[selectedVersion] || '재구성 버튼을 눌러주세요...'}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold">취소</button>
          {versions.length > 0 && (
            <button onClick={() => onApply(versions[selectedVersion])} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded font-bold">
              버전 {selectedVersion + 1}로 교체
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ============================================================
 * @module modules/editor/modals
 * @file RewriteSelectionModal.tsx
 * ============================================================
 * @description 선택한 텍스트를 AI로 다시 쓰는 모달
 * ============================================================
 */

import { useState } from 'react';
import { reconstructChapter } from '@services/ai/generation';

interface RewriteSelectionModalProps {
  selection: { text: string; chapterIndex: number; context: string };
  onClose: () => void;
  onApply: (newText: string) => void;
}

export function RewriteSelectionModal({
  selection,
  onClose,
  onApply,
}: RewriteSelectionModalProps) {
  const [instruction, setInstruction] = useState('');
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editedVersion, setEditedVersion] = useState<string>('');

  const handleRewrite = async () => {
    setIsLoading(true);
    setError(null);
    setVersions([]);
    try {
      const result = await reconstructChapter(selection.text, instruction || '더 자연스럽게 다듬어주세요');
      if (result.length === 0) {
        setError('다시쓰기 결과가 없습니다. 다시 시도해주세요.');
      } else {
        setVersions(result);
        setSelectedVersion(0);
        setEditedVersion(result[0] || '');
      }
    } catch (err) {
      setError((err as Error).message || '다시쓰기 중 오류가 발생했습니다. 다시 시도해주세요.');
      console.error('[RewriteSelectionModal] 오류:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVersionSelect = (idx: number) => {
    setSelectedVersion(idx);
    setEditedVersion(versions[idx] || '');
  };

  const originalLength = selection.text.length;
  const currentLength = editedVersion.length;
  const lengthDiff = currentLength - originalLength;
  const lengthColor = lengthDiff >= 0 ? 'text-emerald-400' : 'text-amber-400';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-xl font-bold mb-4 text-white">선택 부분 다시쓰기</h3>

        {/* 원본 텍스트 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">
            원본 텍스트 <span className="text-gray-500">({originalLength}자)</span>
          </label>
          <div className="bg-gray-700 p-3 rounded text-gray-300 text-sm max-h-32 overflow-y-auto whitespace-pre-wrap">
            {selection.text}
          </div>
        </div>

        {/* 수정 지시사항 */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-300 mb-1">수정 지시사항</label>
          <input
            className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600 focus:border-indigo-500 focus:outline-none"
            placeholder="예: 더 감정적으로, 문장을 짧게, 긴장감 있게"
            value={instruction}
            onChange={e => setInstruction(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !isLoading && handleRewrite()}
          />
        </div>

        {/* 다시쓰기 버튼 */}
        <button
          onClick={handleRewrite}
          disabled={isLoading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded font-bold mb-4 disabled:bg-gray-600 transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              AI가 3가지 버전을 생성 중...
            </>
          ) : versions.length > 0 ? (
            '다시 생성하기'
          ) : (
            'AI로 다시쓰기 (3가지 스타일)'
          )}
        </button>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/50 border border-red-700 rounded text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* 버전 선택 및 결과 */}
        {versions.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex gap-2">
                {versions.map((_, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleVersionSelect(idx)}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                      selectedVersion === idx
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {idx === 0 ? '원문 유지' : idx === 1 ? '감정 강화' : '리듬 개선'}
                  </button>
                ))}
              </div>
              <span className={`text-sm ${lengthColor}`}>
                {currentLength}자 ({lengthDiff >= 0 ? '+' : ''}{lengthDiff})
              </span>
            </div>
            <textarea
              className="w-full bg-gray-900 p-3 rounded text-white border border-gray-600 focus:border-indigo-500 focus:outline-none resize-none"
              style={{ minHeight: '200px' }}
              value={editedVersion}
              onChange={e => setEditedVersion(e.target.value)}
              placeholder="선택한 버전을 직접 수정할 수 있습니다"
            />
            <p className="text-xs text-gray-500 mt-1">
              버전을 선택한 후 직접 수정할 수 있습니다.
            </p>
          </div>
        )}

        {/* 하단 버튼 */}
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold transition-colors"
          >
            취소
          </button>
          {versions.length > 0 && (
            <button
              onClick={() => onApply(editedVersion)}
              disabled={!editedVersion.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded font-bold transition-colors disabled:bg-gray-600"
            >
              적용하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

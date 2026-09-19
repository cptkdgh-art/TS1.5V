/**
 * ============================================================
 * @module modules/author/components
 * @file AuthorMemoryModal.tsx
 * ============================================================
 * @description 개별 작가 기억 관리 모달
 * ============================================================
 */

import { useState } from 'react';
import type { AiAuthor } from '@core/types';
import { Modal, Button, toast, useConfirmDialog } from '@shared/components';

interface AuthorMemoryModalProps {
  author: AiAuthor;
  authors: AiAuthor[];
  onClose: () => void;
  onUpdateAuthors: (authors: AiAuthor[]) => void;
}

export function AuthorMemoryModal({
  author,
  authors,
  onClose,
  onUpdateAuthors,
}: AuthorMemoryModalProps) {
  const [memories, setMemories] = useState<string[]>(author.memoryCache || []);
  const [newMemory, setNewMemory] = useState('');
  const confirm = useConfirmDialog();

  const handleAddMemory = () => {
    if (!newMemory.trim()) return;
    setMemories([...memories, newMemory.trim()]);
    setNewMemory('');
  };

  const handleRemoveMemory = (index: number) => {
    setMemories(memories.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const updatedAuthors = authors.map((a) =>
      a.id === author.id ? { ...a, memoryCache: memories } : a
    );
    onUpdateAuthors(updatedAuthors);
    onClose();
  };

  const handleClearChatHistory = async () => {
    const confirmed = await confirm({
      title: '대화 기록 삭제',
      message: `${author.name}의 모든 대화 기록을 삭제하시겠습니까?`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;

    const updatedAuthors = authors.map((a) =>
      a.id === author.id
        ? { ...a, generalChatHistory: [], metaChatHistory: [] }
        : a
    );
    onUpdateAuthors(updatedAuthors);
    toast.success('대화 기록이 삭제되었습니다.');
  };

  return (
    <Modal isOpen onClose={onClose} title={`${author.name} - 기억 관리`} size="md">
      <div className="space-y-6">
        {/* 기억 목록 */}
        <div>
          <h4 className="text-gray-300 font-semibold mb-3">저장된 기억</h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {memories.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-4">
                저장된 기억이 없습니다.
              </p>
            ) : (
              memories.map((memory, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 bg-gray-700 p-3 rounded-lg"
                >
                  <p className="flex-1 text-sm text-gray-200">{memory}</p>
                  <button
                    onClick={() => handleRemoveMemory(index)}
                    className="text-red-400 hover:text-red-300 text-sm"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 새 기억 추가 */}
        <div>
          <h4 className="text-gray-300 font-semibold mb-2">새 기억 추가</h4>
          <div className="flex gap-2">
            <input
              type="text"
              value={newMemory}
              onChange={(e) => setNewMemory(e.target.value)}
              placeholder="기억할 내용을 입력하세요..."
              className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white"
              onKeyDown={(e) => e.key === 'Enter' && handleAddMemory()}
            />
            <Button variant="primary" onClick={handleAddMemory}>
              추가
            </Button>
          </div>
        </div>

        {/* 대화 기록 정보 */}
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <h4 className="text-gray-300 font-semibold mb-2">대화 기록</h4>
          <div className="text-sm text-gray-400 space-y-1">
            <p>
              일반 대화: {author.generalChatHistory?.length || 0}개 메시지
            </p>
            <p>
              메타 대화: {author.metaChatHistory?.length || 0}개 메시지
            </p>
          </div>
          <Button
            variant="danger"
            size="sm"
            onClick={handleClearChatHistory}
            className="mt-3"
          >
            대화 기록 초기화
          </Button>
        </div>

        {/* 액션 버튼 */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-700">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="primary" onClick={handleSave}>
            저장
          </Button>
        </div>
      </div>
    </Modal>
  );
}

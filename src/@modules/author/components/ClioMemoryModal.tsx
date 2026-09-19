/**
 * ============================================================
 * @module modules/author/components
 * @file ClioMemoryModal.tsx
 * ============================================================
 * @description 기본작가 기억과 분리된 총괄감독 클리오 기억 관리
 * ============================================================
 */

import { useMemo, useState } from 'react';
import { Button, Modal, toast, useConfirmDialog } from '@shared/components';
import { useDirectorClioStore } from '@stores/directorClioStore';
import { useNovelStore } from '@stores/novelStore';

interface ClioMemoryModalProps {
  onClose: () => void;
}

export function ClioMemoryModal({ onClose }: ClioMemoryModalProps) {
  const storedMemories = useDirectorClioStore((state) => state.memories);
  const sessions = useDirectorClioStore((state) => state.sessions);
  const setMemories = useDirectorClioStore((state) => state.setMemories);
  const clearSession = useDirectorClioStore((state) => state.clearSession);
  const clearAllSessions = useDirectorClioStore((state) => state.clearAllSessions);
  const novels = useNovelStore((state) => state.novels);
  const [memories, setLocalMemories] = useState<string[]>(storedMemories);
  const [newMemory, setNewMemory] = useState('');
  const confirm = useConfirmDialog();

  const sessionRows = useMemo(
    () => Object.values(sessions)
      .filter((session) => session.history.length > 0 || !!session.summary)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((session) => ({
        ...session,
        label: session.novelId
          ? novels.find((novel) => novel.id === session.novelId)?.title || '삭제된 작품'
          : '스튜디오 전체 상담',
      })),
    [sessions, novels]
  );

  const handleAddMemory = () => {
    const memory = newMemory.trim();
    if (!memory || memories.includes(memory)) return;
    setLocalMemories([...memories, memory]);
    setNewMemory('');
  };

  const handleSave = async () => {
    await setMemories(memories);
    toast.success('총괄감독의 공통 기억을 저장했습니다.');
    onClose();
  };

  const handleClearSession = async (novelId: string | null, label: string) => {
    const confirmed = await confirm({
      title: '상담 기록 삭제',
      message: `'${label}' 상담 기록과 요약을 삭제하시겠습니까?`,
      confirmText: '삭제',
      variant: 'danger',
    });
    if (!confirmed) return;
    await clearSession(novelId);
    toast.success('선택한 상담 기록을 삭제했습니다.');
  };

  const handleClearAll = async () => {
    const confirmed = await confirm({
      title: '총괄감독 상담 기록 전체 삭제',
      message: '모든 작품별 상담 기록과 요약을 삭제하시겠습니까? 공통 기억은 유지됩니다.',
      confirmText: '전체 삭제',
      variant: 'danger',
    });
    if (!confirmed) return;
    await clearAllSessions();
    toast.success('총괄감독 상담 기록을 모두 삭제했습니다.');
  };

  return (
    <Modal isOpen onClose={onClose} title="총괄감독 클리오 기억 관리" size="lg">
      <div className="space-y-6">
        <p className="text-sm text-gray-400">
          이 기억은 집필 작가인 기본작가 클리오의 기억과 완전히 분리돼. 모든 작품에 공통으로 적용할 운영 원칙만 적어줘.
        </p>

        <section>
          <h4 className="mb-3 font-semibold text-gray-200">스튜디오 공통 기억</h4>
          <div className="max-h-48 space-y-2 overflow-y-auto">
            {memories.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500">저장할 공통 운영 기억이 없습니다.</p>
            ) : (
              memories.map((memory, index) => (
                <div key={`${memory}-${index}`} className="flex items-start gap-2 border-b border-gray-700 px-1 py-2">
                  <p className="min-w-0 flex-1 text-sm text-gray-200">{memory}</p>
                  <button
                    type="button"
                    onClick={() => setLocalMemories(memories.filter((_, itemIndex) => itemIndex !== index))}
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <input
              type="text"
              aria-label="총괄감독 공통 기억"
              value={newMemory}
              onChange={(event) => setNewMemory(event.target.value)}
              placeholder="예: 전략 상담에서는 작가 개성을 가장 먼저 존중한다."
              className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-800 px-3 py-2 text-white"
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAddMemory();
              }}
            />
            <Button variant="primary" onClick={handleAddMemory}>추가</Button>
          </div>
        </section>

        <section className="border-t border-gray-700 pt-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h4 className="font-semibold text-gray-200">작품별 상담 기억</h4>
            <Button
              variant="danger"
              size="sm"
              onClick={() => void handleClearAll()}
              disabled={sessionRows.length === 0}
            >
              전체 삭제
            </Button>
          </div>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {sessionRows.length === 0 ? (
              <p className="py-5 text-center text-sm text-gray-500">저장된 상담 기록이 없습니다.</p>
            ) : (
              sessionRows.map((session) => (
                <div key={session.novelId || 'studio'} className="border-b border-gray-700 px-1 py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-purple-300">{session.label}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        대화 {session.history.length}개 · {session.summary ? '요약 있음' : '요약 없음'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleClearSession(session.novelId, session.label)}
                      className="shrink-0 text-xs text-red-400 hover:text-red-300"
                    >
                      기록 삭제
                    </button>
                  </div>
                  {session.summary && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-gray-300">{session.summary}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <div className="flex justify-end gap-2 border-t border-gray-700 pt-4">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button variant="primary" onClick={() => void handleSave()}>공통 기억 저장</Button>
        </div>
      </div>
    </Modal>
  );
}

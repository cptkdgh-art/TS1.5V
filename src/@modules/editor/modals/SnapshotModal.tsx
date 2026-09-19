/**
 * ============================================================
 * @module modules/editor/modals
 * @file SnapshotModal.tsx
 * ============================================================
 * @description 소설 스냅샷 생성 모달
 * ============================================================
 */

import { useState } from 'react';
import type { Novel, Snapshot } from '@core/types';

interface SnapshotModalProps {
  novel: Novel;
  onClose: () => void;
  onSave: (snapshot: Snapshot) => void;
}

export function SnapshotModal({
  novel,
  onClose,
  onSave,
}: SnapshotModalProps) {
  const [description, setDescription] = useState(`스냅샷 ${new Date().toLocaleDateString()}`);

  const handleCreate = () => {
    // Snapshot 타입에 맞게 novelData 생성 (snapshots 제외)
    const { snapshots: _, ...novelWithoutSnapshots } = novel;
    const snapshot: Snapshot = {
      id: `snapshot-${Date.now()}`,
      description,
      createdAt: Date.now(),
      novelData: novelWithoutSnapshots,
      kind: 'manual',
    };
    onSave(snapshot);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
        <h3 className="text-xl font-bold mb-4 text-white">스냅샷 만들기</h3>
        <p className="text-gray-400 text-sm mb-4">현재 소설 상태를 저장합니다. 나중에 이 시점으로 복원할 수 있습니다.</p>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">스냅샷 설명</label>
            <textarea
              className="w-full bg-gray-700 p-3 rounded text-white border border-gray-600"
              rows={2}
              placeholder="이 스냅샷에 대한 메모..."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>
          <div className="bg-gray-700 p-3 rounded text-sm">
            <p className="text-gray-300">현재 상태:</p>
            <p className="text-gray-400">- 챕터: {novel.chapters.length}개</p>
            <p className="text-gray-400">- 등장인물: {novel.characters.length}명</p>
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded font-bold">취소</button>
          <button onClick={handleCreate} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded font-bold">
            스냅샷 저장
          </button>
        </div>
      </div>
    </div>
  );
}

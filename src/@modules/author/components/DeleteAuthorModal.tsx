/**
 * ============================================================
 * @module modules/author/components
 * @file DeleteAuthorModal.tsx
 * ============================================================
 * @description 작가 삭제 확인 모달
 * ============================================================
 */

import { Modal, Button } from '@shared/components';

interface DeleteAuthorModalProps {
  authorName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteAuthorModal({
  authorName,
  onClose,
  onConfirm,
}: DeleteAuthorModalProps) {
  return (
    <Modal isOpen={true} onClose={onClose} title="작가 삭제" size="sm">
      <div className="space-y-4">
        <p className="text-gray-300">
          <span className="font-bold text-white">{authorName}</span> 작가를
          삭제하시겠습니까?
        </p>
        <p className="text-sm text-gray-400">
          이 작업은 되돌릴 수 없습니다.
        </p>
        <div className="flex justify-end gap-3 pt-4">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button variant="danger" onClick={onConfirm}>
            삭제
          </Button>
        </div>
      </div>
    </Modal>
  );
}

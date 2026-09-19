import React, { useState } from 'react';
import { Modal, Button, toast } from '@shared/components';

export interface ConfirmationModalProps {
  title: string;
  message: React.ReactNode;
  confirmText: string;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmationModal({ title, message, confirmText, onConfirm, onClose }: ConfirmationModalProps) {
  return (
    <Modal isOpen onClose={onClose} title={title}>
      <div className="text-gray-300 mb-6">{message}</div>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose}>취소</Button>
        <Button variant="primary" onClick={() => { onConfirm(); onClose(); }}>{confirmText}</Button>
      </div>
    </Modal>
  );
}

export interface DeleteConfirmationModalProps {
  title: string;
  message: string;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
}

export function DeleteConfirmationModal({ title, message, onClose, onConfirm }: DeleteConfirmationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error(`${title} 처리 실패:`, error);
      toast.error(`${title} 작업을 완료하지 못했습니다. 다시 시도해주세요.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={title} size="sm" isDismissible={!isSubmitting}>
      <p className="mb-6 leading-relaxed text-gray-300">{message}</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>취소</Button>
        <Button variant="danger" onClick={handleConfirm} disabled={isSubmitting}>
          {isSubmitting ? '삭제 중...' : '삭제'}
        </Button>
      </div>
    </Modal>
  );
}

import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface ConfirmOptions {
  title: string;
  message: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary';
}

interface PendingConfirm extends Required<Omit<ConfirmOptions, 'message'>> {
  message: React.ReactNode;
  resolve: (confirmed: boolean) => void;
}

const ConfirmDialogContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({
        title: options.title,
        message: options.message,
        confirmText: options.confirmText || '확인',
        cancelText: options.cancelText || '취소',
        variant: options.variant || 'primary',
        resolve,
      });
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    setPending((current) => {
      current?.resolve(confirmed);
      return null;
    });
  }, []);

  const value = useMemo(() => confirm, [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      <Modal
        isOpen={!!pending}
        onClose={() => close(false)}
        title={pending?.title}
        size="sm"
      >
        {pending && (
          <div className="space-y-5">
            <div className="text-sm text-gray-200 leading-relaxed">
              {pending.message}
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => close(false)}>
                {pending.cancelText}
              </Button>
              <Button
                variant={pending.variant === 'danger' ? 'danger' : 'primary'}
                onClick={() => close(true)}
              >
                {pending.confirmText}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmDialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const confirm = useContext(ConfirmDialogContext);
  if (!confirm) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return confirm;
}

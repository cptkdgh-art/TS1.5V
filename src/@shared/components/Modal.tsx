/**
 * ============================================================
 * @module shared/components/Modal
 * @file Modal.tsx
 * ============================================================
 * @description 재사용 가능한 모달 프레임과 중첩 모달 제어
 * ============================================================
 */

import React, { useEffect, useId, useRef } from 'react';
import { XMarkIcon } from './Icons';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  ariaLabel?: string;
  ariaDescribedBy?: string;
  isDismissible?: boolean;
}

const sizeStyles = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-4xl',
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

let modalStack: symbol[] = [];
let bodyLockDepth = 0;
let previousBodyOverflow = '';

function isTopModal(id: symbol) {
  return modalStack[modalStack.length - 1] === id;
}

function lockBodyScroll() {
  if (bodyLockDepth === 0) {
    previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyLockDepth += 1;
}

function unlockBodyScroll() {
  bodyLockDepth = Math.max(0, bodyLockDepth - 1);
  if (bodyLockDepth === 0) {
    document.body.style.overflow = previousBodyOverflow;
  }
}

function getFocusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector))
    .filter((element) => (
      element.getAttribute('aria-hidden') !== 'true'
      && element.getClientRects().length > 0
    ));
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  ariaLabel,
  ariaDescribedBy,
  isDismissible = true,
}) => {
  const modalId = useRef(Symbol('modal'));
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const dismissibleRef = useRef(isDismissible);

  onCloseRef.current = onClose;
  dismissibleRef.current = isDismissible;

  useEffect(() => {
    if (!isOpen) return;

    const id = modalId.current;
    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    modalStack.push(id);
    lockBodyScroll();

    const focusFrame = window.requestAnimationFrame(() => {
      dialogRef.current?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopModal(id)) return;

      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (
        event.shiftKey
        && (active === dialogRef.current || active === first || !dialogRef.current.contains(active))
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      const shouldRestoreFocus = isTopModal(id);
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown, true);
      modalStack = modalStack.filter((openId) => openId !== id);
      unlockBodyScroll();

      if (shouldRestoreFocus && previouslyFocused?.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const accessibleLabel = ariaLabel ?? (title ? undefined : '대화상자');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-6"
      data-testid="modal-backdrop"
      onMouseDown={(event) => {
        if (
          event.target === event.currentTarget
          && isDismissible
          && isTopModal(modalId.current)
        ) {
          onCloseRef.current();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={accessibleLabel}
        aria-labelledby={title && !ariaLabel ? titleId : undefined}
        aria-describedby={ariaDescribedBy}
        tabIndex={-1}
        className={`
          relative w-full ${sizeStyles[size]}
          max-h-[calc(100dvh-1.5rem)] overflow-hidden rounded-xl
          border border-gray-700 bg-gray-800 shadow-2xl outline-none
          animate-in fade-in zoom-in-95 duration-200 sm:max-h-[90vh]
        `}
      >
        {title && (
          <div className="flex min-h-14 items-center justify-between border-b border-gray-700 px-5 py-3 sm:px-6">
            <h2 id={titleId} className="text-lg font-semibold text-white">{title}</h2>
            <button
              type="button"
              onClick={onClose}
              disabled={!isDismissible}
              aria-label={`${title} 닫기`}
              title="닫기"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-gray-400 transition-colors hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <XMarkIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain p-5 sm:max-h-[calc(90vh-3.5rem)] sm:p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

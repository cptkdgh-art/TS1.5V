import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react';

// Toast 타입
export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

// Toast Provider
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info', duration = 3000) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

// Hook
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// 개별 Toast 컴포넌트
function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: () => void }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration && toast.duration > 0) {
      const exitTimer = setTimeout(() => setIsExiting(true), toast.duration - 300);
      const removeTimer = setTimeout(onRemove, toast.duration);
      return () => {
        clearTimeout(exitTimer);
        clearTimeout(removeTimer);
      };
    }
  }, [toast.duration, onRemove]);

  const typeStyles: Record<ToastType, string> = {
    success: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-50',
    error: 'bg-rose-950/95 border-rose-500/60 text-rose-50',
    warning: 'bg-amber-950/95 border-amber-500/60 text-amber-50',
    info: 'bg-sky-950/95 border-sky-500/50 text-sky-50',
  };

  const icons: Record<ToastType, string> = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-lg border shadow-xl
        text-sm leading-snug min-w-[260px] max-w-[360px]
        transition-all duration-300 ease-out
        ${typeStyles[toast.type]}
        ${isExiting ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
      `}
    >
      <span className="text-lg flex-shrink-0">{icons[toast.type]}</span>
      <span className="flex-1 break-words max-h-20 overflow-hidden">{toast.message}</span>
      <button
        onClick={() => {
          setIsExiting(true);
          setTimeout(onRemove, 300);
        }}
        className="text-white/60 hover:text-white flex-shrink-0 ml-1 leading-none"
      >
        ✕
      </button>
    </div>
  );
}

// Toast Container
function ToastContainer({ toasts, removeToast }: { toasts: Toast[]; removeToast: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      {toasts.map(toast => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onRemove={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}

// 전역 toast 함수 (Provider 외부에서도 사용 가능)
let globalAddToast: ((message: string, type?: ToastType, duration?: number) => void) | null = null;

export function setGlobalToast(addToast: typeof globalAddToast) {
  globalAddToast = addToast;
}

export const toast = {
  success: (message: string, duration?: number) => globalAddToast?.(message, 'success', duration),
  error: (message: string, duration?: number) => globalAddToast?.(message, 'error', duration),
  warning: (message: string, duration?: number) => globalAddToast?.(message, 'warning', duration),
  info: (message: string, duration?: number) => globalAddToast?.(message, 'info', duration),
};

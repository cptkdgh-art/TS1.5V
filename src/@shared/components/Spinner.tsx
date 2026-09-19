/**
 * ============================================================
 * @module shared/components/Spinner
 * @file Spinner.tsx
 * ============================================================
 * @description 로딩 스피너 컴포넌트
 * ============================================================
 */

import React from 'react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeStyles = {
  sm: 'h-4 w-4',
  md: 'h-6 w-6',
  lg: 'h-8 w-8',
};

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '' }) => (
  <svg
    className={`animate-spin ${sizeStyles[size]} ${className}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
    />
  </svg>
);

interface LoadingOverlayProps {
  message?: string;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ message = '로딩 중...' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/80 backdrop-blur-sm">
    <div className="flex flex-col items-center gap-4">
      <Spinner size="lg" className="text-indigo-500" />
      <p className="text-gray-300">{message}</p>
    </div>
  </div>
);

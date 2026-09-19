/**
 * ============================================================
 * @module shared/components/Button
 * @file Button.tsx
 * ============================================================
 * @description 재사용 가능한 버튼 컴포넌트
 * ============================================================
 */

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'purple' | 'teal' | 'gray';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  secondary: 'bg-gray-700 hover:bg-gray-600 text-gray-200',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
  ghost: 'bg-transparent hover:bg-gray-700 text-gray-300',
  purple: 'bg-purple-600 hover:bg-purple-700 text-white',
  teal: 'bg-teal-600 hover:bg-teal-700 text-white',
  gray: 'bg-gray-700 hover:bg-gray-600 text-white',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
  lg: 'px-4 py-2 text-base',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2
        rounded-lg font-medium transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
            fill="none"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};

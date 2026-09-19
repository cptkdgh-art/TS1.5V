/**
 * ============================================================
 * @module shared/components/Input
 * @file Input.tsx
 * ============================================================
 * @description 재사용 가능한 입력 컴포넌트
 * ============================================================
 */

import React, { useId } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const messageId = `${inputId}-${error ? 'error' : 'help'}`;
  const describedBy = [ariaDescribedBy, error || helperText ? messageId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-300 mb-1">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid ?? Boolean(error)}
        className={`
          w-full px-3 py-2 rounded-lg
          bg-gray-700 border border-gray-600
          text-white placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p id={messageId} className="mt-1 text-sm text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p id={messageId} className="mt-1 text-sm text-gray-400">{helperText}</p>
      )}
    </div>
  );
};

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea: React.FC<TextareaProps> = ({
  label,
  error,
  helperText,
  className = '',
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props
}) => {
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const messageId = `${textareaId}-${error ? 'error' : 'help'}`;
  const describedBy = [ariaDescribedBy, error || helperText ? messageId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-medium text-gray-300 mb-1">
          {label}
        </label>
      )}
      <textarea
        id={textareaId}
        aria-describedby={describedBy}
        aria-invalid={ariaInvalid ?? Boolean(error)}
        className={`
          w-full px-3 py-2 rounded-lg
          bg-gray-700 border border-gray-600
          text-white placeholder-gray-400
          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent
          disabled:opacity-50 disabled:cursor-not-allowed
          resize-none
          ${error ? 'border-red-500' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p id={messageId} className="mt-1 text-sm text-red-400">{error}</p>
      )}
      {helperText && !error && (
        <p id={messageId} className="mt-1 text-sm text-gray-400">{helperText}</p>
      )}
    </div>
  );
};

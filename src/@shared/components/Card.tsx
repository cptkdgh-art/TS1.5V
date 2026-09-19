/**
 * ============================================================
 * @module shared/components/Card
 * @file Card.tsx
 * ============================================================
 * @description 재사용 가능한 카드 컴포넌트
 * ============================================================
 */

import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  onClick,
  hoverable = false,
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        bg-gray-800 rounded-xl border border-gray-700
        ${hoverable ? 'hover:border-indigo-500 hover:shadow-lg hover:shadow-indigo-500/10 transition-all cursor-pointer' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};

interface CardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const CardHeader: React.FC<CardHeaderProps> = ({ children, className = '' }) => (
  <div className={`px-4 py-3 border-b border-gray-700 ${className}`}>
    {children}
  </div>
);

interface CardBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const CardBody: React.FC<CardBodyProps> = ({ children, className = '' }) => (
  <div className={`p-4 ${className}`}>
    {children}
  </div>
);

interface CardFooterProps {
  children: React.ReactNode;
  className?: string;
}

export const CardFooter: React.FC<CardFooterProps> = ({ children, className = '' }) => (
  <div className={`px-4 py-3 border-t border-gray-700 ${className}`}>
    {children}
  </div>
);

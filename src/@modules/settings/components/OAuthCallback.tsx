/**
 * ============================================================
 * @module modules/settings/components
 * @file OAuthCallback.tsx
 * ============================================================
 * @description ChatGPT OAuth 콜백 처리 컴포넌트 (미사용)
 * - 현재는 세션 토큰 직접 입력 방식 사용
 * - 이 컴포넌트는 참조용으로 유지
 * ============================================================
 */

import { useEffect, useState } from 'react';

export function OAuthCallback() {
  const [status] = useState<'processing' | 'success' | 'error'>('error');

  useEffect(() => {
    // OAuth 콜백은 현재 미사용
    // 세션 토큰 직접 입력 방식으로 변경됨
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
      <div className="text-center">
        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-4 bg-yellow-500 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold mb-2 text-yellow-400">OAuth 미지원</h1>
            <p className="text-gray-400 mb-4">현재 세션 토큰 직접 입력 방식을 사용합니다.</p>
            <button
              onClick={() => window.close()}
              className="px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              창 닫기
            </button>
          </>
        )}
      </div>
    </div>
  );
}

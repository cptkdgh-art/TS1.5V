/**
 * ============================================================
 * @file main.tsx
 * @description 진폭 TS STUDIO 앱 엔트리포인트
 * ============================================================
 */

// 진폭 보안 시스템 (CODEX.md 참조)
import '@security/jinpok-guard';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ToastProvider, ErrorBoundary, ConfirmDialogProvider } from '@shared/components';
import { installWritingBridge } from '@services/bridge';
import './index.css';

installWritingBridge();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <ConfirmDialogProvider>
          <App />
        </ConfirmDialogProvider>
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

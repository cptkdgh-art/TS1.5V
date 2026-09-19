import { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
          <div className="max-w-lg w-full bg-gray-800 rounded-xl p-6 shadow-xl">
            <div className="text-center mb-6">
              <div className="text-5xl mb-4">⚠️</div>
              <h1 className="text-xl font-bold text-red-400 mb-2">
                오류가 발생했습니다
              </h1>
              <p className="text-gray-400 text-sm">
                예기치 않은 오류가 발생했습니다. 작업 내용은 자동 저장되어 있습니다.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-gray-900 rounded-lg p-4 mb-4 overflow-auto max-h-40">
                <p className="text-red-300 text-sm font-mono">
                  {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <pre className="text-gray-500 text-xs mt-2 whitespace-pre-wrap">
                    {this.state.errorInfo.componentStack?.slice(0, 500)}
                  </pre>
                )}
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={this.handleReset}>
                다시 시도
              </Button>
              <Button variant="primary" onClick={this.handleReload}>
                페이지 새로고침
              </Button>
            </div>

            <p className="text-center text-gray-500 text-xs mt-4">
              문제가 지속되면 브라우저 캐시를 삭제하거나 개발자에게 문의하세요.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

import React from 'react';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}
interface ErrorBoundaryState {
  error: Error | null;
  info: React.ErrorInfo | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null, info: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ error, info });
    console.error('[Aura] uncaught render error:', error, info.componentStack);
  }

  render() {
    const { error, info } = this.state;
    if (error) {
      return (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: '#0b0b0d', color: '#e5e7eb',
            padding: 24, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            overflow: 'auto',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}
        >
          <h1 style={{ fontSize: 16, color: '#f87171', margin: 0 }}>Aura 启动失败 — unhandled render error</h1>
          <div style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {String(error?.stack || error?.message || error)}
          </div>
          {info?.componentStack && (
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 12, opacity: 0.8 }}>
              componentStack:{info.componentStack}
            </div>
          )}
          <div style={{ fontSize: 11, opacity: 0.6 }}>
            打开 DevTools Console (Cmd+Option+I) 看完整日志；临时解决方案：刷新 WebView。
          </div>
        </div>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

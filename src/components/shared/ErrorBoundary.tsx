import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      const label = this.props.fallbackLabel || 'panel';
      return (
        <div
          style={{
            background: '#1e293b',
            borderRadius: 8,
            padding: '14px 16px',
            marginBottom: 12,
            border: '1px solid #ef444466',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: '#ef4444', fontSize: 12, fontWeight: 600 }}>
              {label} crashed: {this.state.error.message}
            </span>
            <button
              onClick={() => this.setState({ error: null })}
              style={{
                background: '#334155',
                border: '1px solid #475569',
                borderRadius: 4,
                color: '#e2e8f0',
                fontSize: 11,
                padding: '3px 10px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

import { Component, StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/reset.css';
import './styles/app.css';
import './styles/grain.css';
import App from './App';

// Error boundary so runtime crashes show on screen rather than turning the
// preview into a white void. Brand-styled so the failure mode still feels
// like SommSavvy.
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error('App boundary caught:', error);
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: '32px 24px',
            background: '#14100D',
            color: '#C9BFA8',
            minHeight: '100dvh',
            fontFamily: 'Geist, system-ui, sans-serif',
          }}
        >
          <h1
            style={{
              fontFamily: 'Rowan, serif',
              fontStyle: 'italic',
              fontSize: 32,
              color: '#F2E9D4',
              marginBottom: 12,
            }}
          >
            Something gave way.
          </h1>
          <p style={{ fontSize: 14, marginBottom: 16 }}>
            The somm is gathering themselves. Reload when ready.
          </p>
          <pre
            style={{
              padding: 16,
              background: '#1F1A15',
              borderRadius: 14,
              fontSize: 12,
              color: '#E89B3C',
              fontFamily: 'ui-monospace, monospace',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

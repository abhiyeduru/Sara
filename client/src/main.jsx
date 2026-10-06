import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'monospace', color: '#b91c1c', background: '#fef2f2', minHeight: '100vh', boxSizing: 'border-box' }}>
          <h2 style={{ fontSize: 24, marginBottom: 12 }}>Application Runtime Error</h2>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#fff', padding: 20, borderRadius: 8, border: '1px solid #fecaca', fontSize: 13, lineHeight: 1.5 }}>
            {this.state.error?.stack || this.state.error?.toString()}
          </pre>
          <div style={{ marginTop: 20, display: 'flex', gap: 12 }}>
            <button
              onClick={() => { localStorage.clear(); window.location.reload(); }}
              style={{ padding: '10px 20px', background: '#b91c1c', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Reset Session & Reload
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 20px', background: '#4b5563', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

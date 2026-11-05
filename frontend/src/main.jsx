import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ── Theme initialisation (runs synchronously before React mounts) ─────────────
// Reads localStorage → falls back to system preference.
// Applies data-theme to <html> immediately so CSS variables are correct
// before the first paint — eliminates the theme-flash.
;(function initTheme() {
  try {
    const saved = localStorage.getItem('aladdin-theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const theme = saved || (prefersDark ? 'dark' : 'light')
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light')
    } else {
      document.documentElement.removeAttribute('data-theme')
    }
  } catch (_) { /* localStorage blocked in private mode — silent */ }
})()

// ── Global error boundary — prevents silent blank screen on render crash ──────
class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // Log to console so DevTools always shows it
    console.error('[Aladdin] Render error caught by ErrorBoundary:', error, info?.componentStack)
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error?.message || String(this.state.error)
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16, padding: 32,
          background: 'var(--bg, #0d1117)', color: 'var(--text, #e6edf3)', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ fontSize: 36 }}>🧞</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Something went wrong</div>
          <div style={{
            background: 'rgba(248,81,73,.1)', border: '1px solid rgba(248,81,73,.3)',
            borderRadius: 8, padding: '12px 20px', fontSize: 13, maxWidth: 600,
            color: '#f85149', textAlign: 'center', wordBreak: 'break-word',
          }}>
            {msg}
          </div>
          <button
            style={{
              marginTop: 8, padding: '8px 20px', borderRadius: 8, border: 'none',
              background: '#2f81f7', color: '#fff', fontSize: 14, cursor: 'pointer', fontWeight: 600,
            }}
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
          <div style={{ fontSize: 11, color: 'var(--muted, #8b949e)', marginTop: 4 }}>
            Open DevTools Console for the full error stack trace.
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Global unhandled-rejection handler — surfaces async errors visibly ─────────
window.addEventListener('unhandledrejection', (e) => {
  // Only log; don't crash the app for network errors (expected when APIs are slow)
  const msg = e.reason?.message || String(e.reason)
  if (!msg.includes('timeout') && !msg.includes('Network') && !msg.includes('cancel')) {
    console.warn('[Aladdin] Unhandled promise rejection:', e.reason)
  }
  // Prevent "Uncaught (in promise)" cluttering the console for normal API timeouts
  e.preventDefault()
})

// ── Mount ──────────────────────────────────────────────────────────────────────
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)

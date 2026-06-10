import { Component, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'

interface Props {
  children: ReactNode
  fallback?: ReactNode
  onError?: (error: Error, info: { componentStack: string }) => void
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[Shule ErrorBoundary]', error, info)
    this.props.onError?.(error, info)
    if (navigator.onLine) {
      supabase.from('error_log').insert({
        error_type: error.name,
        error_message: error.message + '\n' + info.componentStack,
        severity: 'error',
        status: 'open',
      }).then(() => {})
    }
  }

  reset = () => this.setState({ hasError: false, error: null })

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div style={{
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          minHeight: 400, gap: 16, padding: 32,
        }}>
          <div style={{ fontSize: 36 }}>⚠️</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--txt)', margin: 0 }}>
            Something went wrong
          </h2>
          <p style={{ color: 'var(--txt3)', fontSize: 13, textAlign: 'center', maxWidth: 420, margin: 0 }}>
            {this.state.error?.message ?? 'An unexpected error occurred'}
          </p>
          <button
            onClick={this.reset}
            style={{
              padding: '8px 20px', background: 'var(--brand)', color: '#fff',
              border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function withErrorBoundary<P extends object>(
  Comp: React.ComponentType<P>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Comp {...props} />
      </ErrorBoundary>
    )
  }
}

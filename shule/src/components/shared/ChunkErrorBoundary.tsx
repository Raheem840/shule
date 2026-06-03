import { Component, type ReactNode } from 'react'

type Props = { children: ReactNode }
type State = { hasError: boolean }

export class ChunkErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      error.message?.includes('Failed to fetch dynamically imported module') ||
      error.message?.includes('Importing a module script failed')
    return { hasError: isChunkError }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        minHeight: '100dvh',
        gap: 16,
        padding: 32,
        background: 'var(--bg)',
      }}>
        {/* Inline SVG wifi-off icon */}
        <svg
          width="56"
          height="56"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--txt3)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.56 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <circle cx="12" cy="20" r="1" fill="var(--txt3)" stroke="none" />
        </svg>

        <h2 style={{
          fontSize: 18,
          fontWeight: 700,
          color: 'var(--txt)',
          fontFamily: 'var(--font2, inherit)',
          margin: 0,
          textAlign: 'center',
        }}>
          You&rsquo;re offline
        </h2>

        <p style={{
          color: 'var(--txt3)',
          fontSize: 13,
          textAlign: 'center',
          maxWidth: 360,
          margin: 0,
          lineHeight: 1.6,
        }}>
          This page isn&rsquo;t cached yet. Connect to the internet and reload.
        </p>

        <button
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4,
            padding: '9px 24px',
            background: 'var(--brand)',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            letterSpacing: '0.01em',
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}

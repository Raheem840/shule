export function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--bg, #f8fafc)',
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40,
          border: '4px solid var(--brand, #0d9488)',
          borderTopColor: 'transparent',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <p style={{ fontSize: 13, color: 'var(--txt3, #94a3b8)', fontWeight: 600 }}>
          Loading Shule…
        </p>
      </div>
    </div>
  )
}

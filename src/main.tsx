import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './store/AuthContext'
import { ConnectionProvider } from './hooks/useConnectionStatus'
import { BandwidthProvider } from './store/BandwidthContext'
import { ToastProvider } from './components/ui/Toast'
import { queryClient } from './lib/queryClient'
import { restoreQueryCache, persistQueryCache } from './lib/queryPersistence'
import App from './App'
import './index.css'

// Offline write flushing is owned entirely by useSyncQueue.ts (mounted via
// SyncManager in AppShell) — see syncQueue.ts's header comment for why the
// second, redundant flush loop that used to be started here was removed.

// When a new SW version takes over, reload so old chunk hashes don't 404.
// Guard: only fire when there was already a controller (i.e. a real SW swap,
// not the very first install where controller goes null → SW).
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  }, { once: true })
}

async function bootstrap() {
  // Restore previous query cache from IndexedDB so the UI feels instant on reload
  try { await restoreQueryCache(queryClient) } catch { /* IndexedDB unavailable — render cold */ }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ConnectionProvider>
          <AuthProvider>
            <BandwidthProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </BandwidthProvider>
          </AuthProvider>
          </ConnectionProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </StrictMode>
  )

  // Persist cache every 30 seconds and when the tab closes
  const saveInterval = setInterval(() => void persistQueryCache(queryClient), 30_000)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void persistQueryCache(queryClient)
  })
  window.addEventListener('beforeunload', () => {
    void persistQueryCache(queryClient)
    clearInterval(saveInterval)
  })
}

void bootstrap()
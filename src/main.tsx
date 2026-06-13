import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './store/AuthContext'
import { ConnectionProvider } from './hooks/useConnectionStatus'
import { BandwidthProvider } from './store/BandwidthContext'
import { ToastProvider } from './components/ui/Toast'
import { queryClient } from './lib/queryClient'
import { startSyncListener } from './lib/syncQueue'
import { restoreQueryCache, persistQueryCache } from './lib/queryPersistence'
import App from './App'
import './index.css'

startSyncListener()

// When the service worker activates a new version it posts SW_UPDATED.
// Reload the page so users get fresh chunk hashes instead of hitting 404s
// on chunks from the previous deployment.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    window.location.reload()
  })
}

async function bootstrap() {
  // Restore previous query cache from IndexedDB so the UI feels instant on reload
  await restoreQueryCache(queryClient)

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
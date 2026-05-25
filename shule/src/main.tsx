import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './store/AuthContext'
import { BandwidthProvider } from './store/BandwidthContext'
import { ToastProvider } from './components/ui/Toast'
import { queryClient } from './lib/queryClient'
import { startSyncListener } from './lib/syncQueue'
import App from './App'
import './index.css'

startSyncListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BandwidthProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </BandwidthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </StrictMode>
)
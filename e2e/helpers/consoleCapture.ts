import { Page } from '@playwright/test'

export interface CapturedError {
  type: string
  text: string
  url: string
}

export function captureConsoleErrors(page: Page): CapturedError[] {
  const errors: CapturedError[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text(), url: page.url() })
    }
  })
  page.on('pageerror', err => {
    errors.push({ type: 'pageerror', text: err.message, url: page.url() })
  })
  page.on('response', res => {
    if (res.url().includes('supabase') && res.status() >= 400) {
      errors.push({ type: `http_${res.status()}`, text: `${res.status()} -> ${res.url()}`, url: page.url() })
    }
  })
  return errors
}

export function filterNoise(errors: CapturedError[]): CapturedError[] {
  const NOISE = [
    'Could not establish connection',
    'Receiving end does not exist',
    'play() request was interrupted',
    'A listener indicated an asynchronous response',
    'chrome-extension://',
    'Failed to load resource',
    'manifest.webmanifest',
    'sw.js',
    'workbox',
    'Download the React DevTools',
    'Service Worker',
  ]
  return errors.filter(e => !NOISE.some(n => e.text.includes(n)))
}

export function assertNoErrors(errors: CapturedError[], context: string) {
  const real = filterNoise(errors)
  if (real.length > 0) {
    const msg = real.map(e => `[${e.type}] ${e.text}`).join('\n')
    throw new Error(`Console errors on ${context}:\n${msg}`)
  }
}

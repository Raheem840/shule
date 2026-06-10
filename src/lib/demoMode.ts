// demoMode.ts — Utilities for demo/showcase mode.
// When VITE_SHULE_MODE=demo, destructive actions are blocked and a banner is shown.

/** True when the app is running in demo mode (VITE_SHULE_MODE === 'demo'). */
export const isDemoMode: boolean =
  import.meta.env.VITE_SHULE_MODE === 'demo'

/** The fixed school ID used in demo mode (overrideable via VITE_DEMO_SCHOOL_ID). */
export const demoSchoolId: string =
  (import.meta.env.VITE_DEMO_SCHOOL_ID as string | undefined) ??
  '00000000-0000-0000-0000-000000000001'

/**
 * Executes the given action only when not in demo mode.
 * In demo mode, shows an alert with the optional disabled message instead.
 */
export function guardDemo(
  action: () => void,
  disabledMessage = 'This action is disabled in demo mode.'
): void {
  if (isDemoMode) {
    // eslint-disable-next-line no-alert
    alert(disabledMessage)
    return
  }
  action()
}

/**
 * Returns a visible label string when demo mode is active, or null when in production.
 * Use this to render a "Demo Mode" badge in the UI.
 */
export function getDemoModeLabel(): string | null {
  return isDemoMode ? 'Demo Mode' : null
}

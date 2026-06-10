// queryClient.ts — configures React Query, our data fetching layer.
// React Query sits between our components and Supabase.
// It handles caching, background refetching, and loading/error states
// so we don't have to manage them manually in every component.

import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data is considered "fresh" for 5 minutes after fetching.
      // Within this window, navigating back to a page won't re-fetch.
      staleTime: 5 * 60_000,

      // Keep unused data in memory for 1 hour — long enough to serve as an
      // offline fallback if the user loses connectivity while browsing.
      gcTime: 60 * 60_000,

      // Refetch when user switches browser tabs — keeps data current after
      // a long break without penalising the initial load.
      refetchOnWindowFocus: true,

      // Refetch automatically when the browser reconnects — important for
      // offline-first: the moment the user is back online, data refreshes.
      refetchOnReconnect: true,

      // Smart retry: skip retrying on auth errors (would just fail again),
      // allow up to 2 retries for transient network / server errors.
      retry: (failureCount, error) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const status = (error as any)?.status as number | undefined
        if (status === 401 || status === 403) return false
        return failureCount < 2
      },

      // Exponential back-off capped at 30 seconds — avoids hammering a slow
      // school LAN connection with rapid retries.
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
    },
  },
})

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
      staleTime: 1000 * 60 * 5,

      // Keep unused data in memory for 10 minutes before discarding.
      // Useful when a user navigates away and comes back quickly.
      gcTime: 1000 * 60 * 10,

      // Don't refetch when user switches browser tabs and comes back.
      // Important for a school LAN where connections may be slow.
      refetchOnWindowFocus: false,

      // Only retry a failed request once before showing an error.
      // Default is 3 retries which feels slow on a bad connection.
      retry: 1,
    },
  },
})
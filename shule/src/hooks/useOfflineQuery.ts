// useOfflineQuery.ts — Thin wrapper around useQuery that:
//   1. Caches successful responses to IndexedDB
//   2. Returns cached data when the query fails with a network error
//   3. Exposes a `servedFromCache` flag + `cachedAt` date
//
// Usage:
//   const { data, servedFromCache, cachedAt } = useOfflineQuery(
//     'teacher/exams/school-uuid/term1-2025',
//     { queryKey: ['exams'], queryFn: fetchExams }
//   )

import { useEffect, useRef, useState } from 'react'
import {
  useQuery,
  type UseQueryOptions,
  type UseQueryResult,
  type QueryFunctionContext,
} from '@tanstack/react-query'
import { cachePageData, getCachedData } from '../lib/offlineCache'
import { isNetworkError } from './useOfflineMode'

// Maximum age of cached data we will serve (24 hours)
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000

export type UseOfflineQueryResult<T> = UseQueryResult<T, Error> & {
  /** True when the returned data came from IndexedDB (offline fallback) */
  servedFromCache: boolean
  /** When the cached data was written; null when data is fresh */
  cachedAt: Date | null
}

export function useOfflineQuery<T>(
  /** Canonical cache key — use buildCacheKey() from offlineCache.ts */
  cacheKey: string,
  queryOptions: UseQueryOptions<T>,
  { cacheOnSuccess = true }: { cacheOnSuccess?: boolean } = {}
): UseOfflineQueryResult<T> {
  const [servedFromCache, setServedFromCache] = useState(false)
  const [cachedAt,        setCachedAt]        = useState<Date | null>(null)
  const [offlineData,     setOfflineData]     = useState<T | undefined>(undefined)

  // Track the previous successful data so we can cache it
  const lastSuccessRef = useRef<T | undefined>(undefined)

  const result = useQuery<T>({
    ...queryOptions,
    // When we have offline data available, never show an error to React Query —
    // return the cached data as a successful result instead.
    queryFn: async (ctx: QueryFunctionContext) => {
      try {
        const origFn = queryOptions.queryFn as (ctx: QueryFunctionContext) => Promise<T>
        const data = await origFn(ctx)
        return data
      } catch (err) {
        if (isNetworkError(err) || !navigator.onLine) {
          const cached = await getCachedData<T>(cacheKey)
          if (cached && Date.now() - cached.cachedAt.getTime() < MAX_CACHE_AGE_MS) {
            setServedFromCache(true)
            setCachedAt(cached.cachedAt)
            setOfflineData(cached.data)
            return cached.data
          }
        }
        throw err
      }
    },
  })

  // When the query succeeds with fresh data, cache it and clear offline flags
  useEffect(() => {
    if (result.isSuccess && result.data !== undefined) {
      // Only cache if the data actually changed (avoid thrashing IndexedDB)
      if (result.data !== lastSuccessRef.current) {
        lastSuccessRef.current = result.data

        if (cacheOnSuccess && !servedFromCache) {
          // Fire-and-forget — never block the component
          void cachePageData(cacheKey, result.data)
        }

        // Clear the offline flags now that we have fresh data
        if (servedFromCache) {
          setServedFromCache(false)
          setCachedAt(null)
          setOfflineData(undefined)
        }
      }
    }
  }, [result.isSuccess, result.data, cacheKey, cacheOnSuccess, servedFromCache])

  // Merge: when offline data is present, override the result data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return {
    ...result,
    data: (offlineData !== undefined ? offlineData : result.data) as any,
    servedFromCache,
    cachedAt,
  } as UseOfflineQueryResult<T>
}

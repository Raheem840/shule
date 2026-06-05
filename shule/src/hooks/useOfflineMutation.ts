// useOfflineMutation.ts — Mutation wrapper with offline queue fallback.
// When verified online: executes immediately. When offline: queues to IndexedDB.

import { useMutation } from '@tanstack/react-query'
import { queryClient } from '../lib/queryClient'
import { queueSync } from '../lib/db'
import { useConnection } from './useConnectionStatus'
import { useToast } from '../components/ui/Toast'

/** Options for useOfflineMutation. */
interface UseOfflineMutationOptions<TData, TVariables> {
  /** Target Supabase table name — used for the offline queue entry. */
  tableName: string
  /** Async function that performs the actual Supabase write when online. */
  mutationFn: (vars: TVariables) => Promise<TData>
  /** School ID for multi-tenant offline queue isolation. */
  schoolId: string
  /** Called with the result when an online mutation succeeds. */
  onSuccess?: (data: TData) => void
  /** Called when the mutation is queued offline instead of executed immediately. */
  onOfflineQueue?: () => void
  /** Query keys to invalidate after a successful online mutation. */
  invalidateKeys?: unknown[][]
}

/** Return value mirrors useMutation — callers can call mutate(vars) without branching. */
interface UseOfflineMutationResult<TData, TVariables> {
  mutate: (vars: TVariables) => void
  mutateAsync: (vars: TVariables) => Promise<TData | void>
  isPending: boolean
  isError: boolean
  error: Error | null
}

/**
 * Mutation that automatically falls back to the offline sync queue when not connected.
 * Online path: runs mutationFn, invalidates keys, calls onSuccess.
 * Offline path: queues to IndexedDB, shows toast, calls onOfflineQueue.
 */
export function useOfflineMutation<TData, TVariables extends Record<string, unknown>>(
  options: UseOfflineMutationOptions<TData, TVariables>
): UseOfflineMutationResult<TData, TVariables> {
  const {
    tableName, mutationFn, schoolId, onSuccess, onOfflineQueue, invalidateKeys = [],
  } = options

  const { isVerified } = useConnection()
  const toast = useToast()

  const mutation = useMutation<TData, Error, TVariables>({
    mutationFn,
    onSuccess: async (data) => {
      // Invalidate all specified query keys so UI refreshes
      await Promise.all(
        invalidateKeys.map(key => queryClient.invalidateQueries({ queryKey: key }))
      )
      onSuccess?.(data)
    },
  })

  /** Executes the mutation or queues it, depending on connection state. */
  function mutate(vars: TVariables): void {
    if (isVerified) {
      mutation.mutate(vars)
    } else {
      void queueSync(tableName, 'upsert' as 'insert', vars, schoolId)
      toast.info('Saved — will sync when back online')
      onOfflineQueue?.()
    }
  }

  /** Async version for callers that need to await. */
  async function mutateAsync(vars: TVariables): Promise<TData | void> {
    if (isVerified) {
      return mutation.mutateAsync(vars)
    } else {
      await queueSync(tableName, 'upsert' as 'insert', vars, schoolId)
      toast.info('Saved — will sync when back online')
      onOfflineQueue?.()
    }
  }

  return {
    mutate,
    mutateAsync,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  }
}

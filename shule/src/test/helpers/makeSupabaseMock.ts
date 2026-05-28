import { vi } from 'vitest'

/**
 * Factory for a per-table Supabase mock.
 * Call inside vi.hoisted() so it is available before module imports.
 *
 *   const { mockFrom, setResponse, clearResponses } = vi.hoisted(() => {
 *     const { makeSupabaseMock } = require('../helpers/makeSupabaseMock')
 *     return makeSupabaseMock()
 *   })
 */
export function makeSupabaseMock() {
  const tableData: Record<string, any> = {}

  const setResponse    = (table: string, resp: any) => { tableData[table] = resp }
  const clearResponses = () => {
    for (const k of Object.keys(tableData)) delete tableData[k]
  }

  function makeBuilder(table: string) {
    const terminal = () => Promise.resolve(tableData[table] ?? { data: [], error: null })
    const b: any = {
      select:      vi.fn().mockReturnThis(),
      eq:          vi.fn().mockReturnThis(),
      neq:         vi.fn().mockReturnThis(),
      in:          vi.fn().mockReturnThis(),
      is:          vi.fn().mockReturnThis(),
      order:       vi.fn().mockReturnThis(),
      limit:       vi.fn().mockReturnThis(),
      range:       vi.fn().mockReturnThis(),
      insert:      vi.fn().mockReturnThis(),
      update:      vi.fn().mockReturnThis(),
      upsert:      vi.fn().mockReturnThis(),
      delete:      vi.fn().mockReturnThis(),
      single:      vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null }),
      ),
      maybeSingle: vi.fn().mockImplementation(() =>
        Promise.resolve(tableData[table] ?? { data: null, error: null }),
      ),
      then: (res: any, rej?: any) => terminal().then(res, rej),
    }
    return b
  }

  const mockFrom = vi.fn().mockImplementation(makeBuilder)

  return { mockFrom, setResponse, clearResponses }
}

// Maps raw/technical errors (Postgres codes, RLS denials, network failures,
// JS stack traces) to short messages a non-technical user can act on, while
// always logging the original to the console for developer debugging. A
// message that's already a plain, short, hand-written sentence (e.g. a
// deliberately thrown `new Error('Level is required.')`) passes through
// unchanged — this only intercepts the raw/leaky cases, not every error.

interface PostgrestLikeError {
  message?: string
  code?:    string
}

const TECHNICAL_MARKERS = [
  'violates', 'constraint', 'relation "', 'column "', 'duplicate key',
  'row-level security', 'permission denied', 'null value in column',
  'invalid input syntax', 'PGRST', 'JWT',
  'TypeError', 'ReferenceError', 'SyntaxError', 'is not a function', 'is not defined',
  'Cannot read propert', 'Cannot read of', 'undefined is not',
  '  at ', 'at Object.', 'at async', '.tsx:', '.ts:',
]

function looksTechnical(msg: string): boolean {
  if (!msg) return true
  if (msg.length > 160) return true
  return TECHNICAL_MARKERS.some(m => msg.includes(m))
}

function prettifyColumn(col: string): string {
  return col.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function friendlyForPostgres(msg: string, code?: string): string | null {
  if (code === '23505' || /duplicate key value/i.test(msg)) {
    return 'That already exists — check for a duplicate entry.'
  }
  if (code === '23503' || /violates foreign key constraint/i.test(msg)) {
    return "This action references something that no longer exists or isn't linked correctly. Please refresh and try again."
  }
  if (code === '23502' || /null value in column/i.test(msg)) {
    const m = /column "(\w+)"/.exec(msg)
    return m ? `"${prettifyColumn(m[1])}" is required.` : 'A required field is missing.'
  }
  if (code === '42501' || /row-level security|permission denied/i.test(msg)) {
    return "You don't have permission to do that."
  }
  if (/JWT|not authenticated|session.*expired/i.test(msg)) {
    return 'Your session has expired — please sign in again.'
  }
  return null
}

export function getFriendlyErrorMessage(
  input: unknown,
  fallback = 'Something went wrong. Please try again.',
): string {
  // Always log the raw error — this is the "console log the technical
  // errors for debugging" half of the ask, independent of what's displayed.
  if (input != null) console.error('[app error]', input)

  if (input == null) return fallback

  let raw  = ''
  let code: string | undefined
  if (typeof input === 'string') {
    raw = input
  } else if (input instanceof Error) {
    raw = input.message
  } else if (typeof input === 'object') {
    const o = input as PostgrestLikeError
    raw  = o.message ?? ''
    code = o.code
  }

  if (!raw) return fallback

  const pg = friendlyForPostgres(raw, code)
  if (pg) return pg

  if (/Failed to fetch|NetworkError|ERR_INTERNET|ERR_NETWORK|ERR_CONNECTION/i.test(raw)) {
    return 'Connection problem — check your internet and try again.'
  }
  if (/timeout/i.test(raw)) return 'That took too long. Please try again.'

  if (looksTechnical(raw)) return fallback

  return raw
}

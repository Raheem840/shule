// supabase.functions.invoke() throws a generic FunctionsHttpError whose
// .message is always the unhelpful "Edge Function returned a non-2xx status
// code" — the actual reason (permission denied, missing field, upstream
// failure, etc.) is in the JSON body of the raw Response object attached at
// error.context. Without reading it, every edge-function failure in the UI
// looks identical regardless of cause, making them impossible to diagnose
// from a toast message alone.
export async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallback = (error as { message?: string } | null)?.message ?? 'Request failed'
  const context = (error as { context?: unknown } | null)?.context
  if (!context || typeof (context as Response).clone !== 'function') return fallback
  try {
    const body = await (context as Response).clone().json()
    return body?.detail || body?.error || fallback
  } catch {
    return fallback
  }
}

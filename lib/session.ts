// Per-browser-tab session id, scoped per story so switching worlds doesn't
// collide. Backed by sessionStorage; server-side state lives in the in-memory
// store (lib/engine/store.ts) for this build.
export function getOrCreateSessionId(storyId: string): string {
  const key = `narro:session:${storyId}`
  if (typeof window === "undefined") return crypto.randomUUID()
  const existing = window.sessionStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  window.sessionStorage.setItem(key, id)
  return id
}

export function resetSessionId(storyId: string): string {
  const key = `narro:session:${storyId}`
  const id = crypto.randomUUID()
  if (typeof window !== "undefined") window.sessionStorage.setItem(key, id)
  return id
}

// Client-side "stories started" tracking for the home screen ring + recap
// card. Separate from lib/session.ts (which is tab-scoped sessionStorage for
// the live engine session) — this is localStorage so the home screen still
// knows what you've started after the tab closes, without a backend account.
const INDEX_KEY = "narro:progress:index"

export interface StoryProgress {
  storyId: string
  title: string
  cover: string
  chapter: number
  current_objective: string
  stakes: string
  next_event: string
  ended: boolean
  updatedAt: number
}

function readIndex(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(INDEX_KEY)
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

function writeIndex(ids: string[]): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(INDEX_KEY, JSON.stringify(ids))
}

export function saveStoryProgress(entry: Omit<StoryProgress, "updatedAt">): void {
  if (typeof window === "undefined") return
  const progress: StoryProgress = { ...entry, updatedAt: Date.now() }
  window.localStorage.setItem(`narro:progress:${entry.storyId}`, JSON.stringify(progress))
  const ids = readIndex()
  if (!ids.includes(entry.storyId)) writeIndex([...ids, entry.storyId])
}

export function getAllStoryProgress(): StoryProgress[] {
  if (typeof window === "undefined") return []
  const ids = readIndex()
  const entries: StoryProgress[] = []
  for (const id of ids) {
    try {
      const raw = window.localStorage.getItem(`narro:progress:${id}`)
      if (raw) entries.push(JSON.parse(raw) as StoryProgress)
    } catch {
      // skip corrupt entries
    }
  }
  return entries.sort((a, b) => b.updatedAt - a.updatedAt)
}

// Looks up saved progress for a single story, used by the per-story ring so
// each bubble can show that story's own chapter/ended state.
export function getStoryProgress(storyId: string): StoryProgress | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(`narro:progress:${storyId}`)
    return raw ? (JSON.parse(raw) as StoryProgress) : null
  } catch {
    return null
  }
}

// A short story arc is assumed to resolve around this chapter for the
// purposes of the progress ring's fill percentage — there's no fixed total
// chapter count in the data model, so this is a display heuristic only.
export const ESTIMATED_ARC_CHAPTERS = 6

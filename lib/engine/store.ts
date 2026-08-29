// In-memory story/session store (per clarification: no DB for this build).
// Keyed by sessionId -> StoryState. Resets on cold start / server restart —
// acceptable tradeoff for this Phase-0 build; swap for the Postgres schema in
// the architecture doc (§6) when persistence is needed.
import type { StoryState } from "./types"
import { cloneSampleStory, SAMPLE_STORIES } from "./sample-stories"

// A module-level Map survives across requests within the same server process
// (and across Next.js dev HMR via globalThis) but not across cold starts.
const globalForStore = globalThis as unknown as { __narroSessions?: Map<string, StoryState> }

const sessions: Map<string, StoryState> = globalForStore.__narroSessions ?? new Map()
globalForStore.__narroSessions = sessions

export function getSession(sessionId: string): StoryState | undefined {
  return sessions.get(sessionId)
}

export function startSession(sessionId: string, storyId: string): StoryState | null {
  const story = cloneSampleStory(storyId)
  if (!story) return null
  sessions.set(sessionId, story)
  return story
}

export function saveSession(sessionId: string, state: StoryState): void {
  sessions.set(sessionId, state)
}

export function listLibrary() {
  // Ranked discovery feed (architecture §5): for this build, both seed stories,
  // in a fixed editorial order. Real ranking would score by engagement/recency.
  return Object.values(SAMPLE_STORIES).map((story) => {
    return {
      id: story.id,
      title: story.title,
      cover: story.cover,
      premise: story.premise,
      genre: story.genre,
      player_role: story.player_role,
      logline: story.skeleton.logline,
      leads_to: story.leads_to,
    }
  })
}

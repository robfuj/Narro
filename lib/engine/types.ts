// Shared types for the Narro story engine. Mirrors the Postgres-shaped data
// model from the architecture spec (§6) but kept in-memory for this build.

export type Action =
  | "CONTINUE"
  | "DEVELOP"
  | "COMPLICATE"
  | "FORESHADOW"
  | "REVEAL"
  | "CONSEQUENCE"
  | "TURN"
  | "BRANCH"
  | "CLIMAX"
  | "RESOLVE"

export interface CharacterInner {
  emotion?: string | null
  motivation?: string | null
}

export interface Moment {
  id: string
  event: string
  participants: string[]
  tags: string[]
  impact: Record<string, number>
  visibility: string[]
  source: string
  consequence_potential: string
  status: string
}

export interface OpenThread {
  id: string
  priority: "low" | "medium" | "high"
  status: "open" | "closed"
}

export interface BranchMenu {
  continue_story: { action: "continue"; label: string }
  other_stories: { action: "goto"; story_id: string; label: string }[]
  end_here: { action: "end"; label: string }
}

export interface DirectorOutput {
  selected_action: Action
  rationale: string
  scene_goal: string
  relevant_moment_ids: string[]
  affected_entities: string[]
  allowed_facts: string[]
  prohibited_facts: string[]
  character_intentions: Record<string, string>
  player_agency_options: string[]
  pacing_delta: Record<string, number>
  proposed_state_changes: Record<string, number | string | boolean>
  memory_writes: Moment[]
  open_thread_updates: { id: string; priority?: OpenThread["priority"]; status?: OpenThread["status"] }[]
  safety_flags: string[]
  confidence: number
  imagery_cue: string
  character_inner: Record<string, CharacterInner>
  inciting_event?: boolean
  ending?: boolean
  branch_menu?: BranchMenu | null
}

export interface Character {
  name: string
  appearance: string
  goals: string[]
  secrets: string[]
  knowledge: string[]
}

export interface StorySkeleton {
  title: string
  player_fantasy: string
  logline: string
  pressure_engine: string
  opening_scene: string
  arc_beats: string[]
  player_visible_state: string[]
  hidden_director_state: string[]
}

export interface Portrait {
  url: string
  prompt: string
  generated: boolean
  model: string
}

export interface StoryState {
  id: string
  title: string
  cover: string
  skeleton: StorySkeleton
  premise: string
  genre: string
  player_role: string
  state: {
    arc: string
    chapter: number
    current_objective: string
    stakes: string
    theme: string
    scene: string
    canon_flags: Record<string, boolean>
    discovered_clues: string[]
    known_relationships: string[]
    next_event: string
    seen_characters: string[]
    ended: boolean
    transportation?: number
  }
  characters: Record<string, Character>
  moments: Moment[]
  openThreads: OpenThread[]
  knowledge: Record<string, string[]>
  character_images: Record<string, Portrait>
  directorLog: unknown[]
  sequel_of: string | null
  leads_to: string[]
}

export interface TurnResult {
  scene: string
  player_agency_options: string[]
  visible_state_delta: Record<string, number | string | boolean>
  retrieved_memory_ids: string[]
  character_images: Record<string, Portrait>
  ended: boolean
  branch_menu: BranchMenu | null
  safety: { decision: "allow" | "block"; flags: string[] }
  narrative: { transportation: number; warnings: string[] }
  director: {
    selected_action: Action
    rationale: string
  }
  used_ai: boolean
  state_snapshot: StoryState["state"]
  open_threads_snapshot: OpenThread[]
}

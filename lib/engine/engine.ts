// Story Engine orchestrator (architecture §3, §4.1). Stateless — owns the
// per-turn sequence: load state -> Cast sub-agents -> Director -> Rules Layer
// -> Scene -> Safety -> commit. No creative logic lives here.
import { aiDirector, mockDirector } from "./director"
import { aiScene, mockScene } from "./scene"
import { runCastAgents } from "./cast-agent"
import { rulesLayer, safeDevelop } from "./rules"
import { estimateTransportation, narrativeQualityWarnings } from "./narrative-quality"
import { resolveCharacterPortrait } from "./image"
import { classifySafety } from "./safety"
import type { DirectorOutput, Portrait, StoryState, TurnResult } from "./types"

function applyStateChanges(state: StoryState, director: DirectorOutput) {
  for (const [key, value] of Object.entries(director.proposed_state_changes || {})) {
    // "state.*" and "canon_flags.*" keys mutate player-visible/canon state
    // directly; relationship./world.* deltas are tracked narratively for this
    // in-memory build. Without the state.* cases below a Director that advances
    // the chapter or the next event has no effect, and the story reads as stuck.
    if (key.startsWith("canon_flags.")) {
      const flag = key.slice("canon_flags.".length)
      state.state.canon_flags[flag] = Boolean(value)
    } else if (key === "state.chapter" && typeof value === "number") {
      state.state.chapter = value
    } else if (key === "state.next_event" && typeof value === "string") {
      state.state.next_event = value
    } else if (key === "state.current_objective" && typeof value === "string") {
      state.state.current_objective = value
    } else if (key === "state.scene" && typeof value === "string") {
      state.state.scene = value
    }
  }
}

function applyThreadUpdates(state: StoryState, director: DirectorOutput) {
  for (const update of director.open_thread_updates || []) {
    const existing = state.openThreads.find((t) => t.id === update.id)
    if (existing) {
      if (update.priority) existing.priority = update.priority
      if (update.status) existing.status = update.status
    } else {
      state.openThreads.push({ id: update.id, priority: update.priority || "medium", status: update.status || "open" })
    }
  }
}

function applyKnowledge(state: StoryState, director: DirectorOutput) {
  for (const fact of director.allowed_facts || []) {
    const holders = new Set(state.knowledge[fact] || [])
    for (const entity of director.affected_entities || []) holders.add(entity)
    state.knowledge[fact] = Array.from(holders)
  }
}

export interface TurnOptions {
  useAi: boolean
}

export async function runTurn(state: StoryState, playerInput: string, opts: TurnOptions): Promise<TurnResult> {
  // Multi-agent step 1 — the cast reacts FIRST. Each character reasons for
  // itself, from only what it personally witnessed, about what the player just
  // said. The brain then plans the beat around those real thoughts instead of
  // inventing everyone's reactions after the fact.
  const cast = await runCastAgents(
    state.characters,
    { playerInput, moments: state.moments, state: state.state },
    opts.useAi,
  )

  const directorInput = {
    input: playerInput,
    state: state.state,
    moments: state.moments,
    characters: state.characters,
    openThreads: state.openThreads,
    knowledge: state.knowledge,
    leadsTo: state.leads_to,
    castThoughts: cast,
  }

  let director: DirectorOutput
  let usedAi = false

  if (opts.useAi) {
    try {
      director = await aiDirector(directorInput)
      usedAi = true
    } catch {
      director = mockDirector(directorInput)
    }
  } else {
    director = mockDirector(directorInput)
  }

  let verdict = rulesLayer(director, { knowledge: state.knowledge, state: state.state })
  if (!verdict.ok) {
    if (opts.useAi) {
      try {
        director = await aiDirector({ ...directorInput, violation: verdict.errors })
        usedAi = true
        verdict = rulesLayer(director, { knowledge: state.knowledge, state: state.state })
      } catch {
        // fall through to safe fallback below
      }
    }
    if (!verdict.ok) {
      director = safeDevelop(director, verdict.errors)
    }
  }

  const warnings = narrativeQualityWarnings(director)
  const transportation = estimateTransportation(director, { openThreads: state.openThreads })
  state.state.transportation = transportation

  let sceneText: string
  if (opts.useAi && usedAi) {
    try {
      sceneText = await aiScene(director, cast)
    } catch {
      sceneText = mockScene(director, cast)
    }
  } else {
    sceneText = mockScene(director, cast)
  }

  const safety = classifySafety(sceneText)
  if (safety.decision === "block") {
    sceneText = "The scene falters here — try rephrasing your last action."
  }

  applyStateChanges(state, director)
  applyThreadUpdates(state, director)
  applyKnowledge(state, director)

  if (director.selected_action === "RESOLVE" && director.ending) {
    state.state.ended = true
  }

  // Resolve portraits for every character newly present in this beat (idempotent).
  const images: Record<string, Portrait> = {}
  for (const entity of director.affected_entities || []) {
    const character = state.characters[entity]
    if (!character) continue
    if (!state.state.seen_characters.includes(entity)) state.state.seen_characters.push(entity)
    images[entity] = resolveCharacterPortrait(entity, character, state.character_images)
  }

  state.moments.push(...(director.memory_writes || []))
  state.directorLog.push({
    turn_index: state.directorLog.length,
    input: playerInput,
    director_json: director,
    accepted: verdict.ok,
  })

  return {
    scene: sceneText,
    reader_callout: director.reader_callout ?? "",
    cast,
    player_agency_options: director.player_agency_options,
    visible_state_delta: director.proposed_state_changes,
    retrieved_memory_ids: director.relevant_moment_ids,
    character_images: images,
    ended: state.state.ended,
    branch_menu: director.ending ? director.branch_menu ?? null : null,
    safety,
    narrative: { transportation, warnings },
    director: { selected_action: director.selected_action, rationale: director.rationale },
    used_ai: usedAi,
    state_snapshot: state.state,
    open_threads_snapshot: state.openThreads,
  }
}

// Evidence-based narrative quality model.
//
// Grounded in:
//  - Fischer & Thies (2026), JCOM "What makes a good story? An empirical analysis
//    of the factors that constitute 'good' storytelling in science communication."
//  - The Transportation-Imagery Model (Green & Brock, 2000).
//
// KEY EMPIRICAL FINDINGS (do not overclaim beyond these):
//  1. Narrative depth (vivid imagery + protagonist emotions/motivations) did NOT
//     directly raise perceived story quality (H1: β=.057, p=.174, NOT significant).
//  2. Perceived story quality -> TRANSPORTATION (β=.733, p<.001).
//  3. Transportation -> topic interest (β=.697, p<.001), and quality -> interest
//     directly (β=.121) + mediated by transportation (indirect β=.511).
//  4. => TRANSPORTATION is the dominant, empirically-established mediator of
//     engagement. Imagery + character emotion/motivation are its LEVERS
//     (Transportation-Imagery Model), not direct quality dials.
//  5. Exploratory: prior familiarity/knowledge raised quality, transportation,
//     interest (r=.31/.26/.18). => surfacing prior knowledge (our memory/recap)
//     boosts transportation.
//
// APPLICATION: the Director optimizes TRANSPORTATION, not raw "depth". Every
// non-CONTINUE beat must (a) carry a concrete imagery cue, (b) externalize each
// relevant character's emotion + motivation, and (c) preserve player agency
// (identification with the protagonist). The engine tracks transportation as a
// first-class state variable and the Director prefers actions that sustain it.
import type { CharacterInner, DirectorOutput, OpenThread } from "./types"

// Heuristically estimate transportation (0-100) from a Director brief + state.
// This is a lightweight proxy used by the Director to choose beats; it is NOT a
// claim of psychological measurement — it operationalizes the TIM levers.
export function estimateTransportation(brief: DirectorOutput, state: { openThreads?: OpenThread[] }): number {
  let score = 0

  // 1) Mental imagery: a concrete sensory cue is present.
  if (brief.imagery_cue && brief.imagery_cue.trim().length > 0) score += 25

  // 2) Identification: character inner states (emotion + motivation) surfaced.
  const inner = brief.character_inner || {}
  const withInner = Object.values(inner).filter((v) => v && (v.emotion || v.motivation)).length
  score += Math.min(25, withInner * 8)

  // 3) Agency / protagonist identification: real, distinct options available.
  const opts = brief.player_agency_options || []
  if (opts.length >= 2) score += 20
  if (opts.length >= 3) score += 5

  // 4) Familiarity: prior knowledge surfaced via retrieved moments / open threads.
  const prior = (brief.relevant_moment_ids || []).length + (state?.openThreads ? state.openThreads.length : 0)
  score += Math.min(20, prior * 4)

  // 5) Continuity payoff: a CONSEQUENCE/REVEAL/TURN that uses earned setup.
  if (["CONSEQUENCE", "REVEAL", "TURN", "CLIMAX"].includes(brief.selected_action) && (brief.relevant_moment_ids || []).length > 0)
    score += 5

  // Penalty: pure CONTINUE with no imagery loses immersion.
  if (brief.selected_action === "CONTINUE" && !brief.imagery_cue) score -= 10

  return Math.max(0, Math.min(100, score))
}

// Soft validation (WARN, not reject): the paper found depth doesn't directly lift
// quality, so we don't hard-block on it — but the Director should still emit the
// levers so transportation has material to work with.
export function narrativeQualityWarnings(brief: DirectorOutput): string[] {
  const warnings: string[] = []
  if (brief.selected_action !== "CONTINUE") {
    if (!brief.imagery_cue) warnings.push("no imagery_cue: weakens mental imagery (TIM lever)")
    const inner = brief.character_inner || {}
    const anyInner = Object.values(inner).some((v) => v && (v.emotion || v.motivation))
    if (!anyInner) warnings.push("no character_inner: weakens identification (TIM lever)")
  }
  return warnings
}

// Build the IMAGERY + CHARACTER_INNER scaffolding into a Director brief so the
// scene model externalizes it. Used by mock + real Director.
export function withQualityLevers(brief: DirectorOutput): DirectorOutput {
  const character_inner: Record<string, CharacterInner> = { ...(brief.character_inner || {}) }
  for (const [name, intent] of Object.entries(brief.character_intentions || {})) {
    character_inner[name] = character_inner[name] || {
      emotion: null,
      motivation: typeof intent === "string" ? intent : null,
    }
  }
  return { ...brief, character_inner }
}

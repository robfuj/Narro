// Deterministic rules layer — runs AFTER the Director, BEFORE the scene model.
// This is the drift-prevention guard. Rejects invalid Director output.
// Pure function, no model calls — this is the product's core moat (architecture §8).
import { validateDirectorSchema } from "./schema"
import type { DirectorOutput } from "./types"

export interface RulesContext {
  knowledge: Record<string, string[]>
  state: { canon_flags: Record<string, boolean> }
}

export type RulesVerdict = { ok: true } | { ok: false; errors: string[] }

export function rulesLayer(director: DirectorOutput, ctx: RulesContext): RulesVerdict {
  const errors = validateDirectorSchema(director)
  if (errors.length) return { ok: false, errors }

  // AGENCY: must offer >= 2 distinct player options.
  if (director.player_agency_options.length < 2) {
    errors.push("agency: fewer than 2 player_agency_options")
  }

  // REVEAL must be grounded in a stored Moment OR explicitly flagged as a new inciting event.
  if (director.selected_action === "REVEAL") {
    const hasMoment = (director.relevant_moment_ids || []).length > 0
    const inciting = director.inciting_event === true
    if (!hasMoment && !inciting) {
      errors.push("REVEAL without linked moment or inciting_event flag")
    }
  }

  // KNOWLEDGE BOUNDARY: a REVEAL about a fact not held by its participants is illegal
  // unless it is a deliberate new inciting event.
  const knowledge = ctx.knowledge || {}
  if (director.selected_action === "REVEAL" && !director.inciting_event) {
    for (const fact of director.allowed_facts) {
      const holders = knowledge[fact]
      const participants = director.affected_entities || []
      if (Array.isArray(holders) && holders.length && !participants.some((p) => holders.includes(p))) {
        errors.push(`knowledge boundary: ${fact} revealed to characters who do not hold it`)
      }
    }
  }

  // CONTINUITY: a non-TURN/CLIMAX action may not flip an established canon flag.
  const canon = (ctx.state && ctx.state.canon_flags) || {}
  const changes = director.proposed_state_changes || {}
  for (const [k, v] of Object.entries(changes)) {
    if (
      Object.prototype.hasOwnProperty.call(canon, k) &&
      canon[k] !== v &&
      director.selected_action !== "TURN" &&
      director.selected_action !== "CLIMAX"
    ) {
      errors.push(`continuity: ${k} changes established canon without TURN/CLIMAX`)
    }
  }

  // PATH RANKING: a non-ranked RESOLVE must not frame one payoff as objectively correct.
  if (director.selected_action === "RESOLVE") {
    const graded =
      /(you failed|wrong choice|you should have|incorrect|score:|grade:|you did the right thing|you made the wrong)/i.test(
        director.rationale || "",
      )
    if (graded) errors.push("path ranking: RESOLVE frames a choice as graded/correct — forbidden")
  }

  // ROMANCE DRIFT (hard, code-level — Age & Content Policy §3): the launch scope is
  // adventure-only; character_intentions / pacing_delta / scene_goal must not trend
  // romantic or sexual regardless of user input. Enforced here, not via prompt only.
  const ROMANCE =
    /(romance|romantic|kiss|kisses|lover|beloved|crush|date|dating|sexual|seduce|seduction|flirt|flirting|intimate desire|yearns? for .* love|in love with)/i
  const intentionText = JSON.stringify(director.character_intentions || {})
  if (
    ROMANCE.test(intentionText) ||
    ROMANCE.test(director.scene_goal || "") ||
    ROMANCE.test(JSON.stringify(director.pacing_delta || {}))
  ) {
    errors.push("romance drift: Director output trends romantic/sexual (adventure-only scope)")
  }

  return errors.length ? { ok: false, errors } : { ok: true }
}

// Safe fallback: advance the scene without any state shift.
export function safeDevelop(director: DirectorOutput, prevErrors: string[]): DirectorOutput {
  return {
    ...director,
    selected_action: "DEVELOP",
    rationale: `Rules layer rejected original output (${prevErrors.join("; ")}). Safe DEVELOP fallback.`,
    proposed_state_changes: {},
    memory_writes: [],
    player_agency_options: ["continue", "ask", "leave"],
    confidence: 0.5,
  }
}

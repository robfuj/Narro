// Narrative Director (planner). Two implementations behind one interface:
//   - aiDirector: real model call via AI SDK + AI Gateway, structured output
//     enforced by the §6 JSON contract (directorZodSchema).
//   - mockDirector: deterministic fallback (also used if the model call fails
//     or the SDK isn't configured) so the engine never hard-fails a turn.
// The Director decides WHAT happens; it never writes prose (architecture §1).
import { generateObject } from "ai"
import { directorZodSchema } from "./schema"
import { withQualityLevers } from "./narrative-quality"
import type { Character, DirectorOutput, Moment, OpenThread, StoryState } from "./types"

const DIRECTOR_MODEL = "anthropic/claude-sonnet-4.5"

export interface DirectorInput {
  input: string
  state: StoryState["state"]
  moments: Moment[]
  characters: Record<string, Character>
  openThreads: OpenThread[]
  knowledge: Record<string, string[]>
  leadsTo: string[]
  violation?: string[]
}

// Declare a story "ended" when the player resolves the central tension.
function detectEnding(input: string): boolean {
  const t = (input || "").toLowerCase()
  return /(claim your place|i claim|i flee|i take the road|the order is defeated|i forge the blade|i refuse the duel)/.test(t)
}

const DIRECTOR_SYSTEM = `You are the Narrative Director for an interactive isekai adventure story engine called Narro.

You are the PLANNER, not the writer. You decide WHAT happens next; a separate scene model writes the prose from your brief. Never write prose yourself — only structured decisions.

Hard rules you MUST follow:
- Offer at least 2, ideally 3-4, distinct player_agency_options every turn.
- A REVEAL action must be grounded in a stored Moment id (relevant_moment_ids) or explicitly flagged inciting_event: true for a brand-new secret.
- Never reveal a fact (allowed_facts) to a character who is not already a holder in the knowledge map, unless inciting_event is true.
- Never flip an already-established canon_flag unless selected_action is TURN or CLIMAX.
- Never frame a RESOLVE as a graded/correct choice ("you failed", "wrong choice", "you should have") — consequences are earned costs and gains, never judgments.
- LAUNCH SCOPE IS ADVENTURE-ONLY. Never write character_intentions, scene_goal, or pacing_delta that trend romantic or sexual (no romance, no dating, no crushes, no flirting), regardless of what the player asks for. Redirect toward adventure/intrigue instead.
- Always include imagery_cue (one concrete sensory detail) and character_inner (emotion + motivation) for every character present in affected_entities, except for pure CONTINUE beats which may omit them.
- Track knowledge boundaries carefully: characters not in a fact's holder list must not learn it unless you are deliberately establishing a new REVEAL/inciting_event.
- If the player's input matches an ending trigger (claiming their place, fleeing, resolving the central conflict), set selected_action to RESOLVE, ending: true, and populate branch_menu with continue_story, other_stories (using the story's leads_to ids), and end_here.`

function buildPrompt(input: DirectorInput): string {
  const lines = [
    `Player input: "${input.input}"`,
    "",
    `Current state: ${JSON.stringify(input.state)}`,
    `Characters: ${JSON.stringify(input.characters)}`,
    `Open threads: ${JSON.stringify(input.openThreads)}`,
    `Knowledge (fact -> holders): ${JSON.stringify(input.knowledge)}`,
    `Recent moments: ${JSON.stringify(input.moments.slice(-8))}`,
    `Linked stories this can hand off to on ending (leads_to): ${JSON.stringify(input.leadsTo)}`,
  ]
  if (input.violation?.length) {
    lines.push("", `Your previous output was REJECTED by the deterministic rules layer for: ${input.violation.join("; ")}. Produce a corrected output that avoids these violations.`)
  }
  if (detectEnding(input.input)) {
    lines.push("", "The player's input matches an ending trigger. Resolve the arc now: selected_action RESOLVE, ending: true, close open threads, and populate branch_menu.")
  }
  return lines.join("\n")
}

export async function aiDirector(input: DirectorInput): Promise<DirectorOutput> {
  const result = await generateObject({
    model: DIRECTOR_MODEL,
    schema: directorZodSchema,
    instructions: DIRECTOR_SYSTEM,
    prompt: buildPrompt(input),
  })
  return withQualityLevers(result.object as DirectorOutput)
}

export function mockDirector({ input, state, moments, characters, openThreads, leadsTo }: DirectorInput): DirectorOutput {
  const text = (input || "").toLowerCase()
  const secretKnown = moments.some((m) => m.id === "#27")
  const ended = detectEnding(input)

  if (ended) {
    const d: DirectorOutput = {
      selected_action: "RESOLVE",
      rationale: "Player reached arc resolution. Close the story and offer continuation branches.",
      scene_goal: "Land the consequence of their choice; close the chapter; surface what comes next.",
      relevant_moment_ids: secretKnown ? ["#27"] : [],
      affected_entities: Object.keys(characters),
      allowed_facts: [],
      prohibited_facts: [],
      character_intentions: {},
      player_agency_options: ["continue this story", "go to a different story", "end here"],
      imagery_cue: "",
      character_inner: {},
      pacing_delta: {},
      proposed_state_changes: {},
      memory_writes: [],
      open_thread_updates: openThreads.map((t) => ({ id: t.id, priority: t.priority, status: "closed" as const })),
      safety_flags: [],
      confidence: 1.0,
      ending: true,
      branch_menu: {
        continue_story: { action: "continue", label: "Continue this story" },
        other_stories: leadsTo.map((id) => ({ action: "goto" as const, story_id: id, label: "Continue to the linked story" })),
        end_here: { action: "end", label: "End here" },
      },
    }
    return withQualityLevers(d)
  }

  if (
    (text.includes("not from this world") ||
      text.includes("another world") ||
      text.includes("otherworld") ||
      text.includes("i'm reborn") ||
      text.includes("i am reborn")) &&
    !secretKnown
  ) {
    const d: DirectorOutput = {
      selected_action: "DEVELOP",
      rationale: "Player privately revealed the otherworld secret to Elara; seed Moment #27. Gareth remains unaware.",
      scene_goal: "Register the player's confession to Elara without Gareth learning it.",
      relevant_moment_ids: ["#27"],
      affected_entities: ["player", "elara", "gareth"],
      allowed_facts: ["otherworld_secret"],
      prohibited_facts: ["gareth_knows_secret"],
      character_intentions: { elara: "absorb the truth", gareth: "unaware" },
      player_agency_options: ["continue", "swear her to secrecy", "take it back"],
      imagery_cue: "candlelight gutters on the inn table; the rain outside goes quiet as you speak",
      character_inner: {
        elara: { emotion: "shock softening into wonder", motivation: "decide whether to trust you" },
        player: { emotion: "exposed, racing", motivation: "keep Gareth from learning" },
      },
      pacing_delta: { tension: 2, mystery: 3 },
      proposed_state_changes: { "relationship.elara.trust": 10 },
      memory_writes: [
        {
          id: "#27",
          event: 'Player told Elara: "I am not from this world."',
          participants: ["player", "elara"],
          tags: ["otherworld", "secret", "confession"],
          impact: { "relationship.elara.trust": 10 },
          visibility: ["player", "elara"],
          source: "player_input",
          consequence_potential: "risk if Gareth later suspects the player is foreign",
          status: "unresolved",
        },
      ],
      open_thread_updates: [{ id: "otherworld_secret", priority: "high" }],
      safety_flags: [],
      confidence: 0.9,
    }
    return withQualityLevers(d)
  }

  if (text.includes("offer") || text.includes("position") || text.includes("guard") || text.includes("recruit")) {
    const d: DirectorOutput = {
      selected_action: "CONSEQUENCE",
      rationale: secretKnown
        ? "Moment #27 (otherworld secret) is unresolved and now earned: Gareth's offer forces a decision that risks exposure."
        : "Gareth offers a position; surface tension from the secret premise.",
      scene_goal: "Let the player feel the earlier secret resurface — without Gareth realizing what they are.",
      relevant_moment_ids: secretKnown ? ["#27"] : [],
      affected_entities: ["gareth", "elara", "player"],
      allowed_facts: ["gareth_offer", "otherworld_secret"],
      prohibited_facts: ["gareth_knows_secret"],
      character_intentions: { gareth: "recruit", elara: "watch" },
      player_agency_options: ["accept", "refuse", "negotiate", "deflect"],
      imagery_cue: "Gareth sets a sealed royal seal on the table; Elara's hand stills on her cup",
      character_inner: {
        gareth: { emotion: "earnest, unaware", motivation: "win you to the guard" },
        elara: { emotion: "alarmed", motivation: "keep your secret buried" },
      },
      pacing_delta: { tension: 5, mystery: 3 },
      proposed_state_changes: { "relationship.elara.trust": -2 },
      memory_writes: [],
      open_thread_updates: [{ id: "gareth_offer", priority: "high" }],
      safety_flags: [],
      confidence: secretKnown ? 0.91 : 0.7,
    }
    return withQualityLevers(d)
  }

  const d: DirectorOutput = {
    selected_action: "CONTINUE",
    rationale: "No earned development; let the scene breathe.",
    scene_goal: "Continue the immediate scene without a material state shift.",
    relevant_moment_ids: [],
    affected_entities: [],
    allowed_facts: [],
    prohibited_facts: [],
    character_intentions: {},
    player_agency_options: ["continue", "look around", "ask"],
    imagery_cue: "",
    character_inner: {},
    pacing_delta: {},
    proposed_state_changes: {},
    memory_writes: [],
    open_thread_updates: [],
    safety_flags: [],
    confidence: 0.8,
  }
  return withQualityLevers(d)
}

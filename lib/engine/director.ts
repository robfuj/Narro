// Narrative Director (planner). Two implementations behind one interface:
//   - aiDirector: real model call via AI SDK + AI Gateway, structured output
//     enforced by the §6 JSON contract (directorZodSchema).
//   - mockDirector: deterministic fallback (also used if the model call fails
//     or the SDK isn't configured) so the engine never hard-fails a turn.
// The Director decides WHAT happens; it never writes prose (architecture §1).
import { generateObject } from "ai"
import { directorZodSchema } from "./schema"
import { withQualityLevers } from "./narrative-quality"
import { getDirectorModel } from "./model"
import type { CastAgentOutput, Character, DirectorOutput, Moment, OpenThread, StoryState } from "./types"

export interface DirectorInput {
  input: string
  state: StoryState["state"]
  moments: Moment[]
  characters: Record<string, Character>
  openThreads: OpenThread[]
  knowledge: Record<string, string[]>
  leadsTo: string[]
  // Each present character's own sub-agent answer, produced BEFORE the brain
  // plans. The Director must plan around these rather than invent reactions.
  castThoughts: Record<string, CastAgentOutput>
  violation?: string[]
}

// Declare a story "ended" when the player resolves the central tension.
function detectEnding(input: string): boolean {
  const t = (input || "").toLowerCase()
  return /(claim your place|i claim|i flee|i take the road|the order is defeated|i forge the blade|i refuse the duel)/.test(t)
}

const DIRECTOR_SYSTEM = `You are the Narrative Director for an interactive otherworld adventure story engine called Narro.

You are the PLANNER, not the writer. You decide WHAT happens next; a separate scene model writes the prose from your brief. Never write prose yourself — only structured decisions.

Hard rules you MUST follow:
- The cast sub-agents have ALREADY answered for themselves before you plan. Their thoughts are listed below. Plan the beat AROUND what each character actually feels, wants, and intends — use their intentions to drive the scene, put their wants in friction with each other, and decide who gets what. Never contradict a character's stated thought, and never substitute a different reaction for them. If a character wants something from the player, build the beat so that want presses on the player.
- player_agency_options is INTERNAL planning signal only. The reader is never shown a menu — they write freely, in their own words, every turn. Use these options only to anticipate what the reader might do so your consequences are ready. Never funnel the reader toward them in scene_goal, and never write a beat that only makes sense if the reader picks from a list.
- A REVEAL action must be grounded in a stored Moment id (relevant_moment_ids) or explicitly flagged inciting_event: true for a brand-new secret.
- Never reveal a fact (allowed_facts) to a character who is not already a holder in the knowledge map, unless inciting_event is true.
- Never flip an already-established canon_flag unless selected_action is TURN or CLIMAX.
- Never frame a RESOLVE as a graded/correct choice ("you failed", "wrong choice", "you should have") — consequences are earned costs and gains, never judgments.
- LAUNCH SCOPE IS ADVENTURE-ONLY. Never write character_intentions, scene_goal, or pacing_delta that trend romantic or sexual (no romance, no dating, no crushes, no flirting), regardless of what the player asks for. Redirect toward adventure/intrigue instead.
- Always include imagery_cue (one concrete sensory detail) and character_inner (emotion + motivation) for every character present in affected_entities, except for pure CONTINUE beats which may omit them.
- Every turn, write reader_callout: ONE short, punchy line (max ~20 words) where the narrator speaks DIRECTLY to the reader as "you", breaking the fourth wall just enough to hook them — a challenge, a warning, a question, or a "here's what you need to know" beat that makes them feel personally implicated in what just happened. Keep it adventure-only and never let it reveal a prohibited fact. It is rendered separately from the scene prose, so do not fold it into scene_goal.
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

  // The cast answered for themselves first. Handing their thoughts to the brain
  // is what makes this a multi-agent system rather than one model doing voices.
  const thoughts = Object.values(input.castThoughts || {})
  if (thoughts.length) {
    lines.push(
      "",
      "WHAT EACH CHARACTER IS THINKING RIGHT NOW (their own sub-agents, answered before you planned — plan around this, never contradict it):",
      ...thoughts.map((c) => {
        const bits = [`- ${c.character}:`]
        if (c.emotion) bits.push(`feels ${c.emotion};`)
        if (c.intent) bits.push(`intends to ${c.intent};`)
        if (c.wants_from_player) bits.push(`wants from the player: ${c.wants_from_player};`)
        bits.push(c.line ? `will say: "${c.line}"` : "will stay silent")
        return bits.join(" ")
      }),
    )
  }
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
    model: getDirectorModel(),
    schema: directorZodSchema,
    instructions: DIRECTOR_SYSTEM,
    prompt: buildPrompt(input),
  })
  return withQualityLevers(result.object as DirectorOutput)
}

export function mockDirector({ input, state, moments, characters, openThreads, leadsTo, castThoughts }: DirectorInput): DirectorOutput {
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
      reader_callout: "So this is how your chapter closes — but here, every ending is also a door. Which one do you walk through?",
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
      reader_callout: "You just said the one thing you can never take back. Feel that? That's the story tightening around you.",
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
      reader_callout: "Here's where it gets real — the choice you make next is the one everyone will remember.",
      pacing_delta: { tension: 5, mystery: 3 },
      proposed_state_changes: { "relationship.elara.trust": -2 },
      memory_writes: [],
      open_thread_updates: [{ id: "gareth_offer", priority: "high" }],
      safety_flags: [],
      confidence: secretKnown ? 0.91 : 0.7,
    }
    return withQualityLevers(d)
  }

  // Even a quiet CONTINUE beat has people in the room. Keep the characters
  // already present in the scene affected so their sub-agents keep reacting —
  // otherwise the cast layer goes silent on the most common beat.
  const present = state.seen_characters.filter((id) => characters[id])
  const affected = present.length ? present : Object.keys(characters)

  // The cast already answered for themselves. Even the deterministic brain must
  // plan around what they actually want, rather than ignoring them and emitting
  // a generic "let the scene breathe" beat.
  const thoughts = Object.values(castThoughts || {})
  const wants = thoughts.map((c) => c.wants_from_player || c.intent).filter(Boolean)

  const d: DirectorOutput = {
    selected_action: "CONTINUE",
    rationale: wants.length
      ? `No earned development yet; let the scene breathe while the cast presses their own wants: ${wants.join("; ")}.`
      : "No earned development; let the scene breathe.",
    scene_goal: wants.length
      ? `Continue the scene while the people in the room press what they want: ${wants.join("; ")}.`
      : "Continue the immediate scene without a material state shift.",
    relevant_moment_ids: [],
    affected_entities: ["player", ...affected],
    allowed_facts: [],
    prohibited_facts: [],
    character_intentions: Object.fromEntries(thoughts.map((c) => [c.character, c.intent])),
    player_agency_options: ["continue", "look around", "ask"],
    imagery_cue: "",
    // Carry each sub-agent's own emotion/motivation into the brief so the brain
    // and the renderer agree on who each character is right now.
    character_inner: Object.fromEntries(
      thoughts.map((c) => [c.character, { emotion: c.emotion, motivation: c.motivation || c.intent }]),
    ),
    reader_callout: "Stay close — this world only shows its hand to the ones who keep moving.",
    pacing_delta: {},
    proposed_state_changes: {},
    memory_writes: [],
    open_thread_updates: [],
    safety_flags: [],
    confidence: 0.8,
  }
  return withQualityLevers(d)
}

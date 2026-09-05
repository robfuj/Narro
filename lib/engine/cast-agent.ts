// Cast sub-agents (multi-agent layer).
//
// The Director is the single "brain" — it plans the beat and narrates. Each
// cast member is a separate sub-agent that reasons for itself: it gets its own
// persona, its own goals/secrets, and ONLY the memories its character actually
// witnessed (the knowledge-boundary model).
//
// Order matters: the cast answers BEFORE the brain plans. Each sub-agent reacts
// to what the player just said, from its own knowledge, and the Director then
// plans the beat around those real thoughts — so character intentions drive the
// story instead of being invented after the fact. The brain never writes a
// character's dialogue for them; the Scene renderer weaves their own answers
// into prose.
import { generateObject } from "ai"
import { z } from "zod"
import { getCastModel } from "./model"
import type { CastAgentOutput, Character, Moment, StoryState } from "./types"

export type { CastAgentOutput }

// Everything a cast sub-agent needs to reason about the current beat. There is
// no Director brief yet — the cast answers first, and the brain reads this.
export interface CastContext {
  // What the player just said or did: the thing every character reacts to.
  playerInput: string
  moments: Moment[]
  state: StoryState["state"]
}

const castAgentSchema = z.object({
  intent: z.string().default(""),
  line: z.string().default(""),
  emotion: z.string().default(""),
  motivation: z.string().default(""),
  wants_from_player: z.string().default(""),
})

function buildPersona(character: Character): string {
  const parts: string[] = []
  parts.push(`You are ${character.name}, a character in an interactive otherworld adventure called Narro.`)
  parts.push(`You are NOT an assistant and NOT a narrator. You are this person, in this moment, thinking only your own thoughts.`)
  if (character.appearance) parts.push(`Your appearance: ${character.appearance}`)
  if (character.goals?.length) parts.push(`Your goals: ${character.goals.join("; ")}`)
  if (character.secrets?.length) {
    parts.push(
      `Your secrets (you know these, and you guard them — never volunteer them unless the moment forces it): ${character.secrets.join("; ")}`,
    )
  }
  if (character.knowledge?.length) parts.push(`What you know: ${character.knowledge.join("; ")}`)
  return parts.join("\n\n")
}

// A sub-agent may only reason from what its own character witnessed. Filtering
// the memory packet per agent is what makes these real separate agents rather
// than one prompt wearing several hats.
function memoriesFor(characterId: string, moments: Moment[]): string[] {
  return moments
    .filter((m) => m.participants.includes(characterId) || m.visibility.includes(characterId) || m.visibility.includes("all"))
    .slice(-6)
    .map((m) => `- ${m.event}`)
}

function buildCastPrompt(character: Character, ctx: CastContext): string {
  const parts: string[] = []

  parts.push(
    `THE SITUATION:\nScene: ${ctx.state.scene}\nObjective: ${ctx.state.current_objective}\nStakes: ${ctx.state.stakes}`,
  )

  const memories = memoriesFor(character.name.toLowerCase(), ctx.moments)
  if (memories.length) {
    parts.push(`WHAT YOU REMEMBER (only what you personally witnessed):\n${memories.join("\n")}`)
  } else {
    parts.push(`You have witnessed nothing yet — you are meeting this situation fresh.`)
  }

  parts.push(`THE PLAYER JUST SAID OR DID:\n"${ctx.playerInput}"`)

  parts.push(
    `React as ${character.name}, from only what you know. Decide what you feel, what you are trying to do, and what you want from the player. Write "line" as ONE short spoken line in your own voice (max ~25 words) — or leave it empty if you would stay silent. If the player said something you have no way of knowing about, react with confusion or suspicion, never with knowledge you do not have. Never break character, never address the reader directly, and keep it adventure-only (no romantic or sexual framing).`,
  )

  return parts.join("\n\n")
}

export async function aiCastAgent(character: Character, ctx: CastContext): Promise<CastAgentOutput> {
  const result = await generateObject({
    model: getCastModel(),
    schema: castAgentSchema,
    instructions: buildPersona(character),
    prompt: buildCastPrompt(character, ctx),
  })

  return {
    character: character.name,
    intent: result.object.intent,
    line: result.object.line,
    emotion: result.object.emotion,
    motivation: result.object.motivation,
    wants_from_player: result.object.wants_from_player,
  }
}

// Strips the "I ask Elara whether…" / "I search the cellar…" framing off the
// player's input so the fallback answers the SUBJECT of what they said rather
// than echoing the player's own first-person sentence back in a character's
// mouth. Returns "" when nothing substantive is left.
function topicOf(input: string): string {
  let t = (input || "").trim().replace(/\s+/g, " ").replace(/[?!.]+$/g, "")
  for (let i = 0; i < 3; i++) {
    const before = t
    // Each strip leaves a leading space, which would blind the next anchored
    // (^) pattern until the final trim — so trim between strips, not just after.
    t = t
      .replace(
        /^(i\s+)?(ask|tell|say|want|try|attempt|decide|choose|offer|wonder|question|search|look|demand|confront|follow|read|break|open|check|examine|inspect|grab|take|walk|go|head|move|sneak|hide|listen|watch)\b/i,
        "",
      )
      .trim()
      .replace(/^(elara|gareth|bran|i|we|me|him|her|them|you)\b/i, "")
      .trim()
      .replace(/^(about|whether|that|if|for|to|at|on|of)\b/i, "")
      .trim()
    if (t === before) break
  }
  if (t.split(/\s+/).length < 2) return ""
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Deterministic fallback so a turn never breaks when no model is reachable.
// Reacts to the player's actual words against this character's own secrets and
// knowledge, so the same character reads differently across beats instead of
// reciting its bio every turn.
export function mockCastAgent(character: Character, ctx: CastContext): CastAgentOutput {
  const input = (ctx.playerInput || "").toLowerCase()
  const goal = character.goals?.[0] || ""

  // Only match on substantial words so short words like "the" never false-hit.
  const mentions = (text: string) =>
    text
      .toLowerCase()
      .split(/[^a-z]+/)
      .some((word) => word.length > 4 && input.includes(word))

  const secret = (character.secrets || []).find(mentions) || ""
  const known = (character.knowledge || []).find(mentions) || ""

  const emotion = secret ? "guarded, alert" : known ? "interested, measuring you" : "watchful"
  const motivation = secret ? "keep what you are hiding out of this" : goal || "read the room"
  const intent = secret ? "deflect without showing why" : motivation

  // The fallback must still make the character ANSWER what the player said, or
  // the scene reads as if nobody is listening. Take the substance of the
  // player's input and answer it from this character's own stance.
  const subject = topicOf(ctx.playerInput)
  const line = subject
    ? secret
      ? `${subject}? You would do better not to say that out loud in here.`
      : known
        ? `${subject}? That is worth your attention. Say plainly what you mean by it.`
        : `${subject}? Perhaps. But you are useful to me first — ${goal || "and I mean to use you"}.`
    : secret
      ? "Say what you actually mean. I am not going to guess for you."
      : `Then we do it my way — ${goal || "and we do it now"}.`

  // Only claim a want "from you" when the material is actually about the
  // player; otherwise the UI falls back to showing their intent.
  const aboutPlayer = /\byou\b|\byour\b/i.test(motivation)
  return {
    character: character.name,
    intent,
    line,
    emotion,
    motivation,
    wants_from_player: aboutPlayer ? motivation : "",
  }
}

// Runs one sub-agent per cast member present in the scene, in parallel. The
// player is the reader, not a cast agent, so it is skipped.
export async function runCastAgents(
  characters: Record<string, Character>,
  ctx: CastContext,
  useAi: boolean,
): Promise<Record<string, CastAgentOutput>> {
  const seen = ctx.state.seen_characters.filter((id) => characters[id])
  const present = seen.length ? seen : Object.keys(characters)

  // Cap parallel sub-agent calls so a crowded scene can't fan out unbounded.
  const cast = present.slice(0, 4)
  if (!cast.length) return {}

  const results = await Promise.all(
    cast.map(async (id) => {
      const character = characters[id]
      if (useAi) {
        try {
          return await aiCastAgent(character, ctx)
        } catch {
          return mockCastAgent(character, ctx)
        }
      }
      return mockCastAgent(character, ctx)
    }),
  )

  const out: Record<string, CastAgentOutput> = {}
  for (const r of results) out[r.character] = r
  return out
}

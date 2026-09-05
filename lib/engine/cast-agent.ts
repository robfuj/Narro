// Cast sub-agents (multi-agent layer).
//
// The Director is the single "brain" — it plans the beat and narrates. Each
// cast member is a separate sub-agent that reasons for itself: it gets its own
// persona, its own goals/secrets, and ONLY the memories its character actually
// witnessed (the knowledge-boundary model), then returns its own intent,
// emotion, and spoken line in its own voice.
//
// The brain never writes a character's dialogue for them. It hands each
// sub-agent the beat, the sub-agents answer in parallel, and the Scene
// renderer weaves their answers into prose.
import { generateObject } from "ai"
import { z } from "zod"
import { getCastModel } from "./model"
import type { CastAgentOutput, Character, DirectorOutput, Moment } from "./types"

export type { CastAgentOutput }

const castAgentSchema = z.object({
  intent: z.string().default(""),
  line: z.string().default(""),
  emotion: z.string().default(""),
  motivation: z.string().default(""),
  wants_from_player: z.string().default(""),
})

// The brief keys characters by their state id ("elara") while the cast record
// carries the display name ("Elara"), so lookups must tolerate either casing.
function lookup<T>(map: Record<string, T> | undefined, name: string): T | undefined {
  if (!map) return undefined
  const lower = name.toLowerCase()
  for (const [key, value] of Object.entries(map)) {
    if (key.toLowerCase() === lower) return value
  }
  return undefined
}

function buildPersona(character: Character): string {
  const parts: string[] = []
  parts.push(`You are ${character.name}, a character in an interactive otherworld adventure called Narro.`)
  parts.push(`You are NOT an assistant and NOT a narrator. You are this person, in this moment, thinking only your own thoughts.`)
  if (character.appearance) parts.push(`Your appearance: ${character.appearance}`)
  if (character.goals?.length) parts.push(`Your goals: ${character.goals.join("; ")}`)
  if (character.secrets?.length) {
    parts.push(
      `Your secrets (you know these, and you guard them — never volunteer them unless the beat forces it): ${character.secrets.join("; ")}`,
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

function buildCastPrompt(character: Character, brief: DirectorOutput, moments: Moment[]): string {
  const parts: string[] = []

  parts.push(`THE BEAT (decided by the story's narrator — do not change it):\n${brief.scene_goal}`)
  if (brief.imagery_cue) parts.push(`Sensory detail grounding this beat: ${brief.imagery_cue}`)

  const intention = lookup(brief.character_intentions, character.name)
  if (intention) parts.push(`The narrator's note on your intention this beat: ${intention}`)

  const inner = lookup(brief.character_inner, character.name)
  if (inner?.emotion || inner?.motivation) {
    parts.push(`Your starting state this beat: you feel ${inner.emotion || "unspecified"} and want to ${inner.motivation || "unspecified"}.`)
  }

  const memories = memoriesFor(character.name.toLowerCase(), moments)
  if (memories.length) parts.push(`WHAT YOU REMEMBER (only what you personally witnessed):\n${memories.join("\n")}`)

  if (brief.prohibited_facts?.length) {
    parts.push(`HARD CONSTRAINT — you do not know and must never hint at: ${brief.prohibited_facts.join(", ")}`)
  }

  parts.push(
    `Respond as ${character.name}. Write "line" as ONE short spoken line in your own voice (max ~25 words) — or leave it empty if you would stay silent this beat. Never break character, never address the reader directly, and keep it adventure-only (no romantic or sexual framing).`,
  )

  return parts.join("\n\n")
}

export async function aiCastAgent(
  character: Character,
  brief: DirectorOutput,
  moments: Moment[],
): Promise<CastAgentOutput> {
  const result = await generateObject({
    model: getCastModel(),
    schema: castAgentSchema,
    instructions: buildPersona(character),
    prompt: buildCastPrompt(character, brief, moments),
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

// Deterministic fallback so a turn never breaks when no model is reachable.
// Derives the sub-agent's answer from the brain's brief plus the character's
// own goals, so each cast member still reads as a distinct voice.
export function mockCastAgent(
  character: Character,
  brief: DirectorOutput,
  _moments: Moment[],
): CastAgentOutput {
  const inner = lookup(brief.character_inner, character.name)
  const intention = lookup(brief.character_intentions, character.name)
  const goal = character.goals?.[0] || ""

  // Prefer the brain's beat-specific note over the character's static goal, so
  // the same character reads differently across beats instead of repeating
  // their bio every turn.
  const emotion = inner?.emotion || "watchful"
  const motivation = inner?.motivation || intention || goal || "read the room"
  const intent = intention || inner?.motivation || goal || "read the room"

  // A planning note ("keep the inn solvent") is not dialogue. Rather than put
  // awkward words in a character's mouth, stay silent and let the renderer
  // externalize this as action and subtext — which is what a live sub-agent
  // does too when it chooses not to speak.
  const line = ""

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

// Runs one sub-agent per cast member present in this beat, in parallel. The
// player is the reader, not a cast agent, so it is skipped.
export async function runCastAgents(
  characters: Record<string, Character>,
  brief: DirectorOutput,
  moments: Moment[],
  useAi: boolean,
): Promise<Record<string, CastAgentOutput>> {
  const present = (brief.affected_entities || []).filter((id) => {
    if (id.toLowerCase() === "player") return false
    return Boolean(characters[id])
  })

  // Cap parallel sub-agent calls so a crowded beat can't fan out unbounded.
  const cast = present.slice(0, 4)
  if (!cast.length) return {}

  const results = await Promise.all(
    cast.map(async (id) => {
      const character = characters[id]
      if (useAi) {
        try {
          return await aiCastAgent(character, brief, moments)
        } catch {
          return mockCastAgent(character, brief, moments)
        }
      }
      return mockCastAgent(character, brief, moments)
    }),
  )

  const out: Record<string, CastAgentOutput> = {}
  for (const r of results) out[r.character] = r
  return out
}

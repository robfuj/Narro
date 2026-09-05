// Scene / ghostwriter (renderer). Receives ONLY the Director's brief — never the
// raw transcript, never story direction (architecture §1, §4.4 "Hard rule").
// Externalizes the evidence-based levers: a concrete IMAGERY cue (mental imagery)
// and each character's INNER emotion + motivation (identification), per the
// Transportation-Imagery Model.
import { generateText } from "ai"
import { getSceneModel } from "./model"
import type { CastAgentOutput, Character, DirectorOutput } from "./types"

const SCENE_SYSTEM = `You are the Scene renderer for an interactive otherworld adventure story engine called Narro.

You ONLY write prose. You do not decide plot, and you must not invent facts, secrets, or state changes beyond what the brief below tells you. You never mention or hint at anything listed under "hidden from characters" — those facts must stay invisible to every character in the scene.

Style: second person present tense, immersive light-novel prose, 120-220 words. Ground the beat in the imagery_cue as a real sensory detail. Show each listed character's inner emotion/motivation through action and subtext, not by stating it outright as narration labels. The reader is never shown a menu of options — they write freely, in their own words, every turn. So end on an open beat: a question hanging in the air, a pressure the reader has to answer, or a moment waiting on them. Never list choices, never enumerate what the reader "could" do, and never write "you could..." — leave the moment live so the reader speaks into it.

Open every scene the same way. The FIRST line is a character calling out to the reader — someone in the scene speaking directly at "you", in their own voice, with the place grounded inside that same line (where they are standing, what it sounds like, smells like, or feels like). Then spend a sentence or two building the environment before the beat moves on: the room, the weather, the light, the smells, the sounds — enough that the reader can stand in it and feel the temperature. Only after that does the action advance. Never open on a neutral establishing shot, and never open on bare description with no voice in it.

Engage the reader: keep them leaning in by letting them feel what the protagonist feels in their body — a sensation, a stake, or a question that makes them feel personally implicated. Do NOT write the reader_callout — that is rendered separately by the UI; just make the prose itself pull the reader forward.

Cast voices: each character in this beat is played by its own sub-agent, which has already decided its intent, emotion, and spoken line. When a character speaks, use THEIR line (you may lightly trim it to fit the prose, but never rewrite what they mean or put different words in their mouth). When a character stays silent, render their intent/emotion through action and subtext instead of inventing dialogue for them.

Adventure-only tone: never write romantic or sexual framing, even if a character's stated motivation could be read that way — keep it platonic/adventure/intrigue.`

function buildScenePrompt(brief: DirectorOutput, cast: Record<string, CastAgentOutput>): string {
  const parts: string[] = []
  parts.push(`selected_action: ${brief.selected_action}`)
  parts.push(`scene_goal: ${brief.scene_goal}`)
  if (brief.imagery_cue) parts.push(`imagery_cue: ${brief.imagery_cue}`)

  // Each cast member's own sub-agent answer — the renderer must honour these
  // rather than inventing what a character thinks or says.
  const castLines = Object.values(cast).map((c) => {
    const bits = [`${c.character}:`]
    if (c.intent) bits.push(`  intent: ${c.intent}`)
    if (c.emotion) bits.push(`  feels: ${c.emotion}`)
    if (c.motivation) bits.push(`  wants to: ${c.motivation}`)
    if (c.wants_from_player) bits.push(`  wants from you: ${c.wants_from_player}`)
    bits.push(c.line ? `  says: ${c.line}` : `  says: (stays silent)`)
    return bits.join("\n")
  })
  if (castLines.length) parts.push(`cast (each character's own sub-agent answer):\n${castLines.join("\n\n")}`)

  const inner = brief.character_inner || {}
  const innerLines = Object.entries(inner)
    .filter(([, v]) => v && (v.emotion || v.motivation))
    .map(([name, v]) => `${name}: feels ${v.emotion || "unspecified"}, wants to ${v.motivation || "unspecified"}`)
  if (innerLines.length) parts.push(`character_inner:\n${innerLines.join("\n")}`)
  if (brief.prohibited_facts?.length) parts.push(`hidden from characters (never reveal): ${brief.prohibited_facts.join(", ")}`)
  return parts.join("\n\n")
}

export async function aiScene(
  brief: DirectorOutput,
  cast: Record<string, CastAgentOutput> = {},
): Promise<string> {
  const result = await generateText({
    model: getSceneModel(),
    instructions: SCENE_SYSTEM,
    prompt: buildScenePrompt(brief, cast),
  })
  return result.text.trim()
}

function capitalize(name: string): string {
  return name.length ? name[0].toUpperCase() + name.slice(1) : name
}

// A sub-agent's line is bare spoken words; the renderer owns the quotation
// marks and the closing period, so strip any the agent added itself. Without
// this a line ending in "." renders as `.."`.
function spoken(line: string): string {
  return line.trim().replace(/["""\s]+$/g, "").replace(/[.!?]+$/g, "")
}

// The brief refers to the player as "player"; render that in second person
// to match the AI writer's voice instead of naming a "character" the player
// controls.
function displayName(name: string): string {
  return name.toLowerCase() === "player" ? "You" : capitalize(name)
}

// Deterministic prose fallback used whenever the AI scene writer is unavailable
// (no model call, or the call failed). Reads the same Director brief the AI
// writer would, but renders it as actual second-person narrative instead of
// a debug dump of the brief's fields — the brief itself must never appear
// verbatim in player-visible text.
export function mockScene(brief: DirectorOutput, cast: Record<string, CastAgentOutput> = {}): string {
  const sentences: string[] = []

  const castEntries = Object.values(cast)

  // Scenes open on a character calling out, so lead with the first spoken line
  // when the cast produced one; the imagery cue then builds the environment
  // around that voice instead of opening the scene on bare description.
  const firstSpoken = castEntries.find((c) => c.line)
  if (firstSpoken) {
    sentences.push(`${capitalize(firstSpoken.character)} calls out, "${spoken(firstSpoken.line)}."`)
  }

  if (brief.imagery_cue) {
    sentences.push(`${capitalize(brief.imagery_cue)}.`)
  }

  // Prefer each cast sub-agent's own answer over the brain's summary of them —
  // that is the whole point of the multi-agent split.
  if (castEntries.length) {
    for (const c of castEntries) {
      if (c === firstSpoken) continue
      const who = capitalize(c.character)
      if (c.line) {
        sentences.push(`${who} says, "${spoken(c.line)}."`)
      } else if (c.intent || c.motivation) {
        // A silent character renders as subtext, never as a state label: the
        // need behind their silence, carried in the body rather than named.
        sentences.push(`${who} keeps it inward — the need to ${c.intent || c.motivation} shows only in the set of their jaw.`)
      } else if (c.emotion) {
        sentences.push(`${who} is ${c.emotion}, and lets it show in nothing but stillness.`)
      }
    }
  } else {
    const inner = brief.character_inner || {}
    for (const [name, st] of Object.entries(inner)) {
      if (!st.emotion && !st.motivation) continue
      const who = displayName(name)
      const be = who === "You" ? "are" : "is"
      // motivation strings are free-form (verb phrases like "recruit you" or bare
      // states like "unaware") — a neutral connector keeps the sentence
      // grammatical either way instead of forcing "wants to unaware".
      if (st.emotion && st.motivation) {
        sentences.push(`${who} ${be} ${st.emotion} — ${st.motivation}.`)
      } else if (st.emotion) {
        sentences.push(`${who} ${be} ${st.emotion}.`)
      } else if (st.motivation) {
        sentences.push(`${who}: ${st.motivation}.`)
      }
    }
  }

  // scene_goal is a third-person planning note written for the AI writer to
  // rewrite ("Let the player feel the secret resurface"), not prose. Rendering
  // it verbatim leaks planning language into the scene, so only fall back to it
  // when the beat produced nothing else to show.
  if (!sentences.length && brief.scene_goal) {
    const goal = brief.scene_goal
      .replace(/\bthe player's\b/gi, "your")
      .replace(/\bthe player\b/gi, "you")
      .replace(/\btheir\b/gi, "your")
    sentences.push(goal.endsWith(".") ? goal : `${goal}.`)
  }

  // No menu of options — the reader writes freely. Close on an open beat so the
  // moment stays live and waiting on them.
  sentences.push("The moment holds, waiting on what you say next.")

  return sentences.filter(Boolean).join(" ")
}

// Unused parameter kept for interface parity with the scaffold's mockScene(brief, characters).
export function mockSceneWithCast(brief: DirectorOutput, _characters: Record<string, Character>): string {
  return mockScene(brief)
}

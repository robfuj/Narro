// Scene / ghostwriter (renderer). Receives ONLY the Director's brief — never the
// raw transcript, never story direction (architecture §1, §4.4 "Hard rule").
// Externalizes the evidence-based levers: a concrete IMAGERY cue (mental imagery)
// and each character's INNER emotion + motivation (identification), per the
// Transportation-Imagery Model.
import { generateText } from "ai"
import type { Character, DirectorOutput } from "./types"

const SCENE_MODEL = "anthropic/claude-sonnet-4.5"

const SCENE_SYSTEM = `You are the Scene renderer for an interactive otherworld adventure story engine called Narro.

You ONLY write prose. You do not decide plot, and you must not invent facts, secrets, or state changes beyond what the brief below tells you. You never mention or hint at anything listed under "hidden from characters" — those facts must stay invisible to every character in the scene.

Style: second person present tense, immersive light-novel prose, 120-220 words. Ground the beat in the imagery_cue as a real sensory detail. Show each listed character's inner emotion/motivation through action and subtext, not by stating it outright as narration labels. End by naturally presenting the listed player options as a real in-world choice (do not just list them mechanically — but the player must be able to tell what their options are).

Adventure-only tone: never write romantic or sexual framing, even if a character's stated motivation could be read that way — keep it platonic/adventure/intrigue.`

function buildScenePrompt(brief: DirectorOutput): string {
  const parts: string[] = []
  parts.push(`selected_action: ${brief.selected_action}`)
  parts.push(`scene_goal: ${brief.scene_goal}`)
  if (brief.imagery_cue) parts.push(`imagery_cue: ${brief.imagery_cue}`)
  const inner = brief.character_inner || {}
  const innerLines = Object.entries(inner)
    .filter(([, v]) => v && (v.emotion || v.motivation))
    .map(([name, v]) => `${name}: feels ${v.emotion || "unspecified"}, wants to ${v.motivation || "unspecified"}`)
  if (innerLines.length) parts.push(`character_inner:\n${innerLines.join("\n")}`)
  if (brief.player_agency_options?.length) parts.push(`player_agency_options: ${brief.player_agency_options.join(" / ")}`)
  if (brief.prohibited_facts?.length) parts.push(`hidden from characters (never reveal): ${brief.prohibited_facts.join(", ")}`)
  return parts.join("\n\n")
}

export async function aiScene(brief: DirectorOutput): Promise<string> {
  const result = await generateText({
    model: SCENE_MODEL,
    instructions: SCENE_SYSTEM,
    prompt: buildScenePrompt(brief),
  })
  return result.text.trim()
}

function capitalize(name: string): string {
  return name.length ? name[0].toUpperCase() + name.slice(1) : name
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
export function mockScene(brief: DirectorOutput): string {
  const sentences: string[] = []

  if (brief.imagery_cue) {
    sentences.push(`${capitalize(brief.imagery_cue)}.`)
  }

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

  if (brief.scene_goal) {
    // scene_goal is authored as a third-person planning note for the AI writer
    // to rewrite ("the player's confession"); normalize the common pronouns so
    // the deterministic fallback stays in second person like the rest of the
    // scene instead of switching voice mid-paragraph.
    const goal = brief.scene_goal
      .replace(/\bthe player's\b/gi, "your")
      .replace(/\bthe player\b/gi, "you")
      .replace(/\btheir\b/gi, "your")
    sentences.push(goal.endsWith(".") ? goal : `${goal}.`)
  }

  if (brief.player_agency_options?.length) {
    const options = brief.player_agency_options
    const choiceText =
      options.length > 1
        ? `${options.slice(0, -1).join(", ")}, or ${options[options.length - 1]}`
        : options[0]
    sentences.push(`What do you do — ${choiceText}?`)
  }

  return sentences.filter(Boolean).join(" ")
}

// Unused parameter kept for interface parity with the scaffold's mockScene(brief, characters).
export function mockSceneWithCast(brief: DirectorOutput, _characters: Record<string, Character>): string {
  return mockScene(brief)
}

// Scene / ghostwriter (renderer). Receives ONLY the Director's brief — never the
// raw transcript, never story direction (architecture §1, §4.4 "Hard rule").
// Externalizes the evidence-based levers: a concrete IMAGERY cue (mental imagery)
// and each character's INNER emotion + motivation (identification), per the
// Transportation-Imagery Model.
import { generateText } from "ai"
import type { Character, DirectorOutput } from "./types"

const SCENE_MODEL = "anthropic/claude-sonnet-4.5"

const SCENE_SYSTEM = `You are the Scene renderer for an interactive isekai adventure story engine called Narro.

You ONLY write prose. You do not decide plot, and you must not invent facts, secrets, or state changes beyond what the brief below tells you. You never mention or hint at anything listed under "hidden from characters" — those facts must stay invisible to every character in the scene.

Style: second person present tense, immersive light-novel isekai prose, 120-220 words. Ground the beat in the imagery_cue as a real sensory detail. Show each listed character's inner emotion/motivation through action and subtext, not by stating it outright as narration labels. End by naturally presenting the listed player options as a real in-world choice (do not just list them mechanically — but the player must be able to tell what their options are).

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

export function mockScene(brief: DirectorOutput): string {
  const lines: string[] = []
  if (brief.imagery_cue) lines.push(`[scene] ${brief.imagery_cue}`)
  const who = Object.keys(brief.character_intentions || {}).join(", ")
  if (who) lines.push(`Present: ${who}.`)

  const inner = brief.character_inner || {}
  for (const [name, st] of Object.entries(inner)) {
    const partsList: string[] = []
    if (st.emotion) partsList.push(`feels ${st.emotion}`)
    if (st.motivation) partsList.push(`wants to ${st.motivation}`)
    if (partsList.length) lines.push(`${name} ${partsList.join(", ")}.`)
  }

  lines.push(`[${brief.selected_action}] ${brief.scene_goal}`)
  if (brief.player_agency_options?.length) lines.push(`Your options: ${brief.player_agency_options.join(" / ")}.`)
  if (brief.prohibited_facts?.length) lines.push(`(Hidden from characters: ${brief.prohibited_facts.join(", ")}.)`)
  return lines.filter(Boolean).join("\n")
}

// Unused parameter kept for interface parity with the scaffold's mockScene(brief, characters).
export function mockSceneWithCast(brief: DirectorOutput, _characters: Record<string, Character>): string {
  return mockScene(brief)
}

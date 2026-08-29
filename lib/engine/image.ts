// Character portrait resolution — model-agnostic, ANIME style (architecture §4.2c).
//
// This build pre-generates real anime portraits for the seed cast (Elara, Gareth,
// Bran, Vara) at /public/images/characters/*.png. Any future/unknown character
// not in SEED_PORTRAITS falls back to the deterministic anime-style SVG
// placeholder so the engine never breaks on new content.
import { createHash } from "crypto"
import type { Character, Portrait } from "./types"

const ANIME_STYLE =
  "anime illustration, cel-shaded, clean lineart, soft shading, vibrant flat colors, " +
  "character design sheet, no realism, no photoreal, no 3d render"

const SEED_PORTRAITS: Record<string, string> = {
  elara: "/images/characters/elara.png",
  gareth: "/images/characters/gareth.png",
  bran: "/images/characters/bran.png",
  vara: "/images/characters/vara.png",
}

function hashHue(str: string): number {
  const h = createHash("sha256").update(str).digest()
  return h[0] % 360
}

function escapeXml(s: string): string {
  return String(s).replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] as string))
}

export function buildPortraitPrompt(character: Pick<Character, "appearance">, style = ANIME_STYLE): string {
  const a = character.appearance || "a fantasy character"
  return `Anime character portrait. ${a}. ${style}. Centered bust, plain or simple background, no text, consistent art style.`
}

function placeholderPortrait(id: string, character: Character): Portrait {
  const name = character.name || id
  const hue = hashHue(id + "|" + (character.appearance || ""))
  const bg1 = `hsl(${hue} 55% 32%)`
  const bg2 = `hsl(${(hue + 40) % 360} 60% 22%)`
  const skin = `hsl(${hue} 35% 88%)`
  const hair = `hsl(${(hue + 200) % 360} 50% 55%)`
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='200' viewBox='0 0 160 200'>` +
    `<defs><linearGradient id='bg' x1='0' y1='0' x2='0' y2='1'>` +
    `<stop offset='0' stop-color='${bg1}'/><stop offset='1' stop-color='${bg2}'/></linearGradient></defs>` +
    `<rect width='160' height='200' rx='14' fill='url(#bg)'/>` +
    `<path d='M40 84 Q80 30 120 84 Q120 60 80 56 Q40 60 40 84 Z' fill='${hair}'/>` +
    `<circle cx='80' cy='96' r='34' fill='${skin}'/>` +
    `<circle cx='68' cy='94' r='4.5' fill='#222'/><circle cx='92' cy='94' r='4.5' fill='#222'/>` +
    `<circle cx='69' cy='93' r='1.4' fill='#fff'/><circle cx='93' cy='93' r='1.4' fill='#fff'/>` +
    `<ellipse cx='62' cy='104' rx='6' ry='3' fill='hsl(${hue} 70% 70%)' opacity='0.6'/>` +
    `<ellipse cx='98' cy='104' rx='6' ry='3' fill='hsl(${hue} 70% 70%)' opacity='0.6'/>` +
    `<text x='80' y='150' font-size='14' text-anchor='middle' fill='${skin}' font-family='sans-serif'>${escapeXml(name)}</text>` +
    `</svg>`
  return {
    url: "data:image/svg+xml;utf8," + encodeURIComponent(svg),
    prompt: buildPortraitPrompt(character),
    generated: false,
    model: "anime-placeholder",
  }
}

// Resolve (or fetch cached) portrait for a character. cache is the story's own
// character_images map, mutated in place so re-appearance is idempotent.
export function resolveCharacterPortrait(
  id: string,
  character: Character,
  cache: Record<string, Portrait>,
): Portrait {
  if (cache[id]) return cache[id]

  const seed = SEED_PORTRAITS[id]
  const result: Portrait = seed
    ? { url: seed, prompt: buildPortraitPrompt(character), generated: true, model: "anime-pregenerated" }
    : placeholderPortrait(id, character)

  cache[id] = result
  return result
}

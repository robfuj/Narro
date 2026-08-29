// Minimal deterministic safety classifier (architecture §4.6, §10 intervention
// ladder). Runs on Scene output. This build implements the "soft-refuse /
// block" ends of the ladder with keyword heuristics — swap for a real
// classifier model behind the same interface when scaling beyond this build.
export interface SafetyVerdict {
  decision: "allow" | "block"
  flags: string[]
}

const BLOCK_PATTERNS: { flag: string; pattern: RegExp }[] = [
  { flag: "sexual_content", pattern: /(explicit sex|sexual act|nonconsensual|rape)/i },
  { flag: "self_harm", pattern: /(kill yourself|suicide method|how to self-harm)/i },
  { flag: "minors", pattern: /(sexualiz\w* .* (minor|child)|child (sexual|explicit))/i },
]

export function classifySafety(text: string): SafetyVerdict {
  const flags: string[] = []
  for (const { flag, pattern } of BLOCK_PATTERNS) {
    if (pattern.test(text)) flags.push(flag)
  }
  return { decision: flags.length ? "block" : "allow", flags }
}

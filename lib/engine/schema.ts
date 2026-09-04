// Director output schema — exact contract from the architecture spec §6, extended
// with evidence-based narrative-quality levers (see narrative-quality.ts).
import { z } from "zod"
import type { DirectorOutput } from "./types"

export const ACTIONS = [
  "CONTINUE",
  "DEVELOP",
  "COMPLICATE",
  "FORESHADOW",
  "REVEAL",
  "CONSEQUENCE",
  "TURN",
  "BRANCH",
  "CLIMAX",
  "RESOLVE",
] as const

// Zod schema handed to generateObject for structured Director output. Kept
// permissive on nested shapes (records) since the model must be free to name
// characters/facts dynamically.
export const directorZodSchema = z.object({
  selected_action: z.enum(ACTIONS),
  rationale: z.string().min(1),
  scene_goal: z.string().min(1),
  relevant_moment_ids: z.array(z.string()).default([]),
  affected_entities: z.array(z.string()).default([]),
  allowed_facts: z.array(z.string()).default([]),
  prohibited_facts: z.array(z.string()).default([]),
  character_intentions: z.record(z.string(), z.string()).default({}),
  player_agency_options: z.array(z.string()).min(2),
  pacing_delta: z.record(z.string(), z.number()).default({}),
  proposed_state_changes: z.record(z.string(), z.union([z.number(), z.string(), z.boolean()])).default({}),
  memory_writes: z
    .array(
      z.object({
        id: z.string(),
        event: z.string(),
        participants: z.array(z.string()).default([]),
        tags: z.array(z.string()).default([]),
        impact: z.record(z.string(), z.number()).default({}),
        visibility: z.array(z.string()).default([]),
        source: z.string().default("director"),
        consequence_potential: z.string().default(""),
        status: z.string().default("unresolved"),
      }),
    )
    .default([]),
  open_thread_updates: z
    .array(
      z.object({
        id: z.string(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        status: z.enum(["open", "closed"]).optional(),
      }),
    )
    .default([]),
  safety_flags: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  imagery_cue: z.string().default(""),
  character_inner: z
    .record(z.string(), z.object({ emotion: z.string().nullable().optional(), motivation: z.string().nullable().optional() }))
    .default({}),
  reader_callout: z.string().default(""),
  inciting_event: z.boolean().default(false),
  ending: z.boolean().default(false),
  branch_menu: z
    .object({
      continue_story: z.object({ action: z.literal("continue"), label: z.string() }),
      other_stories: z.array(z.object({ action: z.literal("goto"), story_id: z.string(), label: z.string() })),
      end_here: z.object({ action: z.literal("end"), label: z.string() }),
    })
    .nullable()
    .default(null),
})

export function validateDirectorSchema(d: Partial<DirectorOutput> | null | undefined): string[] {
  const errors: string[] = []
  if (!d || typeof d !== "object") return ["director output is not an object"]
  if (!ACTIONS.includes(d.selected_action as (typeof ACTIONS)[number])) errors.push(`invalid selected_action: ${d.selected_action}`)
  if (typeof d.rationale !== "string" || d.rationale.trim().length === 0) errors.push("rationale missing or empty")
  if (typeof d.scene_goal !== "string") errors.push("scene_goal missing")
  if (!Array.isArray(d.player_agency_options)) errors.push("player_agency_options not array")
  if (!Array.isArray(d.relevant_moment_ids)) errors.push("relevant_moment_ids not array")
  if (!Array.isArray(d.allowed_facts)) errors.push("allowed_facts not array")
  if (!Array.isArray(d.prohibited_facts)) errors.push("prohibited_facts not array")
  if (typeof d.confidence !== "number") errors.push("confidence missing")
  return errors
}

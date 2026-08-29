import { NextResponse } from "next/server"
import { runTurn } from "@/lib/engine/engine"
import { getSession, saveSession, startSession } from "@/lib/engine/store"
import { resolveCharacterPortrait } from "@/lib/engine/image"
import type { Portrait } from "@/lib/engine/types"

// AI is on by default; set NARRO_USE_AI=false to force the deterministic mock
// engine (useful for offline dev / demos with zero model cost).
const USE_AI = process.env.NARRO_USE_AI !== "false"

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: "invalid JSON body" }, { status: 400 })

  const { session_id, story_id, player_input, action } = body as {
    session_id?: string
    story_id?: string
    player_input?: string
    action?: "start" | "turn" | "goto"
  }

  if (!session_id) return NextResponse.json({ error: "session_id is required" }, { status: 400 })

  if (action === "start" || action === "goto") {
    if (!story_id) return NextResponse.json({ error: "story_id is required to start" }, { status: 400 })
    const state = startSession(session_id, story_id)
    if (!state) return NextResponse.json({ error: `unknown story_id: ${story_id}` }, { status: 404 })

    const images: Record<string, Portrait> = {}
    for (const entity of Object.keys(state.characters)) {
      // Opening scene only introduces characters explicitly present at open; for
      // this build, pre-warm all core cast so their portraits render immediately.
      images[entity] = resolveCharacterPortrait(entity, state.characters[entity], state.character_images)
    }
    saveSession(session_id, state)

    return NextResponse.json({
      scene: state.skeleton.opening_scene,
      player_agency_options: ["continue"],
      visible_state_delta: {},
      retrieved_memory_ids: [],
      character_images: images,
      ended: false,
      branch_menu: null,
      safety: { decision: "allow", flags: [] },
      narrative: { transportation: 0, warnings: [] },
      director: { selected_action: "CONTINUE", rationale: "opening scene" },
      used_ai: false,
      state_snapshot: state.state,
      open_threads_snapshot: state.openThreads,
      story: { id: state.id, title: state.title, cover: state.cover, skeleton: state.skeleton },
    })
  }

  const state = getSession(session_id)
  if (!state) return NextResponse.json({ error: "session not found; start one first" }, { status: 404 })
  if (state.state.ended) return NextResponse.json({ error: "story has ended; go to a branch instead" }, { status: 409 })

  if (typeof player_input !== "string" || !player_input.trim()) {
    return NextResponse.json({ error: "player_input is required" }, { status: 400 })
  }

  const result = await runTurn(state, player_input.trim(), { useAi: USE_AI })
  saveSession(session_id, state)

  return NextResponse.json(result)
}

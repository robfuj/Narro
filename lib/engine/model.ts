// Resolves which language model each agent in the multi-agent story engine
// calls. Provider-agnostic by design — the engine never assumes one backend:
//
// - Default: Vercel AI Gateway model strings (any provider/model the Gateway
//   serves), resolved automatically by the `ai` package with zero extra config.
// - Any OpenAI-compatible LLM server (Ollama, vLLM, LM Studio, a local Hermes,
//   a tunneled box, ...): set NARRO_LLM_BASE_URL (HERMES_BASE_URL still works
//   as a legacy alias) plus optionally NARRO_LLM_MODEL / NARRO_LLM_API_KEY.
// - Per-role overrides: NARRO_BRAIN_MODEL / NARRO_SCENE_MODEL / NARRO_CAST_MODEL
//   accept a Gateway model string, or a local model id when a base URL is set.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"

// The single brain (narrator/planner) and the prose renderer carry the story's
// voice, so they default to a strong model.
const GATEWAY_BRAIN_MODEL = "anthropic/claude-sonnet-4.5"
const GATEWAY_SCENE_MODEL = "anthropic/claude-sonnet-4.5"
// Cast sub-agents are short, high-fan-out calls (one per character per turn),
// so they default to a faster/cheaper model than the brain and the renderer.
const GATEWAY_CAST_MODEL = "openai/gpt-4.1-mini"

type Role = "brain" | "scene" | "cast"

function localBaseUrl(): string | null {
  return process.env.NARRO_LLM_BASE_URL || process.env.HERMES_BASE_URL || null
}

function localModel(modelId: string): LanguageModel {
  const baseURL = localBaseUrl() as string
  const provider = createOpenAICompatible({
    name: "narro-local",
    baseURL: baseURL.replace(/\/+$/, "") + "/v1",
    // Most local servers ignore the key, but the client requires a non-empty
    // string; a real key can be supplied via NARRO_LLM_API_KEY.
    apiKey: process.env.NARRO_LLM_API_KEY || process.env.HERMES_API_KEY || "local",
    // OpenAI-compatible servers (Ollama included) support JSON-schema
    // constrained output, which generateObject() needs for structured briefs.
    supportsStructuredOutputs: true,
  })
  return provider.chatModel(modelId)
}

function resolve(role: Role): LanguageModel {
  const gatewayDefault =
    role === "brain" ? GATEWAY_BRAIN_MODEL : role === "scene" ? GATEWAY_SCENE_MODEL : GATEWAY_CAST_MODEL
  const envOverride =
    role === "brain"
      ? process.env.NARRO_BRAIN_MODEL
      : role === "scene"
        ? process.env.NARRO_SCENE_MODEL
        : process.env.NARRO_CAST_MODEL

  if (localBaseUrl()) {
    // A local server is configured: every role runs on it, using the per-role
    // override, a shared local model id, or the legacy Hermes default.
    const modelId =
      envOverride || process.env.NARRO_LLM_MODEL || process.env.HERMES_MODEL || "hermes3"
    return localModel(modelId)
  }
  return envOverride || gatewayDefault
}

export function getDirectorModel(): LanguageModel {
  return resolve("brain")
}

export function getSceneModel(): LanguageModel {
  return resolve("scene")
}

export function getCastModel(): LanguageModel {
  return resolve("cast")
}

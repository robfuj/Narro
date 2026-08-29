// Resolves which language model the Director and Scene renderer call.
//
// Default: an AI Gateway model string (e.g. "anthropic/claude-sonnet-4.5"),
// resolved automatically by the `ai` package with zero extra config.
//
// Local override: if HERMES_BASE_URL is set, route calls to a local Ollama
// (or any OpenAI-compatible server) instance instead — e.g. a Hermes model
// exposed via a tunnel (ngrok/Cloudflare Tunnel) since this sandbox cannot
// reach your machine's localhost directly. Ollama serves an OpenAI-compatible
// API at "<base>/v1", which is what createOpenAICompatible expects.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import type { LanguageModel } from "ai"

const GATEWAY_DIRECTOR_MODEL = "anthropic/claude-sonnet-4.5"
const GATEWAY_SCENE_MODEL = "anthropic/claude-sonnet-4.5"

function localModel(): LanguageModel | null {
  const baseURL = process.env.HERMES_BASE_URL
  if (!baseURL) return null
  const modelId = process.env.HERMES_MODEL || "hermes3"
  const provider = createOpenAICompatible({
    name: "hermes-local",
    baseURL: baseURL.replace(/\/+$/, "") + "/v1",
    apiKey: process.env.HERMES_API_KEY || "ollama", // Ollama ignores the key but the client requires a non-empty string
    // Ollama's OpenAI-compatible endpoint supports JSON-schema constrained
    // output, which generateObject() needs for the Director's structured brief.
    supportsStructuredOutputs: true,
  })
  return provider.chatModel(modelId)
}

export function getDirectorModel(): LanguageModel {
  return localModel() ?? GATEWAY_DIRECTOR_MODEL
}

export function getSceneModel(): LanguageModel {
  return localModel() ?? GATEWAY_SCENE_MODEL
}

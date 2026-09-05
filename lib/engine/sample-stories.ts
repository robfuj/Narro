// Seed content for the two launch stories. Authored against the Story Skeleton
// template (build brief): title, player fantasy, logline, pressure engine,
// opening scene, core cast, seeded moments, open threads, arc beats, visible
// vs hidden state.
import type { Character, StoryState } from "./types"

function baseState(overrides: Partial<StoryState["state"]>): StoryState["state"] {
  return {
    arc: "hook",
    chapter: 1,
    current_objective: "",
    stakes: "",
    theme: "",
    scene: "",
    canon_flags: {},
    discovered_clues: [],
    known_relationships: [],
    next_event: "",
    seen_characters: [],
    ended: false,
    transportation: 0,
    ...overrides,
  }
}

const AETHERMOOR_CAST: Record<string, Character> = {
  elara: {
    name: "Elara",
    appearance:
      "a sharp-eyed innkeeper in her thirties, auburn hair tied back in a low bun, worn leather apron over a cream blouse, a faint old scar on her left cheek",
    goals: ["keep the inn solvent", "protect the people under her roof"],
    secrets: ["once sheltered a deserter from the royal guard"],
    knowledge: ["otherworld_secret"],
  },
  gareth: {
    name: "Gareth",
    appearance:
      "a broad-shouldered royal guard captain, close-cropped dark hair, polished ornate breastplate with a royal crest, a faint dueling scar near one eyebrow",
    goals: ["fill the ranks of the royal guard with capable recruits", "root out foreign infiltrators"],
    secrets: ["suspects someone in the capital isn't from this world, but doesn't yet know who"],
    knowledge: [],
  },
}

const EMBERHOLD_CAST: Record<string, Character> = {
  bran: {
    name: "Bran",
    appearance:
      "a freckled young apprentice blacksmith, ash-blond messy hair, a soot-smudged cheek, earnest wide eyes, simple leather smock",
    goals: ["earn his master's forge one day", "prove he belongs among the smiths of Emberhold"],
    secrets: ["forged a flawed blade that failed in a duel and hid the truth of it"],
    knowledge: ["forge_challenge"],
  },
  vara: {
    name: "Vara",
    appearance:
      "a lean rival blacksmith duelist, braided silver hair, blackened leather armor with metal studs, a dueling scar across one eyebrow, sharp confident smirk",
    goals: ["win the hold's forge-right by besting every rival", "prove steel is the only truth that matters"],
    secrets: ["lost her own mentor to a blade that shattered mid-duel, and has never forged past that fear"],
    knowledge: ["forge_challenge"],
  },
}

export const SAMPLE_STORIES: Record<string, StoryState> = {
  aethermoor: {
    id: "aethermoor",
    title: "The Reborn Soul of Aethermoor",
    cover: "/images/covers/aethermoor.png",
    premise:
      "You awaken in the kingdom of Aethermoor with a stranger's face and your own memories intact. No one here knows what you were before.",
    genre: "otherworld / political intrigue",
    player_role: "a reborn soul with memories of a life before, now a nobody in a new world",
    skeleton: {
      title: "The Reborn Soul of Aethermoor",
      player_fantasy:
        "I remember an entire life no one here can see. My knowledge is an edge — and a danger, if the wrong person notices.",
      logline:
        "A reborn soul must build a place in Aethermoor's capital before their otherworld secret gets them branded a spy, while the royal guard's captain quietly hunts for exactly that kind of infiltrator.",
      pressure_engine: "social system — the capital watches strangers closely, and trust is the only currency",
      opening_scene:
        "\"You're not sleeping in the yard tonight,\" Elara calls from behind the bar, her voice carrying over the rain hammering the inn's shutters. \"Not while I've still got a roof that holds.\" The common room smells of tallow smoke, wet wool, and the last of the day's ale; a fire gutters in the hearth and throws the low beams into orange, and out on the capital road the mud has already swallowed every cart track that passed today. You have just enough coin for one more night — and the door has just swung open, letting the storm in behind Gareth, the royal guard captain, his breastplate still beading with rain.",
      arc_beats: [
        "Hook: you arrive in Aethermoor with nothing but memory of a life before",
        "Attachment: Elara gives you shelter and, if trusted, hears your secret",
        "Consequence: Gareth's offer of a position forces the secret toward exposure",
        "Turn: you decide how much of the truth Aethermoor gets to see",
        "Resolution: you claim a place in this world, on your own terms or not at all",
      ],
      player_visible_state: ["chapter", "current_objective", "discovered_clues", "known_relationships", "next_event"],
      hidden_director_state: ["gareth_knows_secret (must stay false unless earned)", "otherworld_secret holders", "pacing cooldowns"],
    },
    state: baseState({
      current_objective: "Find your footing in Aethermoor without being unmasked as an outsider.",
      stakes: "Exposure could mean imprisonment, or worse, as a suspected spy.",
      theme: "identity and the risk of being truly known",
      scene: "Elara's roadside inn, the capital road, first night of rain",
      next_event: "Gareth crosses the threshold to wait out the storm.",
    }),
    characters: AETHERMOOR_CAST,
    moments: [],
    openThreads: [{ id: "otherworld_secret", priority: "medium", status: "open" }],
    knowledge: { otherworld_secret: ["player", "elara"] },
    character_images: {},
    directorLog: [],
    sequel_of: null,
    leads_to: ["emberhold"],
  },
  emberhold: {
    id: "emberhold",
    title: "The Forge-Right of Emberhold",
    cover: "/images/covers/emberhold.png",
    premise:
      "You've come to Emberhold's mountain forges to earn a master's mark, standing against a rival who has never lost a duel of steel.",
    genre: "otherworld / competitive survival",
    player_role: "an apprentice smith chasing the forge-right, memories of another life quietly informing every choice",
    skeleton: {
      title: "The Forge-Right of Emberhold",
      player_fantasy: "I know things about metal and fire this world hasn't discovered yet. Can that be enough to win here?",
      logline:
        "An apprentice smith must win the forge-right before the season's trial ends, while Vara, undefeated in the ring, makes every step of the way a duel.",
      pressure_engine: "competition — a fixed trial season and a rival who never loses",
      opening_scene:
        "\"Don't quench it yet,\" Bran calls across the forge hall, waving you back from the trough with a soot-streaked hand. \"That steel isn't ready — and neither of us wants to find that out tomorrow.\" Sparks drift up past the mountain hold's chimney vents and die against the dark. The hall breathes heat: bellows sighing, coal snapping, stone walls sweating with it, the smell of hot iron and sulfur sitting heavy in your lungs. Every anvil in Emberhold is still working this late, and every one of them is forging for the same trial. Bran sets his half-forged blade down on the anvil, and it isn't ready.",
      arc_beats: [
        "Hook: you arrive at Emberhold chasing the forge-right",
        "Attachment: Bran becomes an ally, or a cautionary tale, of what fear of failure does to a smith",
        "Consequence: Vara's undefeated record turns from rumor into a direct challenge",
        "Turn: a flaw in your own work forces an honest choice about how you compete",
        "Resolution: you forge the blade that decides the forge-right, one way or another",
      ],
      player_visible_state: ["chapter", "current_objective", "discovered_clues", "known_relationships", "next_event"],
      hidden_director_state: ["forge_challenge holders", "vara_fear (never surfaced directly)", "pacing cooldowns"],
    },
    state: baseState({
      current_objective: "Prepare a blade worthy of the forge-right trial.",
      stakes: "Losing the trial means another year as an unranked apprentice — or worse, Vara's contempt made permanent.",
      theme: "fear of failure versus the discipline to try anyway",
      scene: "Emberhold's mountain forge hall, the night before the trial",
      next_event: "Vara arrives to inspect the competition before the trial begins.",
    }),
    characters: EMBERHOLD_CAST,
    moments: [],
    openThreads: [{ id: "forge_challenge", priority: "medium", status: "open" }],
    knowledge: { forge_challenge: ["player", "bran", "vara"] },
    character_images: {},
    directorLog: [],
    sequel_of: "aethermoor",
    leads_to: [],
  },
}

export function cloneSampleStory(id: string): StoryState | null {
  const seed = SAMPLE_STORIES[id]
  if (!seed) return null
  return JSON.parse(JSON.stringify(seed)) as StoryState
}

// Client-side onboarding profile. Purely local (localStorage) — no backend
// account. Captured once during the onboarding wizard and used to personalize
// the story-select screen and skip onboarding for returning visitors.
const PROFILE_KEY = "narro:profile"

export type Genre = "Fantasy" | "Sci-Fi" | "Mystery" | "Slice-of-life" | "Any"
export type Tone = "Hopeful" | "Gritty" | "Whimsical" | "Dark"
export type Pace = "Bite-sized" | "Leisurely" | "Immersive"

export interface NarroProfile {
  name: string
  email: string
  genre: Genre | null
  tone: Tone | null
  pace: Pace | null
}

export const GENRES: Genre[] = ["Fantasy", "Sci-Fi", "Mystery", "Slice-of-life", "Any"]
export const TONES: Tone[] = ["Hopeful", "Gritty", "Whimsical", "Dark"]
export const PACES: Pace[] = ["Bite-sized", "Leisurely", "Immersive"]

export function getProfile(): NarroProfile | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(PROFILE_KEY)
    return raw ? (JSON.parse(raw) as NarroProfile) : null
  } catch {
    return null
  }
}

export function saveProfile(profile: NarroProfile): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
}

// A profile counts as "onboarded" once it has a name — that's set at the end
// of step 1, so returning users always skip the wizard.
export function hasProfile(): boolean {
  const p = getProfile()
  return !!p && p.name.trim().length > 0
}

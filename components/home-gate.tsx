"use client"

import { useEffect, useState } from "react"
import { SplashIntro } from "@/components/splash-intro"
import { OnboardingWizard } from "@/components/onboarding-wizard"
import { hasProfile } from "@/lib/profile"

type Phase = "splash" | "onboarding" | "app"

/**
 * Orchestrates the first-run experience in front of the library:
 *   off-white splash + logo intro  ->  onboarding wizard (new users only)  ->  library.
 *
 * The library (`children`) is server-rendered and passed in, so it stays fast
 * and SEO-friendly; this client gate only controls what is visible on top of it.
 */
export function HomeGate({ children }: { children: React.ReactNode }) {
  // Start on the splash every load so the logo intro always plays. Whether we
  // then show onboarding is decided once we can read localStorage on the client.
  const [phase, setPhase] = useState<Phase>("splash")
  const [returning, setReturning] = useState<boolean | null>(null)

  useEffect(() => {
    setReturning(hasProfile())
  }, [])

  if (phase === "splash") {
    return (
      <SplashIntro
        onDone={() => {
          // Returning users skip straight to the app; new users onboard.
          setPhase(returning ? "app" : "onboarding")
        }}
      />
    )
  }

  if (phase === "onboarding") {
    return <OnboardingWizard onComplete={() => setPhase("app")} />
  }

  return <>{children}</>
}

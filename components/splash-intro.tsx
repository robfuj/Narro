"use client"

import { useEffect, useState } from "react"
import { BookOpen } from "lucide-react"

// Off-white opening screen with a brief logo intro, shown once per app load
// before the home / onboarding surface. Holds for a beat, then fades the whole
// overlay out and notifies the parent.
export function SplashIntro({ onFinish }: { onFinish: () => void }) {
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    const fadeTimer = setTimeout(() => setLeaving(true), 1700)
    const doneTimer = setTimeout(onFinish, 2300)
    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(doneTimer)
    }
  }, [onFinish])

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-opacity duration-500 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden={leaving}
    >
      <div className="flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-700">
        <span className="flex size-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <BookOpen className="size-8" />
        </span>
        <span className="font-story text-4xl tracking-tight text-foreground">Narro</span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground animate-in fade-in duration-1000 delay-300">
        Living stories, one choice at a time
      </p>
    </div>
  )
}

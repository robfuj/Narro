"use client"

import { useState } from "react"
import { ArrowLeft, ArrowRight, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import {
  GENRES,
  TONES,
  PACES,
  saveProfile,
  type Genre,
  type Tone,
  type Pace,
  type NarroProfile,
} from "@/lib/profile"

const NAME_RE = /^[\p{L} '-]*$/u

function StepDots({ step }: { step: number }) {
  return (
    <div className="flex items-center justify-center gap-2" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-full transition-all duration-300",
            i === step ? "w-6 bg-primary" : i < step ? "w-1.5 bg-primary" : "w-1.5 bg-border",
          )}
        />
      ))}
    </div>
  )
}

function Chip({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/50",
      )}
    >
      {label}
    </button>
  )
}

export function OnboardingWizard({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState("")
  const [genre, setGenre] = useState<Genre | null>(null)
  const [tone, setTone] = useState<Tone | null>(null)
  const [pace, setPace] = useState<Pace | null>(null)
  const [email, setEmail] = useState("")

  function persist(overrides: Partial<NarroProfile> = {}) {
    saveProfile({ name: name.trim(), email: email.trim(), genre, tone, pace, ...overrides })
  }

  function finish(overrides: Partial<NarroProfile> = {}) {
    persist(overrides)
    onComplete()
  }

  const trimmedName = name.trim()
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <StepDots step={step} />
          <p className="mt-3 text-center text-xs uppercase tracking-widest text-muted-foreground">
            Step {step + 1} of 3
          </p>
        </div>

        {step === 0 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h1 className="text-balance text-center font-story text-4xl leading-tight text-foreground">
              What should we call you?
            </h1>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              {"Your name threads quietly through the stories you'll live."}
            </p>
            <form
              className="mt-8 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (trimmedName) {
                  persist()
                  setStep(1)
                }
              }}
            >
              <Input
                autoFocus
                value={name}
                onChange={(e) => {
                  const v = e.target.value
                  if (v.length <= 24 && NAME_RE.test(v)) setName(v)
                }}
                placeholder="Your name"
                aria-label="Your name"
                className="h-12 text-center text-lg"
              />
              <Button type="submit" size="lg" disabled={!trimmedName}>
                Continue
                <ArrowRight className="size-4" data-icon="inline-end" />
              </Button>
            </form>
          </div>
        )}

        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h1 className="text-balance text-center font-story text-3xl leading-tight text-foreground">
              Shape your world
            </h1>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              A few preferences so each story lands the way you like.
            </p>

            <div className="mt-8 flex flex-col gap-6">
              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Genre</h2>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <Chip key={g} label={g} selected={genre === g} onClick={() => setGenre(g)} />
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">Tone</h2>
                <div className="flex flex-wrap gap-2">
                  {TONES.map((t) => (
                    <Chip key={t} label={t} selected={tone === t} onClick={() => setTone(t)} />
                  ))}
                </div>
              </section>

              <section>
                <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Reading pace
                </h2>
                <div className="flex flex-wrap gap-2">
                  {PACES.map((p) => (
                    <Chip key={p} label={p} selected={pace === p} onClick={() => setPace(p)} />
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-8 flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => {
                  persist()
                  setStep(0)
                }}
              >
                <ArrowLeft className="size-4" data-icon="inline-start" />
                Back
              </Button>
              <Button
                type="button"
                size="lg"
                className="flex-1"
                onClick={() => {
                  persist()
                  setStep(2)
                }}
              >
                Continue
                <ArrowRight className="size-4" data-icon="inline-end" />
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h1 className="text-balance text-center font-story text-3xl leading-tight text-foreground">
              Save your progress
            </h1>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Add an email to pick up where you left off.
            </p>

            <form
              className="mt-8 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault()
                if (emailValid) finish({ email: email.trim() })
              }}
            >
              <Input
                type="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="h-12 text-center text-lg"
              />
              <Button type="submit" size="lg" disabled={!emailValid}>
                Create account
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                {"We'll keep your name and stories on this device."}
              </p>
            </form>

            <div className="mt-6 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setStep(1)}
                className="text-muted-foreground"
              >
                <ArrowLeft className="size-4" data-icon="inline-start" />
                Back
              </Button>
              <button
                type="button"
                onClick={() => finish()}
                className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                Skip for now
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, BookOpen } from "lucide-react"
import { getAllStoryProgress, type StoryProgress } from "@/lib/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

const RING_SIZE = 168
const STROKE = 14
const RADIUS = (RING_SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function StoriesRing({ totalStories }: { totalStories: number }) {
  const [progress, setProgress] = useState<StoryProgress[] | null>(null)
  const [recapOpen, setRecapOpen] = useState(false)

  useEffect(() => {
    setProgress(getAllStoryProgress())
  }, [])

  // Avoid a flash of "0 stories" before localStorage is read on mount.
  if (progress === null) {
    return <div className="mx-auto h-[168px] w-[168px] animate-pulse rounded-full bg-muted" />
  }

  const started = progress.length
  const latest = progress[0] ?? null
  const fraction = totalStories > 0 ? Math.min(started / totalStories, 1) : 0
  const dashOffset = CIRCUMFERENCE * (1 - fraction)

  return (
    <>
      <button
        type="button"
        onClick={() => latest && setRecapOpen(true)}
        disabled={!latest}
        className="mx-auto flex flex-col items-center gap-4 disabled:cursor-default"
        aria-label={latest ? "View your story summary" : "No stories started yet"}
      >
        <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
            <defs>
              <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--ring-start)" />
                <stop offset="100%" stopColor="var(--ring-end)" />
              </linearGradient>
            </defs>
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="var(--muted)"
              strokeWidth={STROKE}
            />
            {fraction > 0 && (
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                fill="none"
                stroke="url(#ring-gradient)"
                strokeWidth={STROKE}
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
            <span className="font-sans text-4xl font-semibold tabular-nums text-foreground">{started}</span>
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {started === 1 ? "story started" : "stories started"}
            </span>
          </div>
        </div>

        {latest ? (
          <div className="flex w-full max-w-xs items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 text-left shadow-sm">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-xl">
              <Image src={latest.cover || "/placeholder.svg"} alt="" fill className="object-cover" />
            </div>
            <div className="flex-1 overflow-hidden">
              <p className="truncate text-sm font-medium text-foreground">{latest.title}</p>
              <p className="truncate text-xs text-muted-foreground">
                {latest.ended ? "Chapter closed" : `Chapter ${latest.chapter} · in progress`}
              </p>
            </div>
            <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
          </div>
        ) : (
          <p className="max-w-[200px] text-center text-sm leading-relaxed text-muted-foreground">
            Begin a world below to start your first story.
          </p>
        )}
      </button>

      <Sheet open={recapOpen} onOpenChange={setRecapOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-sans text-lg">
              <BookOpen className="size-4 text-primary" />
              What&apos;s happened so far
            </SheetTitle>
          </SheetHeader>
          {latest && (
            <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
              <div className="flex items-center gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl">
                  <Image src={latest.cover || "/placeholder.svg"} alt="" fill className="object-cover" />
                </div>
                <div>
                  <p className="font-serif text-lg leading-tight">{latest.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {latest.ended ? "This chapter has closed" : `Chapter ${latest.chapter}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl bg-muted p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Current objective
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">{latest.current_objective}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stakes</span>
                  <span className="text-sm leading-relaxed text-foreground">{latest.stakes}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What&apos;s next
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">{latest.next_event}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                nativeButton={false}
                render={<Link href={`/story/${latest.storyId}`}>{latest.ended ? "Revisit story" : "Resume story"}</Link>}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

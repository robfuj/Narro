"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Check } from "lucide-react"
import { getStoryProgress, ESTIMATED_ARC_CHAPTERS, type StoryProgress } from "@/lib/progress"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

// Small Oura-score-style ring: one per story, sized like Oura's readiness /
// sleep / activity rings (compact, in a row), not one big hero ring. Each
// ring's fill is that story's own progress, not an aggregate across stories.
const RING_SIZE = 64
const STROKE = 6
const RADIUS = (RING_SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

interface LibraryStorySummary {
  id: string
  title: string
  cover: string
}

export function StoriesRing({ stories }: { stories: LibraryStorySummary[] }) {
  const [progressById, setProgressById] = useState<Record<string, StoryProgress | null> | null>(null)
  const [activeStory, setActiveStory] = useState<LibraryStorySummary | null>(null)

  useEffect(() => {
    const map: Record<string, StoryProgress | null> = {}
    for (const story of stories) {
      map[story.id] = getStoryProgress(story.id)
    }
    setProgressById(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const activeProgress = activeStory ? progressById?.[activeStory.id] ?? null : null

  return (
    <>
      <div className="flex gap-5 overflow-x-auto pb-1">
        {stories.map((story) => {
          const progress = progressById?.[story.id] ?? null
          const fraction = progress
            ? progress.ended
              ? 1
              : Math.min(progress.chapter / ESTIMATED_ARC_CHAPTERS, 1)
            : 0
          const dashOffset = CIRCUMFERENCE * (1 - fraction)
          const started = Boolean(progress)

          const ring = (
            <div className="relative shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
              <svg width={RING_SIZE} height={RING_SIZE} className="-rotate-90">
                <defs>
                  <linearGradient id={`ring-gradient-${story.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
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
                    stroke={`url(#ring-gradient-${story.id})`}
                    strokeWidth={STROKE}
                    strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                  />
                )}
              </svg>
              <div className="absolute inset-1.5 overflow-hidden rounded-full">
                <Image src={story.cover || "/placeholder.svg"} alt="" fill className="object-cover" />
                {progress?.ended && (
                  <div className="absolute inset-0 flex items-center justify-center bg-foreground/50">
                    <Check className="size-5 text-background" />
                  </div>
                )}
              </div>
            </div>
          )

          return (
            <button
              key={story.id}
              type="button"
              onClick={() => (started ? setActiveStory(story) : undefined)}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5"
              aria-label={started ? `View progress for ${story.title}` : `${story.title} — not started`}
            >
              {started ? (
                ring
              ) : (
                <Link href={`/story/${story.id}`} className="contents">
                  {ring}
                </Link>
              )}
              <span className="w-full truncate text-center text-[11px] font-medium leading-tight text-muted-foreground">
                {story.id.charAt(0).toUpperCase() + story.id.slice(1)}
              </span>
            </button>
          )
        })}
      </div>

      <Sheet open={Boolean(activeStory)} onOpenChange={(open) => !open && setActiveStory(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 font-sans text-lg">What&apos;s happened so far</SheetTitle>
          </SheetHeader>
          {activeStory && activeProgress && (
            <div className="flex flex-col gap-5 overflow-y-auto px-4 pb-6">
              <div className="flex items-center gap-3">
                <div className="relative size-16 shrink-0 overflow-hidden rounded-2xl">
                  <Image src={activeProgress.cover || "/placeholder.svg"} alt="" fill className="object-cover" />
                </div>
                <div>
                  <p className="font-serif text-lg leading-tight">{activeProgress.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeProgress.ended ? "This chapter has closed" : `Chapter ${activeProgress.chapter}`}
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-4 rounded-2xl bg-muted p-4">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Current objective
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">{activeProgress.current_objective}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Stakes</span>
                  <span className="text-sm leading-relaxed text-foreground">{activeProgress.stakes}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What&apos;s next
                  </span>
                  <span className="text-sm leading-relaxed text-foreground">{activeProgress.next_event}</span>
                </div>
              </div>

              <Button
                size="lg"
                className="w-full"
                nativeButton={false}
                render={
                  <Link href={`/story/${activeProgress.storyId}`}>
                    {activeProgress.ended ? "Revisit story" : "Resume story"}
                  </Link>
                }
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  )
}

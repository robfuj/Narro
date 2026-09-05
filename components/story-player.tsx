"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Loader2, PanelRight, Send } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group"
import { getOrCreateSessionId, resetSessionId } from "@/lib/session"
import { saveStoryProgress } from "@/lib/progress"
import { cn } from "@/lib/utils"
import type { CastAgentOutput, Portrait, OpenThread, BranchMenu, StorySkeleton } from "@/lib/engine/types"

interface TurnResponse {
  scene: string
  reader_callout?: string
  cast?: Record<string, CastAgentOutput>
  player_agency_options: string[]
  character_images: Record<string, Portrait>
  ended: boolean
  branch_menu: BranchMenu | null
  narrative: { transportation: number; warnings: string[] }
  director: { selected_action: string; rationale: string }
  used_ai: boolean
  state_snapshot: {
    chapter: number
    current_objective: string
    stakes: string
    theme: string
    discovered_clues: string[]
    known_relationships: string[]
    next_event: string
    ended: boolean
    transportation?: number
  }
  open_threads_snapshot: OpenThread[]
  story?: { id: string; title: string; cover: string; skeleton?: StorySkeleton }
  error?: string
}

type Snapshot = TurnResponse["state_snapshot"]
type LogEntry = {
  role: "scene" | "player"
  text: string
  chapter?: number
  // The narrator's direct address to the reader for this beat.
  callout?: string
  // Each present character's own sub-agent answer for this beat.
  cast?: Record<string, CastAgentOutput>
}

// Small mono eyebrow label, the Coldharbour-style section marker rendered in
// the quiet Oura palette instead of the original dark candle-lit one.
function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground", className)}>
      {children}
    </p>
  )
}

function StateFacts({ snapshot }: { snapshot: Snapshot }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Eyebrow>Objective</Eyebrow>
        <p className="text-sm leading-relaxed">{snapshot.current_objective}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Eyebrow>Stakes</Eyebrow>
        <p className="text-sm leading-relaxed">{snapshot.stakes}</p>
      </div>
      <div className="flex flex-col gap-1">
        <Eyebrow>Next event</Eyebrow>
        <p className="text-sm leading-relaxed">{snapshot.next_event}</p>
      </div>
      {typeof snapshot.transportation === "number" && (
        <div className="flex flex-col gap-2">
          <Eyebrow>Immersion</Eyebrow>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${snapshot.transportation}%` }}
            />
          </div>
        </div>
      )}
      {snapshot.discovered_clues.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Eyebrow>Discovered</Eyebrow>
          <ul className="flex flex-col gap-1">
            {snapshot.discovered_clues.map((clue) => (
              <li key={clue} className="text-sm leading-relaxed text-muted-foreground">
                {clue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ThreadsList({ threads }: { threads: OpenThread[] }) {
  return (
    <div className="flex flex-col gap-2">
      <Eyebrow>Open threads</Eyebrow>
      {threads.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
      <div className="flex flex-col gap-1.5">
        {threads.map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
            <span className="text-sm capitalize">{t.id.replace(/_/g, " ")}</span>
            <Badge variant={t.status === "closed" ? "secondary" : "outline"} className="text-xs capitalize">
              {t.status === "closed" ? "resolved" : t.priority}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

function CastList({ images, relationships }: { images: Record<string, Portrait>; relationships: string[] }) {
  const cast = Object.entries(images)
  if (cast.length === 0) return null
  return (
    <div className="flex flex-col gap-3">
      <Eyebrow>Cast encountered</Eyebrow>
      <div className="flex flex-col gap-3">
        {cast.map(([name, portrait]) => (
          <div key={name} className="flex items-center gap-3">
            <div className="relative size-11 shrink-0 overflow-hidden rounded-full ring-1 ring-border">
              <Image src={portrait.url || "/placeholder.svg"} alt={name} fill className="object-cover" />
            </div>
            <span className="text-sm capitalize">{name}</span>
          </div>
        ))}
      </div>
      {relationships.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-3">
          <Eyebrow>Relationships</Eyebrow>
          <ul className="flex flex-col gap-1">
            {relationships.map((r) => (
              <li key={r} className="text-sm leading-relaxed text-muted-foreground">
                {r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function StoryPlayer({ storyId, title, cover }: { storyId: string; title: string; cover: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [options, setOptions] = useState<string[]>([])
  const [images, setImages] = useState<Record<string, Portrait>>({})
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [threads, setThreads] = useState<OpenThread[]>([])
  const [skeleton, setSkeleton] = useState<StorySkeleton | null>(null)
  const [branchMenu, setBranchMenu] = useState<BranchMenu | null>(null)
  const [ended, setEnded] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = getOrCreateSessionId(storyId)
    setSessionId(id)
    void startSession(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [log, loading])

  function persistProgress(data: TurnResponse) {
    saveStoryProgress({
      storyId,
      title,
      cover,
      chapter: data.state_snapshot.chapter,
      current_objective: data.state_snapshot.current_objective,
      stakes: data.state_snapshot.stakes,
      next_event: data.state_snapshot.next_event,
      ended: data.state_snapshot.ended,
    })
  }

  async function startSession(id: string) {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: id, story_id: storyId, action: "start" }),
      })
      const data: TurnResponse = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to start story")
      setLog([
        {
          role: "scene",
          text: data.scene,
          chapter: data.state_snapshot.chapter,
          callout: data.reader_callout,
          cast: data.cast,
        },
      ])
      setOptions(data.player_agency_options || [])
      setImages(data.character_images || {})
      setSnapshot(data.state_snapshot)
      setThreads(data.open_threads_snapshot || [])
      setSkeleton(data.story?.skeleton || null)
      persistProgress(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  async function submitTurn(text: string) {
    if (!sessionId || !text.trim() || loading || ended) return
    setLog((l) => [...l, { role: "player", text }])
    setInput("")
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, player_input: text }),
      })
      const data: TurnResponse = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to continue")
      setLog((l) => [
        ...l,
        {
          role: "scene",
          text: data.scene,
          chapter: data.state_snapshot.chapter,
          callout: data.reader_callout,
          cast: data.cast,
        },
      ])
      setOptions(data.player_agency_options || [])
      setImages((prev) => ({ ...prev, ...data.character_images }))
      setSnapshot(data.state_snapshot)
      setThreads(data.open_threads_snapshot || [])
      persistProgress(data)
      if (data.ended) {
        setEnded(true)
        setBranchMenu(data.branch_menu)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
      setLog((l) => l.slice(0, -1))
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
      e.preventDefault()
      submitTurn(input)
    }
  }

  function goToStory(nextStoryId: string) {
    resetSessionId(nextStoryId)
    window.location.href = `/story/${nextStoryId}`
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              nativeButton={false}
              render={
                <Link href="/" aria-label="Back to library">
                  <ArrowLeft />
                </Link>
              }
            />
            <div className="flex flex-col">
              <Eyebrow>Case file — {storyId}</Eyebrow>
              <span className="font-display text-lg leading-tight">{title}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {snapshot && (
              <span className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground sm:block">
                Chapter {String(snapshot.chapter).padStart(2, "0")}
              </span>
            )}
            <Sheet>
              <SheetTrigger
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "lg:hidden")}
              >
                <PanelRight data-icon="inline-start" />
                Story state
              </SheetTrigger>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle className="font-display">Living state</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
                  {snapshot && <StateFacts snapshot={snapshot} />}
                  <ThreadsList threads={threads} />
                  <CastList images={images} relationships={snapshot?.known_relationships || []} />
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_minmax(0,1fr)_240px]">
        <aside className="order-2 hidden lg:order-1 lg:block">
          <div className="sticky top-20 flex flex-col gap-6 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
            {snapshot ? <StateFacts snapshot={snapshot} /> : <p className="text-sm text-muted-foreground">…</p>}
          </div>
        </aside>

        <section className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
          {skeleton && (
            <article className="rounded-2xl bg-card p-6 shadow-sm ring-1 ring-border sm:p-8">
              <Eyebrow>The premise</Eyebrow>
              <h1 className="mt-3 font-display text-3xl leading-tight text-balance sm:text-4xl">{title}</h1>
              <p className="mt-3 font-story text-base italic leading-relaxed text-muted-foreground text-pretty">
                {skeleton.logline}
              </p>
              <div className="mt-6 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <Eyebrow>Your fantasy</Eyebrow>
                  <p className="text-sm leading-relaxed">{skeleton.player_fantasy}</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Eyebrow>Pressure engine</Eyebrow>
                  <p className="text-sm leading-relaxed">{skeleton.pressure_engine}</p>
                </div>
              </div>
            </article>
          )}

          {log.length === 0 && !error && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Opening {title}…</p>
            </div>
          )}

          <div className="flex flex-col gap-8">
            {log.map((entry, i) => {
              if (entry.role === "player") {
                return (
                  <div key={i} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-secondary px-4 py-2.5">
                      <p className="text-sm leading-relaxed text-secondary-foreground">{entry.text}</p>
                    </div>
                  </div>
                )
              }
              const entryIndex = log.slice(0, i + 1).filter((e) => e.role === "scene").length
              const castEntries = Object.values(entry.cast || {})
              return (
                <article key={i} className="flex flex-col gap-3">
                  <Eyebrow>
                    Entry {String(entryIndex).padStart(2, "0")}
                    {typeof entry.chapter === "number" && <> · Chapter {String(entry.chapter).padStart(2, "0")}</>}
                  </Eyebrow>

                  {/* The narrator breaking the fourth wall to speak to the reader.
                      Set as a centred pull-quote so it reads as a distinct voice
                      from the scene prose rather than another paragraph of it. */}
                  {entry.callout && (
                    <figure className="flex flex-col items-center gap-1.5 text-center">
                      <Eyebrow className="text-primary">To you</Eyebrow>
                      <blockquote className="font-display text-xl italic leading-snug text-balance sm:text-2xl">
                        {entry.callout}
                      </blockquote>
                    </figure>
                  )}

                  <p className="font-story text-lg leading-relaxed text-pretty">{entry.text}</p>

                  {/* Each character is its own sub-agent; this surfaces what each
                      one wants from the reader, which the prose deliberately
                      leaves as subtext. */}
                  {castEntries.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-border pt-3">
                      <Eyebrow>What they&apos;re after</Eyebrow>
                      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                        {castEntries.map((c) => (
                          <div
                            key={c.character}
                            className="flex min-w-0 flex-col gap-0.5 rounded-lg bg-muted px-3 py-2 sm:basis-52 sm:flex-1"
                          >
                            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                              {c.character}
                            </span>
                            <span className="text-sm leading-snug">{c.wants_from_player || c.intent}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {loading && log.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              The story is unfolding…
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        <aside className="order-3 hidden lg:block">
          <div className="sticky top-20 flex flex-col gap-6">
            <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
              <CastList images={images} relationships={snapshot?.known_relationships || []} />
            </div>
            <div className="flex flex-col gap-4 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border">
              <ThreadsList threads={threads} />
            </div>
          </div>
        </aside>
      </main>

      <div className="sticky bottom-0 border-t border-border bg-background/85 px-4 py-4 backdrop-blur sm:px-6">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
          {ended && branchMenu ? (
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm text-muted-foreground">This chapter has closed.</p>
              <div className="flex flex-wrap justify-center gap-2">
                <Button variant="outline" onClick={() => setEnded(false)}>
                  {branchMenu.continue_story.label}
                </Button>
                {branchMenu.other_stories.map((b) => (
                  <Button key={b.story_id} onClick={() => goToStory(b.story_id)}>
                    {b.label}
                  </Button>
                ))}
                <Button variant="ghost" nativeButton={false} render={<Link href="/">{branchMenu.end_here.label}</Link>} />
              </div>
            </div>
          ) : (
            <>
              {options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {options.map((opt) => (
                    <Button
                      key={opt}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      onClick={() => submitTurn(opt)}
                      className="capitalize"
                    >
                      {opt}
                    </Button>
                  ))}
                </div>
              )}
              <InputGroup>
                <InputGroupInput
                  placeholder="Write what you do or say…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    disabled={loading || !input.trim()}
                    onClick={() => submitTurn(input)}
                    aria-label="Send"
                  >
                    <Send />
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

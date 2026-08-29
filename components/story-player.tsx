"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, BookOpen, Loader2, PanelRight, Send } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { InputGroup, InputGroupInput, InputGroupAddon, InputGroupButton } from "@/components/ui/input-group"
import { getOrCreateSessionId, resetSessionId } from "@/lib/session"
import { cn } from "@/lib/utils"
import type { Portrait, OpenThread, BranchMenu } from "@/lib/engine/types"

interface TurnResponse {
  scene: string
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
  story?: { id: string; title: string; cover: string }
  error?: string
}

type LogEntry = { role: "scene" | "player"; text: string }

export function StoryPlayer({ storyId, title }: { storyId: string; title: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [log, setLog] = useState<LogEntry[]>([])
  const [options, setOptions] = useState<string[]>([])
  const [images, setImages] = useState<Record<string, Portrait>>({})
  const [snapshot, setSnapshot] = useState<TurnResponse["state_snapshot"] | null>(null)
  const [threads, setThreads] = useState<OpenThread[]>([])
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
      setLog([{ role: "scene", text: data.scene }])
      setOptions(data.player_agency_options || [])
      setImages(data.character_images || {})
      setSnapshot(data.state_snapshot)
      setThreads(data.open_threads_snapshot || [])
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
      setLog((l) => [...l, { role: "scene", text: data.scene }])
      setOptions(data.player_agency_options || [])
      setImages((prev) => ({ ...prev, ...data.character_images }))
      setSnapshot(data.state_snapshot)
      setThreads(data.open_threads_snapshot || [])
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

  const castImages = Object.entries(images)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
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
          <div className="flex items-center gap-2">
            <BookOpen className="size-4 text-primary" />
            <span className="font-serif text-base">{title}</span>
          </div>
        </div>
        <Sheet>
          <SheetTrigger className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
            <PanelRight data-icon="inline-start" />
            Story state
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle className="font-serif">Living state</SheetTitle>
            </SheetHeader>
            <div className="flex flex-col gap-6 overflow-y-auto px-4 pb-6">
              {snapshot && (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Chapter</span>
                    <span className="text-sm">{snapshot.chapter}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Current objective</span>
                    <span className="text-sm leading-relaxed">{snapshot.current_objective}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Stakes</span>
                    <span className="text-sm leading-relaxed">{snapshot.stakes}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">Next event</span>
                    <span className="text-sm leading-relaxed">{snapshot.next_event}</span>
                  </div>
                  {typeof snapshot.transportation === "number" && (
                    <div className="flex flex-col gap-2">
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">Immersion</span>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${snapshot.transportation}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Open threads</span>
                {threads.length === 0 && <span className="text-sm text-muted-foreground">None yet.</span>}
                <div className="flex flex-col gap-1.5">
                  {threads.map((t) => (
                    <div key={t.id} className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-2">
                      <span className="text-sm">{t.id.replace(/_/g, " ")}</span>
                      <Badge variant={t.status === "closed" ? "secondary" : "outline"} className="text-xs capitalize">
                        {t.status === "closed" ? "resolved" : t.priority}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
              {castImages.length > 0 && (
                <div className="flex flex-col gap-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Cast encountered</span>
                  <div className="flex flex-wrap gap-3">
                    {castImages.map(([name, portrait]) => (
                      <div key={name} className="flex flex-col items-center gap-1.5">
                        <div className="relative size-14 overflow-hidden rounded-full border border-border">
                          <Image src={portrait.url || "/placeholder.svg"} alt={name} fill className="object-cover" />
                        </div>
                        <span className="text-xs capitalize text-muted-foreground">{name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex flex-1 flex-col">
        <ScrollArea className="flex-1">
          <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
            {log.length === 0 && !error && (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Loader2 className="size-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Opening {title}…</p>
              </div>
            )}

            {log.map((entry, i) =>
              entry.role === "scene" ? (
                <p key={i} className="font-serif text-lg leading-relaxed text-pretty">
                  {entry.text}
                </p>
              ) : (
                <div key={i} className="self-end rounded-lg bg-secondary px-4 py-2.5">
                  <p className="text-sm leading-relaxed text-secondary-foreground">{entry.text}</p>
                </div>
              ),
            )}

            {loading && log.length > 0 && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                The story is unfolding…
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <div ref={bottomRef} />
          </div>
        </ScrollArea>

        <div className="border-t border-border bg-background px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-2xl flex-col gap-3">
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
                  <Button
                    variant="ghost"
                    nativeButton={false}
                    render={<Link href="/">{branchMenu.end_here.label}</Link>}
                  />
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
    </div>
  )
}

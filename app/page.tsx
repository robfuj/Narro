import { BookOpen } from "lucide-react"
import { listLibrary } from "@/lib/engine/store"
import { StoryCard } from "@/components/story-card"

export default function Home() {
  const stories = listLibrary()

  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center gap-2 px-6 py-5">
          <BookOpen className="size-5 text-primary" />
          <span className="font-serif text-lg tracking-tight">Narro</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-14">
        <section className="mb-14 max-w-2xl">
          <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">転生したら · isekai</p>
          <h1 className="mb-5 font-serif text-4xl leading-tight text-balance sm:text-5xl">
            Awaken in another world. Keep every memory. Live the second life your way.
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground text-pretty">
            You are not chatting with a model — you are living inside a world that remembers. Every choice you make
            becomes a moment the story can call back to. Choose a world below to begin.
          </p>
        </section>

        <section>
          <h2 className="mb-5 font-sans text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Worlds
          </h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-6 py-10 text-xs text-muted-foreground">
        Adventure only — no romance or companionship mechanics at this stage.
      </footer>
    </div>
  )
}

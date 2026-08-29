import { BookOpen } from "lucide-react"
import { listLibrary } from "@/lib/engine/store"
import { StoryCard } from "@/components/story-card"
import { StoriesRing } from "@/components/stories-ring"

export default function Home() {
  const stories = listLibrary()

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center gap-2 px-5 pt-6 pb-2 sm:px-6">
        <BookOpen className="size-4 text-primary" />
        <span className="text-sm font-medium tracking-tight text-muted-foreground">Narro</span>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6 sm:px-6">
        <section className="mb-10 flex flex-col items-center gap-2 pt-4">
          <StoriesRing totalStories={stories.length} />
        </section>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted-foreground">New stories</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {stories.map((story) => (
              <StoryCard key={story.id} story={story} />
            ))}
          </div>
        </section>
      </main>

      <footer className="mx-auto max-w-5xl px-5 py-10 text-xs text-muted-foreground sm:px-6">
        Adventure only — no romance or companionship mechanics at this stage.
      </footer>
    </div>
  )
}

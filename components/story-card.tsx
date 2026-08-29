import Image from "next/image"
import Link from "next/link"
import { ArrowUpRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"

export interface LibraryStory {
  id: string
  title: string
  cover: string
  premise: string
  genre: string
  player_role: string
  logline: string
  leads_to: string[]
}

export function StoryCard({ story }: { story: LibraryStory }) {
  return (
    <Link
      href={`/story/${story.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-border transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <Image
          src={story.cover || "/placeholder.svg"}
          alt={`Cover art for ${story.title}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <Badge
          variant="secondary"
          className="absolute left-3 top-3 rounded-full bg-card/90 font-sans text-xs uppercase tracking-wide text-foreground backdrop-blur-sm"
        >
          {story.genre}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="font-serif text-lg leading-tight text-balance">{story.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{story.logline}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-xs text-muted-foreground">{story.player_role}</span>
          <span className="flex items-center gap-1 text-sm font-medium text-primary">
            Begin
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}

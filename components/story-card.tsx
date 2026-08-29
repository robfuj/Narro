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
      className="group relative flex flex-col overflow-hidden rounded-lg border border-border bg-card transition-colors hover:border-primary/50"
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden">
        <Image
          src={story.cover || "/placeholder.svg"}
          alt={`Cover art for ${story.title}`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent" />
        <Badge variant="secondary" className="absolute left-3 top-3 font-sans text-xs uppercase tracking-wide">
          {story.genre}
        </Badge>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="font-serif text-xl leading-tight text-balance">{story.title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground text-pretty">{story.logline}</p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-xs text-muted-foreground">{story.player_role}</span>
          <span className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
            Begin
            <ArrowUpRight className="size-4" />
          </span>
        </div>
      </div>
    </Link>
  )
}

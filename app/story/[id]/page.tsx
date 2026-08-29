import { notFound } from "next/navigation"
import { SAMPLE_STORIES } from "@/lib/engine/sample-stories"
import { StoryPlayer } from "@/components/story-player"

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const story = SAMPLE_STORIES[id]
  if (!story) notFound()

  return <StoryPlayer storyId={story.id} title={story.title} cover={story.cover} />
}

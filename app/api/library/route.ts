import { NextResponse } from "next/server"
import { listLibrary } from "@/lib/engine/store"

export async function GET() {
  return NextResponse.json({ stories: listLibrary() })
}

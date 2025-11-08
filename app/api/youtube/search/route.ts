import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) return NextResponse.json({ error: "missing query" }, { status: 400 });

  try {
    const apiKey = process.env.YOUTUBE_API_KEY;
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&videoCategoryId=10&q=${encodeURIComponent(
      q
    )}&key=${apiKey}`;
    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ videoId: null });
    }

    const videoId = data.items[0].id.videoId;
    return NextResponse.json({ videoId });
  } catch (err) {
    console.error("YouTube API error:", err);
    return NextResponse.json({ videoId: null });
  }
}

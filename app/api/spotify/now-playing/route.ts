import { NextResponse } from "next/server";
import { getAccessToken } from "../token";

export async function GET() {
  try {
    const token = await getAccessToken();
    const resp = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (resp.status === 204 || resp.status > 400) {
      return NextResponse.json({ isPlaying: false });
    }

    const data = await resp.json();
    return NextResponse.json({
      isPlaying: data.is_playing,
      progressMs: data.progress_ms,
      durationMs: data.item?.duration_ms,
      track: {
        id: data.item?.id,
        name: data.item?.name,
        uri: data.item?.uri,
      },
      artists: data.item?.artists?.map((a: any) => a.name) || [],
      album: {
        name: data.item?.album?.name,
        image: data.item?.album?.images?.[0]?.url || null,
      },
    });
  } catch (err) {
    console.error("Now Playing Error:", err);
    return NextResponse.json({ isPlaying: false });
  }
}

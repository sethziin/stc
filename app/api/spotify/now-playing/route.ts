import { NextResponse } from "next/server";

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
} = process.env;

async function getAccessToken() {
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: SPOTIFY_REFRESH_TOKEN!,
    }),
  });

  const data = await res.json();
  return data.access_token;
}

export async function GET() {
  try {
    const access_token = await getAccessToken();

    const now = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
      next: { revalidate: 0 },
    });

    // 204 = nada tocando
    if (now.status === 204) return NextResponse.json({ isPlaying: false });

    const json = await now.json();

    if (!json || !json.item) return NextResponse.json({ isPlaying: false });

    const artists = json.item.artists?.map((a: any) => a.name) || [];

    return NextResponse.json({
      isPlaying: json.is_playing,
      progressMs: json.progress_ms,
      durationMs: json.item.duration_ms,
      track: {
        id: json.item.id,
        name: json.item.name,
        uri: json.item.uri,
      },
      artists,
      album: {
        name: json.item.album.name,
        image: json.item.album.images?.[0]?.url ?? null,
      },
    });
  } catch (err) {
    console.error("Erro no now-playing:", err);
    return NextResponse.json({ isPlaying: false });
  }
}

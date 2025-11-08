import { NextResponse } from "next/server";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

const client_id = process.env.SPOTIFY_CLIENT_ID!;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET!;
const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN!;

// 1️⃣ Usa o refresh token fixo do .env para gerar novo access token
export async function getAccessToken(): Promise<string> {
  if (!refresh_token) throw new Error("Missing SPOTIFY_REFRESH_TOKEN in .env.local");

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token,
  });

  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${client_id}:${client_secret}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error("Spotify token refresh failed:", text);
    throw new Error("Failed to refresh Spotify access token");
  }

  const data = await resp.json();
  return data.access_token as string;
}

// 2️⃣ Endpoint opcional /api/spotify/token para depuração
export async function GET() {
  try {
    const token = await getAccessToken();
    return NextResponse.json({ ok: true, token });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message });
  }
}

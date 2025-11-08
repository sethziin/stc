import { cookies } from "next/headers";

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

function basicAuth() {
  const id = process.env.SPOTIFY_CLIENT_ID!;
  const secret = process.env.SPOTIFY_CLIENT_SECRET!;
  return Buffer.from(`${id}:${secret}`).toString("base64");
}

// troca código de autorização pelo token
export async function exchangeCodeForToken(code: string) {
  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI!,
    }),
  });

  if (!resp.ok) throw new Error("Failed to exchange code");
  return resp.json() as Promise<{
    access_token: string;
    token_type: string;
    scope: string;
    expires_in: number;
    refresh_token: string;
  }>;
}

// atualiza o access token usando o refresh token
export async function refreshAccessToken() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get("spotify_refresh_token")?.value;
  if (!refresh) throw new Error("Missing refresh token cookie");

  const resp = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh,
    }),
    cache: "no-store",
  });

  if (!resp.ok) throw new Error("Failed to refresh access token");
  return resp.json() as Promise<{
    access_token: string;
    token_type: string;
    scope: string;
    expires_in: number;
  }>;
}

// pega o token pronto para usar
export async function getAccessToken(): Promise<string> {
  const refreshed = await refreshAccessToken();
  return refreshed.access_token;
}

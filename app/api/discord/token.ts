// app/api/discord/token.ts
import { cookies } from "next/headers";

const TOKEN_URL = "https://discord.com/api/oauth2/token";
const CLIENT_ID = process.env.DISCORD_CLIENT_ID!;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET!;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI!;
const COOKIE_NAME = "discord_refresh_token_owner";
const OWNER_ID = process.env.DISCORD_OWNER_ID!;

type TokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export async function exchangeDiscordCodeForToken(code: string) {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT_URI,
  });

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Discord token exchange failed: ${t}`);
  }

  const json = (await resp.json()) as TokenResponse;
  return json;
}

export async function refreshDiscordAccessToken() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get(COOKIE_NAME)?.value;
  if (!refresh) throw new Error("Missing Discord refresh token cookie");

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token: refresh,
  });

  const resp = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Discord token refresh failed: ${t}`);
    }

  const json = (await resp.json()) as TokenResponse;

  // regrava refresh token (pode mudar)
  cookieStore.set(COOKIE_NAME, json.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return json.access_token;
}

export async function getDiscordAccessToken() {
  // simplesmente renova usando o refresh guardado
  return refreshDiscordAccessToken();
}

/** helper para garantir que só o dono use as rotas protegidas (opcional) */
export function assertOwner(userId: string) {
  if (!OWNER_ID) return; // se não quiser travar por id
  if (userId !== OWNER_ID) {
    throw new Error("Not allowed: only owner.");
  }
}

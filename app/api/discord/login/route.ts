import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function GET() {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI!);
  const scopes = encodeURIComponent("identify");

  // CSRF state
  const state = crypto.randomBytes(16).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set("discord_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });

  const url =
    `https://discord.com/oauth2/authorize?client_id=${clientId}` +
    `&response_type=code&redirect_uri=${redirectUri}&scope=${scopes}&state=${state}`;

  return NextResponse.redirect(url);
}

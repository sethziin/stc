// app/api/discord/callback/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeDiscordCodeForToken } from "../token";

const COOKIE_NAME = "discord_refresh_token_owner";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  if (!code) return new NextResponse("Missing code", { status: 400 });

  try {
    const tokens = await exchangeDiscordCodeForToken(code);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, tokens.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });

    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    // volta pra /spotify (ou outra página)
    return NextResponse.redirect(`${site}/spotify`);
  } catch (e) {
    console.error(e);
    return new NextResponse("Discord token exchange failed", { status: 500 });
  }
}

// app/api/discord/login/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const clientId = process.env.DISCORD_CLIENT_ID!;
  const redirectUri = encodeURIComponent(process.env.DISCORD_REDIRECT_URI!);
  const scope = encodeURIComponent("identify connections"); // remova "connections" se não precisar
  const url = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${redirectUri}&scope=${scope}`;

  return NextResponse.redirect(url);
}

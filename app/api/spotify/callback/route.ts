import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAccessToken } from "../token";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return new NextResponse("Missing code", { status: 400 });
  }

  try {
    // Pega o token de acesso usando a função correta
    const token = await getAccessToken();

    // Salva o refresh token em cookie (se existir)
    const cookieStore = await cookies();
    if (token.refresh_token) {
      cookieStore.set("spotify_refresh_token", token.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365, // 1 ano
      });
    }

    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    return NextResponse.redirect(`${site}/spotify`);
  } catch (err) {
    console.error("Callback error:", err);
    return new NextResponse("Token exchange failed", { status: 500 });
  }
}

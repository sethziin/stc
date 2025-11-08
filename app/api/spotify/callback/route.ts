import { NextResponse } from "next/server";
import { getAccessToken } from "../token"; // usa o novo helper

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");

  if (!code) {
    return NextResponse.json({ error: "Missing authorization code" }, { status: 400 });
  }

  try {
    // tenta obter um novo access token diretamente com o refresh_token do .env
    const token = await getAccessToken();

    // redireciona para /spotify após login bem-sucedido
    const redirectUrl = new URL("/spotify", req.url);
    redirectUrl.searchParams.set("token", token);

    return NextResponse.redirect(redirectUrl.toString());
  } catch (err: any) {
    console.error("Spotify callback error:", err);
    return NextResponse.json({ error: "Failed to complete Spotify authorization" });
  }
}

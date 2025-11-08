import { NextResponse } from "next/server";
import { getAccessToken } from "@/app/lib/spotify/auth";

export async function GET() {
  try {
    const access_token = await getAccessToken();
    return NextResponse.json({ access_token });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Erro ao obter token" }, { status: 500 });
  }
}

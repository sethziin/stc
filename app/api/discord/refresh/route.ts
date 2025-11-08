import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function POST() {
  try {
    const ownerId = process.env.DISCORD_OWNER_ID!;

    // pega profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, discord_id")
      .eq("discord_id", ownerId)
      .single();
    if (!profile) throw new Error("owner_profile_missing");

    const { data: tok } = await supabaseAdmin
      .from("discord_tokens")
      .select("*")
      .eq("profile_id", profile.id)
      .single();
    if (!tok) throw new Error("tokens_missing");

    const needsRefresh = !tok.expires_at || new Date(tok.expires_at) < new Date();
    if (!needsRefresh) return NextResponse.json({ refreshed: false });

    const body = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: tok.refresh_token,
    });

    const r = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (!r.ok) throw new Error("refresh_failed");
    const j = await r.json();

    await supabaseAdmin
      .from("discord_tokens")
      .update({
        access_token: j.access_token,
        refresh_token: j.refresh_token ?? tok.refresh_token, // às vezes não retorna um novo
        scope: j.scope ?? tok.scope,
        token_type: j.token_type ?? tok.token_type,
        expires_at: new Date(Date.now() + j.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("profile_id", profile.id);

    return NextResponse.json({ refreshed: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "refresh_error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// Retorna o perfil público armazenado (do dono do site)
export async function GET() {
  try {
    const ownerId = process.env.DISCORD_OWNER_ID!;
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("discord_id, username, global_name, avatar_url, badges, public_flags, updated_at")
      .eq("discord_id", ownerId)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "discord_me_failed" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type TokenResp = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

type Me = {
  id: string;
  username: string;
  global_name?: string | null;
  avatar?: string | null;
  public_flags?: number;
};

async function exchangeCode(code: string): Promise<TokenResp> {
  const body = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    client_secret: process.env.DISCORD_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code,
    redirect_uri: process.env.DISCORD_REDIRECT_URI!,
  });

  const resp = await fetch("https://discord.com/api/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!resp.ok) throw new Error("token_exchange_failed");
  return resp.json();
}

async function fetchMe(accessToken: string): Promise<Me> {
  const r = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!r.ok) throw new Error("discord_me_failed");
  return r.json();
}

function flagsToBadges(flags = 0) {
  const list: { key: string; label: string }[] = [];

  const map = [
    { bit: 1 << 0, key: "staff", label: "Discord Staff" },
    { bit: 1 << 1, key: "partner", label: "Partner" },
    { bit: 1 << 3, key: "bug1", label: "Bug Hunter" },
    { bit: 1 << 14, key: "early", label: "Early Supporter" },
    { bit: 1 << 17, key: "active_dev", label: "Active Developer" },
  ];

  for (const entry of map) {
    if ((flags & entry.bit) === entry.bit) {
      list.push({ key: entry.key, label: entry.label });
    }
  }

  return list;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieStore = await cookies();
  const prevState = cookieStore.get("discord_oauth_state")?.value;

  if (!code || !state || state !== prevState) {
    return new NextResponse("invalid_state_or_code", { status: 400 });
  }

  try {
    const tokens = await exchangeCode(code);
    const me = await fetchMe(tokens.access_token);

    // Salva/atualiza profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          discord_id: me.id,
          username: me.username,
          global_name: me.global_name ?? null,
          avatar_url: me.avatar
            ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.png?size=256`
            : null,
          public_flags: me.public_flags ?? 0,
          badges: flagsToBadges(me.public_flags ?? 0),
          updated_at: new Date().toISOString(),
          is_public: true,
        },
        { onConflict: "discord_id" }
      )
      .select("id, discord_id")
      .single();

    if (!profile) throw new Error("profile_upsert_failed");

    // Salva tokens (somente server role possui acesso)
    await supabaseAdmin
      .from("discord_tokens")
      .upsert({
        profile_id: profile.id,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      });

    // Se este usuário autenticado é o “dono” do site, pronto.
    // (Se quiser aceitar múltiplos, você pode guardar a lista)
    const ownerId = process.env.DISCORD_OWNER_ID!;
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const redirectTo = me.id === ownerId ? `${site}/spotify` : `${site}/`;
    return NextResponse.redirect(redirectTo);
  } catch (e) {
    console.error(e);
    return new NextResponse("discord_callback_failed", { status: 500 });
  }
}

// app/api/discord/me/route.ts
import { NextResponse } from "next/server";
import { getDiscordAccessToken } from "../token";

const DISCORD_API = "https://discord.com/api";

function mapBadges(public_flags: number, premium_type?: number) {
  // flags (https://discord.com/developers/docs/resources/user#user-object-user-flags)
  const flags: { key: string; label: string }[] = [];

  const F = (bit: number) => (public_flags & bit) === bit;

  const UserFlags = {
    STAFF: 1 << 0,
    PARTNER: 1 << 1,
    HYPESQUAD: 1 << 2,
    BUG_HUNTER_LEVEL_1: 1 << 3,
    HYPESQUAD_ONLINE_HOUSE_1: 1 << 6,
    HYPESQUAD_ONLINE_HOUSE_2: 1 << 7,
    HYPESQUAD_ONLINE_HOUSE_3: 1 << 8,
    EARLY_SUPPORTER: 1 << 9,
    BUG_HUNTER_LEVEL_2: 1 << 14,
    VERIFIED_DEVELOPER: 1 << 17,
  };

  if (F(UserFlags.STAFF)) flags.push({ key: "staff", label: "Discord Staff" });
  if (F(UserFlags.PARTNER)) flags.push({ key: "partner", label: "Partner" });
  if (F(UserFlags.HYPESQUAD)) flags.push({ key: "hypesquad", label: "HypeSquad" });
  if (F(UserFlags.HYPESQUAD_ONLINE_HOUSE_1)) flags.push({ key: "bravery", label: "House of Bravery" });
  if (F(UserFlags.HYPESQUAD_ONLINE_HOUSE_2)) flags.push({ key: "brilliance", label: "House of Brilliance" });
  if (F(UserFlags.HYPESQUAD_ONLINE_HOUSE_3)) flags.push({ key: "balance", label: "House of Balance" });
  if (F(UserFlags.EARLY_SUPPORTER)) flags.push({ key: "early", label: "Early Supporter" });
  if (F(UserFlags.BUG_HUNTER_LEVEL_1)) flags.push({ key: "bug1", label: "Bug Hunter" });
  if (F(UserFlags.BUG_HUNTER_LEVEL_2)) flags.push({ key: "bug2", label: "Bug Hunter Gold" });
  if (F(UserFlags.VERIFIED_DEVELOPER)) flags.push({ key: "vbd", label: "Verified Bot Dev" });

  if (premium_type && premium_type > 0) {
    flags.push({ key: "nitro", label: "Nitro" });
  }

  return flags;
}

export async function GET() {
  try {
    const access = await getDiscordAccessToken();
    // perfil
    const me = await fetch(`${DISCORD_API}/users/@me`, {
      headers: { Authorization: `Bearer ${access}` },
      cache: "no-store",
    });
    if (!me.ok) {
      const t = await me.text();
      throw new Error(t);
    }
    const user = await me.json();

    const avatarUrl = user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
      : null;

    return NextResponse.json({
      id: user.id,
      username: user.username,
      global_name: user.global_name ?? user.username,
      avatarUrl,
      banner: user.banner,
      badges: mapBadges(user.public_flags ?? 0, user.premium_type),
      premium_type: user.premium_type ?? 0,
    });
  } catch (e: any) {
    console.error("discord /me error:", e?.message || e);
    return NextResponse.json({ error: "discord_me_failed" }, { status: 500 });
  }
}

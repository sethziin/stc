"use client";
import { useEffect, useState } from "react";

type Me = {
  id: string;
  username: string;
  global_name?: string;
  avatarUrl?: string | null;
  badges: { key: string; label: string }[];
  premium_type: number;
};

type Lanyard = {
  discord_status?: "online" | "idle" | "dnd" | "offline";
  spotify?: { song: string; artist: string; album_art_url: string };
};

export default function DiscordCard() {
  const [me, setMe] = useState<Me | null>(null);
  const [lanyard, setLanyard] = useState<Lanyard | null>(null);

  // --- Fetch OAuth profile ---
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/discord/me", { cache: "no-store" });
        if (r.ok) setMe(await r.json());
        else console.error("Erro /me:", await r.text());
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // --- Live presence via Lanyard ---
  useEffect(() => {
    const USER_ID = process.env.NEXT_PUBLIC_DISCORD_ID || "789331231888244736";
    const ws = new WebSocket("wss://api.lanyard.rest/socket");

    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: USER_ID } }));
    };

    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.t === "INIT_STATE" || msg.t === "PRESENCE_UPDATE") {
        setLanyard(msg.d);
      }
    };

    return () => ws.close();
  }, []);

  if (!me) return null;

  const status = lanyard?.discord_status || "offline";
  const song = lanyard?.spotify?.song;
  const artist = lanyard?.spotify?.artist;
  const albumArt = lanyard?.spotify?.album_art_url;

  const statusColor =
    status === "online"
      ? "bg-green-400"
      : status === "idle"
      ? "bg-yellow-400"
      : status === "dnd"
      ? "bg-red-500"
      : "bg-gray-500";

  // --- Map icons to local images ---
  const badgeIcons: Record<string, string> = {
    staff: "/badges/staff.png",
    partner: "/badges/partner.png",
    bravery: "/badges/hypesquad-bravery.png",
    brilliance: "/badges/hypesquad-brilliance.png",
    balance: "/badges/hypesquad-balance.png",
    nitro: "/badges/nitro.png",
    bug1: "/badges/bug-hunter.png",
    bug2: "/badges/bug-hunter-gold.png",
    early: "/badges/early-supporter.png",
    vbd: "/badges/verified-bot-dev.png",
    active_dev: "/badges/active-dev.png",
  };

  return (
    <a
      href={`https://discord.com/users/${me.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between w-[540px] h-[96px] rounded-3xl px-5 py-3 border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.35)] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.05),rgba(0,0,0,0.1)_80%)] backdrop-blur-md hover:bg-white/10 transition"
    >
      {/* Left Side */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={me.avatarUrl ?? "/discord-avatar-fallback.png"}
            alt="avatar"
            className="w-14 h-14 rounded-full object-cover border border-white/10"
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0b0b0b] ${statusColor}`}
          />
        </div>

        <div className="leading-tight">
          <div className="flex items-center gap-1">
            <span className="text-white font-semibold text-base">
              {me.global_name || me.username}
            </span>
            {/* badges */}
            {me.badges.map((b) =>
              badgeIcons[b.key] ? (
                <img
                  key={b.key}
                  src={badgeIcons[b.key]}
                  title={b.label}
                  className="w-4 h-4 opacity-80 hover:opacity-100 transition"
                />
              ) : null
            )}
          </div>

          {song ? (
            <div className="text-white/80 text-sm">
              Listening to <span className="text-white font-medium">{song}</span>
              <div className="text-white/60 text-xs">by {artist}</div>
            </div>
          ) : (
            <div className="text-white/50 text-sm capitalize">{status}</div>
          )}
        </div>
      </div>

      {/* Right Side */}
      {albumArt ? (
        <img
          src={albumArt}
          alt="album"
          className="w-14 h-14 rounded-xl object-cover shadow-md"
        />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-white/5 border border-white/10" />
      )}
    </a>
  );
}

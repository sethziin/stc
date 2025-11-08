"use client";
import { useEffect, useState } from "react";

type PublicProfile = {
  discord_id: string;
  username: string;
  global_name?: string | null;
  avatar_url?: string | null;
  badges: { key: string; label: string }[];
};

type LanyardPresence = {
  discord_status: "online" | "idle" | "dnd" | "offline";
  spotify?: {
    song: string;
    artist: string;
    album_art_url: string;
  };
};

export default function DiscordCard() {
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [presence, setPresence] = useState<LanyardPresence | null>(null);
  const [transitioning, setTransitioning] = useState(false);

  // --- Carrega perfil salvo no Supabase ---
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/discord/me", { cache: "no-store" });
        if (r.ok) setProfile(await r.json());
      } catch {}
    })();
  }, []);

  // --- Lanyard + polling híbrido ---
  useEffect(() => {
    if (!profile?.discord_id) return;
    const id = profile.discord_id;
    const ws = new WebSocket("wss://api.lanyard.rest/socket");
    let heartbeat: NodeJS.Timeout | null = null;
    let lastSong: string | null = null;

    ws.onopen = () => {
      ws.send(JSON.stringify({ op: 2, d: { subscribe_to_id: id } }));
      heartbeat = setInterval(() => ws.send(JSON.stringify({ op: 3 })), 30000);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.t === "INIT_STATE" || msg.t === "PRESENCE_UPDATE") {
        if (msg.d?.spotify?.song !== lastSong) {
          setTransitioning(true);
          setTimeout(() => {
            setPresence(msg.d);
            lastSong = msg.d?.spotify?.song || null;
            setTransitioning(false);
          }, 250);
        } else {
          setPresence(msg.d);
        }
      }
    };

    // polling de fallback (caso WS não detecte)
    const poll = setInterval(async () => {
      try {
        const r = await fetch(`https://api.lanyard.rest/v1/users/${id}`);
        const j = await r.json();
        const newSong = j?.data?.spotify?.song || null;
        if (newSong !== lastSong) {
          setTransitioning(true);
          setTimeout(() => {
            setPresence(j.data);
            lastSong = newSong;
            setTransitioning(false);
          }, 250);
        }
      } catch {}
    }, 5000);

    return () => {
      ws.close();
      if (heartbeat) clearInterval(heartbeat);
      clearInterval(poll);
    };
  }, [profile?.discord_id]);

  if (!profile) return null;

  const status = presence?.discord_status || "offline";
  const song = presence?.spotify?.song;
  const artist = presence?.spotify?.artist;
  const albumArt = presence?.spotify?.album_art_url;

  const statusColor =
    status === "online"
      ? "bg-green-400"
      : status === "idle"
      ? "bg-yellow-400"
      : status === "dnd"
      ? "bg-red-500"
      : "bg-gray-500";

  const badgeIcons: Record<string, string> = {
    staff: "/badges/staff.png",
    partner: "/badges/partner.png",
    bravery: "/badges/hypesquad-bravery.png",
    brilliance: "/badges/hypesquad-brilliance.png",
    balance: "/badges/hypesquad-balance.png",
    early: "/badges/early-supporter.png",
    bug1: "/badges/bug-hunter.png",
    bug2: "/badges/bug-hunter-gold.png",
    active_dev: "/badges/active-dev.png",
  };

  return (
    <a
      href={`https://discord.com/users/${profile.discord_id}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center justify-between w-[540px] h-[96px] rounded-3xl px-5 py-3 border border-white/10 
        shadow-[0_0_40px_rgba(0,0,0,0.35)] 
        bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.05),rgba(0,0,0,0.1)_80%)] 
        backdrop-blur-md hover:bg-white/10 transition-all duration-300 ${
          transitioning ? "opacity-0 translate-y-1" : "opacity-100 translate-y-0"
        }`}
    >
      {/* Esquerda */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={profile.avatar_url ?? "/discord-avatar-fallback.png"}
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
              {profile.global_name || profile.username}
            </span>
            {profile.badges.map((b) =>
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
            <div key={song} className="text-white/80 text-sm animate-fade-in">
              Listening to{" "}
              <span className="text-white font-medium">{song}</span>
              <div className="text-white/60 text-xs">by {artist}</div>
            </div>
          ) : (
            <div className="text-white/50 text-sm capitalize">{status}</div>
          )}
        </div>
      </div>

      {/* Direita */}
      {song && albumArt ? (
        <img
          src={albumArt}
          alt="album"
          className="w-14 h-14 rounded-xl object-cover shadow-md animate-fade-in"
        />
      ) : null}

      <style jsx>{`
        @keyframes fade-in {
          0% {
            opacity: 0;
            transform: translateY(6px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease forwards;
        }
      `}</style>
    </a>
  );
}

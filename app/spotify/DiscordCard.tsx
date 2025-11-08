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
  discord_user: { id: string };
  spotify?: { song: string; artist: string; album_art_url: string };
  discord_status?: "online" | "idle" | "dnd" | "offline";
};

export default function DiscordCard() {
  const [me, setMe] = useState<Me | null>(null);
  const [lanyard, setLanyard] = useState<Lanyard | null>(null);

  // carrega perfil via OAuth (badges, avatar, etc)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/discord/me", { cache: "no-store" });
        if (r.ok) setMe(await r.json());
      } catch {}
    })();
  }, []);

  // presença Spotify via Lanyard (tempo real simples)
  useEffect(() => {
    const USER_ID = process.env.NEXT_PUBLIC_DISCORD_ID || "789331231888244736";
    let ws: WebSocket | null = null;

    function connect() {
      ws = new WebSocket("wss://api.lanyard.rest/socket");
      ws.onopen = () => {
        // hello → op=2 subscribe
        setTimeout(() => {
          ws?.send(JSON.stringify({ op: 2, d: { subscribe_to_id: USER_ID } }));
        }, 250);
      };
      ws.onmessage = (ev) => {
        const msg = JSON.parse(ev.data);
        if (msg.t === "INIT_STATE" || msg.t === "PRESENCE_UPDATE") {
          setLanyard(msg.d);
        }
      };
      ws.onclose = () => {
        setTimeout(connect, 1500);
      };
    }
    connect();
    return () => ws?.close();
  }, []);

  if (!me) return null;

  const status = lanyard?.discord_status ?? "online";
  const song = lanyard?.spotify?.song;
  const artist = lanyard?.spotify?.artist;
  const albumArt = lanyard?.spotify?.album_art_url;

  const name = me.global_name || me.username;

  return (
    <a
      href={`https://discord.com/users/${me.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center justify-between w-[540px] h-[96px] rounded-3xl px-5 py-3 border border-white/10 shadow-[0_0_40px_rgba(0,0,0,0.35)] bg-[radial-gradient(120%_120%_at_0%_0%,rgba(255,255,255,0.04),rgba(255,255,255,0.02)_40%,rgba(0,0,0,0.02)_70%)] backdrop-blur-md hover:bg-white/10 transition"
    >
      {/* Esquerda: avatar + nome + linha de status */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={me.avatarUrl ?? "/discord-avatar-fallback.png"}
            alt="avatar"
            className="w-14 h-14 rounded-full object-cover border border-white/10"
          />
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#0b0b0b] ${
              status === "online"
                ? "bg-green-400"
                : status === "idle"
                ? "bg-yellow-400"
                : status === "dnd"
                ? "bg-red-500"
                : "bg-gray-500"
            }`}
          />
        </div>

        <div className="leading-tight">
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-base">{name}</span>
            {/* badges simples */}
            {me.badges.slice(0, 3).map((b) => (
              <span key={b.key} title={b.label} className="text-white/70 text-xs">
                ●
              </span>
            ))}
          </div>

          {song ? (
            <div className="text-white/80 text-sm">
              Listening to <span className="text-white">{song}</span>
              <div className="text-white/60 text-xs">by {artist}</div>
            </div>
          ) : (
            <div className="text-white/50 text-sm">Online</div>
          )}
        </div>
      </div>

      {/* Direita: capa do álbum (se houver) */}
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

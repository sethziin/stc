"use client";
import { useEffect, useState } from "react";

interface DiscordPresence {
  username: string;
  avatarUrl: string;
  spotify?: {
    song: string;
    artist: string;
    albumArtUrl: string;
  };
}

export default function DiscordCard() {
  const [data, setData] = useState<DiscordPresence | null>(null);

  useEffect(() => {
    async function fetchPresence() {
      try {
        const res = await fetch("https://api.lanyard.rest/v1/users/789331231888244736");
        const j = await res.json();
        const d = j.data;
        const user = d.discord_user;
        const presence: DiscordPresence = {
          username: user.username,
          avatarUrl: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`,
        };
        if (d.spotify) {
          presence.spotify = {
            song: d.spotify.song,
            artist: d.spotify.artist,
            albumArtUrl: d.spotify.album_art_url,
          };
        }
        setData(presence);
      } catch (e) {
        console.error("Erro ao buscar Lanyard:", e);
      }
    }

    fetchPresence();
    const i = setInterval(fetchPresence, 10000);
    return () => clearInterval(i);
  }, []);

  if (!data) return null;

  return (
    <div className="flex flex-col items-center bg-white/5 p-5 rounded-2xl shadow-lg backdrop-blur-md border border-white/10 w-[380px] hover:bg-white/10 transition-all duration-300">
      {/* Avatar + Username */}
      <div className="flex items-center gap-4 w-full mb-4">
        <img
          src={data.avatarUrl}
          alt="avatar"
          className="w-14 h-14 rounded-full object-cover border border-white/20"
        />
        <div className="flex flex-col text-left">
          <div className="text-lg font-semibold text-white">{data.username}</div>
          <div className="text-sm text-green-400 flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Online
          </div>
        </div>
      </div>

      {/* Atividade Spotify (se tiver) */}
      {data.spotify ? (
        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl w-full transition-all">
          <img
            src={data.spotify.albumArtUrl}
            alt="album"
            className="w-12 h-12 rounded-md object-cover shadow-md"
          />
          <div className="text-left">
            <div className="text-sm font-medium text-white">{data.spotify.song}</div>
            <div className="text-xs text-white/60">{data.spotify.artist}</div>
          </div>
        </div>
      ) : (
        <div className="w-full text-center text-white/50 text-sm italic py-3">
          Não ouvindo nada
        </div>
      )}

      {/* Botão Perfil */}
      <a
        href="https://discord.com/users/789331231888244736"
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 w-full text-center py-2 rounded-md bg-gradient-to-r from-[#5865F2]/90 to-[#7289da]/90 text-white font-medium hover:from-[#7289da] hover:to-[#5865F2] transition-all"
      >
        Perfil
      </a>
    </div>
  );
}

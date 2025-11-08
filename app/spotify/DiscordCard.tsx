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
    <div className="flex items-center justify-between w-[500px] h-[100px] bg-white/5 rounded-2xl backdrop-blur-md border border-white/10 shadow-lg px-5 py-3 hover:bg-white/10 transition-all duration-300">
      {/* Avatar e nome */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <img
            src={data.avatarUrl}
            alt="avatar"
            className="w-14 h-14 rounded-full object-cover border border-white/10"
          />
          <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#1e1e1e] rounded-full" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-white font-semibold text-lg">{data.username}</span>
            {/* emojis ou badges opcionais */}
            <span className="text-[#5865F2]">🟣</span>
          </div>
          {data.spotify ? (
            <div className="text-sm text-white/70">
              Listening to <span className="text-white">{data.spotify.song}</span>
              <br />
              by {data.spotify.artist}
            </div>
          ) : (
            <div className="text-sm text-white/50 italic">Online</div>
          )}
        </div>
      </div>

      {/* Capa do álbum (direita) */}
      {data.spotify?.albumArtUrl && (
        <img
          src={data.spotify.albumArtUrl}
          alt="album"
          className="w-14 h-14 rounded-xl object-cover shadow-md"
        />
      )}

      {/* Botão Perfil */}
      <a
        href="https://discord.com/users/789331231888244736"
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 rounded-2xl"
      >
        <span className="sr-only">Perfil</span>
      </a>
    </div>
  );
}

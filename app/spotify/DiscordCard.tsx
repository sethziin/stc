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
    <div className="flex items-center gap-4 bg-white/5 p-4 rounded-2xl shadow-lg backdrop-blur-md border border-white/10 w-[380px] hover:bg-white/10 transition-all duration-300">
      <img
        src={data.avatarUrl}
        alt="avatar"
        className="w-14 h-14 rounded-full object-cover"
      />
      <div className="flex flex-col text-left">
        <div className="text-lg font-semibold text-white">{data.username}</div>
        {data.spotify ? (
          <div className="text-white/70 text-sm mt-1">
            🎧 {data.spotify.song}
            <div className="text-white/40 text-xs">{data.spotify.artist}</div>
          </div>
        ) : (
          <div className="text-white/50 text-sm italic mt-1">Não ouvindo nada</div>
        )}
      </div>
      {data.spotify?.albumArtUrl && (
        <img
          src={data.spotify.albumArtUrl}
          alt="album"
          className="ml-auto w-12 h-12 rounded-md object-cover"
        />
      )}
    </div>
  );
}

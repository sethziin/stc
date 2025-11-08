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
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 gap-10 select-none">
      {/* card do Discord */}
      <div className="mb-10">
        <DiscordCard />
      </div>

      {/* conteúdo do player Spotify */}
      <div className="w-full max-w-3xl flex flex-col items-center justify-center">
        {isPlaying ? playing : center}
      </div>

      <style jsx global>{`
        body {
          background-color: #000;
          font-family: "Josefin Sans", sans-serif;
        }
        ::selection {
          background: #000;
          color: #fff;
        }
      `}</style>
    </main>
  );
}

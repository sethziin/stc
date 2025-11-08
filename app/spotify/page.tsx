"use client";

import DiscordCard from "./DiscordCard";
import { useEffect, useRef, useState } from "react";

type NowPlaying = {
  isPlaying: boolean;
  progressMs?: number;
  durationMs?: number;
  track?: { id?: string; name?: string; uri?: string };
  artists?: string[];
  album?: { name?: string; image?: string | null };
};

type LyricLine = { timeMs: number; line: string };

export default function SpotifyPage() {
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // busca a música atual
  useEffect(() => {
    async function fetchNow() {
      try {
        const r = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await r.json();
        setNow(j);
      } catch {
        setNow({ isPlaying: false });
      }
    }
    fetchNow();
    const id = setInterval(fetchNow, 2000);
    return () => clearInterval(id);
  }, []);

  // carrega letras sincronizadas
  useEffect(() => {
    async function loadLyrics() {
      if (!now?.isPlaying || !now.track?.name) {
        setLyrics([]);
        setActiveIdx(-1);
        return;
      }
      const params = new URLSearchParams({
        track: now.track.name,
        artist: (now.artists || []).join(", "),
      });
      if (now.durationMs) params.set("durationMs", String(now.durationMs));

      const r = await fetch(`/api/spotify/lyrics?${params.toString()}`, { cache: "no-store" });
      const j = await r.json();
      setLyrics(j.lyrics || []);
      setActiveIdx(-1);
    }
    loadLyrics();
  }, [now?.track?.id]);

  // sincroniza tempo da letra com progresso da música
  useEffect(() => {
    if (!now?.isPlaying || !lyrics.length) {
      if (timerRef.current) clearInterval(timerRef.current);
      setActiveIdx(-1);
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const t = now.progressMs ?? 0;
      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].timeMs <= t) idx = i;
        else break;
      }
      setActiveIdx(idx);
    }, 500);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [now?.isPlaying, now?.progressMs, lyrics]);

  // tela quando não estiver tocando nada
  const center = (
    <div className="flex flex-col items-center justify-center text-center">
      <h1 className="text-2xl text-white/70 mb-4">cri cri cri</h1>
    </div>
  );

  // tela quando estiver tocando
  const playing = (
    <div className="flex flex-col items-center justify-center text-center">
      {/* cabeçalho da música */}
      <div className="flex items-center justify-center gap-4 mb-10">
        {now?.album?.image ? (
          <img
            src={now.album.image}
            alt="album"
            className="w-20 h-20 rounded-md object-cover shadow-lg"
          />
        ) : (
          <div className="w-20 h-20 bg-white/5 rounded-md" />
        )}
        <div className="text-left">
          <div className="text-2xl font-semibold text-white">
            {now?.track?.name || "—"}
          </div>
          <div className="text-sm text-white/60 mt-1">
            {(now?.artists || []).join(", ") || "—"}
          </div>
        </div>
      </div>

      {/* letra atual */}
      {!lyrics.length ? (
        <p className="text-white/50 italic">Sem letra sincronizada para esta faixa.</p>
      ) : (
        <div className="h-[40vh] flex items-center justify-center">
          {activeIdx >= 0 && lyrics[activeIdx] ? (
            <h2
              key={lyrics[activeIdx].timeMs}
              className="text-3xl text-white font-medium tracking-wide animate-fade"
              style={{
                fontFamily: "Josefin Sans, sans-serif",
                maxWidth: "80%",
                lineHeight: "1.6",
              }}
            >
              {lyrics[activeIdx].line}
            </h2>
          ) : (
            <h2 className="text-xl text-white/40 italic">...</h2>
          )}
        </div>
      )}

      <style jsx>{`
        .animate-fade {
          opacity: 0;
          transform: translateY(12px);
          animation: fadeInOut 1s ease forwards;
        }
        @keyframes fadeInOut {
          0% {
            opacity: 0;
            transform: translateY(10px);
          }
          30% {
            opacity: 1;
            transform: translateY(0);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );

  const isPlaying = now?.isPlaying && now?.track?.name;

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6 select-none">
      <div className="w-full max-w-3xl flex flex-col items-center justify-center">
        {/* card do discord */}
        <div className="mb-10">
          <DiscordCard />
        </div>

        {/* player do spotify */}
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

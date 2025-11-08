"use client";

import { useEffect, useRef, useState } from "react";
import DiscordCard from "./DiscordCard";

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
  const [loadingLyrics, setLoadingLyrics] = useState<boolean>(false);
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<boolean>(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Atualiza o estado da faixa atual (polling)
  useEffect(() => {
    async function fetchNow() {
      try {
        const r = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await r.json();

        if (lastTrackId && j.track?.id && j.track.id !== lastTrackId) {
          // inicia transição visual
          setTransitioning(true);
          setTimeout(() => {
            setLyrics([]);
            setActiveIdx(-1);
            setLoadingLyrics(true);
            setNow(j);
            setLastTrackId(j.track.id);
            setTransitioning(false);
          }, 300);
        } else {
          setNow(j);
          setLastTrackId(j.track?.id ?? null);
        }
      } catch {
        setNow({ isPlaying: false });
      }
    }

    fetchNow();
    const id = setInterval(fetchNow, 2000);
    return () => clearInterval(id);
  }, [lastTrackId]);

  // Carrega letra sincronizada
  useEffect(() => {
    async function loadLyrics() {
      if (!now?.isPlaying || !now.track?.name) {
        setLyrics([]);
        setActiveIdx(-1);
        return;
      }

      setLoadingLyrics(true);
      if (timerRef.current) clearInterval(timerRef.current);

      const params = new URLSearchParams({
        track: now.track.name,
        artist: (now.artists || []).join(", "),
      });
      if (now.durationMs) params.set("durationMs", String(now.durationMs));

      try {
        const r = await fetch(`/api/spotify/lyrics?${params.toString()}`, { cache: "no-store" });
        const j = await r.json();
        setLyrics(j.lyrics || []);
        setActiveIdx(-1);
      } catch (e) {
        console.error("Erro ao carregar letra:", e);
        setLyrics([]);
      } finally {
        setLoadingLyrics(false);
      }
    }

    if (now?.track?.id) loadLyrics();
  }, [now?.track?.id]);

  // Sincroniza tempo da letra
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

  // Layout quando nada toca
  const center = (
    <div className="flex flex-col items-center justify-center text-center animate-fade-in">
      <h1 className="text-2xl text-white/70 mb-4">cri cri cri</h1>
    </div>
  );

  // Layout quando tocando
  const playing = (
    <div
      key={now?.track?.id}
      className={`flex flex-col items-center justify-center text-center transition-all duration-500 ${
        transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
    >
      <div className="flex items-center justify-center gap-4 mb-10">
        {now?.album?.image ? (
          <img
            src={now.album.image}
            alt="album"
            className={`w-24 h-24 rounded-xl object-cover shadow-lg transition-all duration-500 ${
              transitioning ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          />
        ) : (
          <div className="w-24 h-24 bg-white/5 rounded-xl" />
        )}
        <div className="text-left">
          <div
            className={`text-2xl font-semibold text-white transition-all duration-500 ${
              transitioning ? "opacity-0 translate-y-2" : "opacity-100"
            }`}
          >
            {now?.track?.name || "—"}
          </div>
          <div className="text-sm text-white/60 mt-1">
            {(now?.artists || []).join(", ") || "—"}
          </div>
        </div>
      </div>

      {loadingLyrics ? (
        <p className="text-white/50 italic animate-pulse">...</p>
      ) : !lyrics.length ? (
        <p className="text-white/50 italic">Não foi possível encontrar a letra da música.</p>
      ) : (
        <div className="h-[40vh] flex items-center justify-center">
          {activeIdx >= 0 && lyrics[activeIdx] ? (
            <h2
              key={lyrics[activeIdx].timeMs}
              className="text-3xl text-white font-medium tracking-wide animate-fade-lyric"
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
        .animate-fade-lyric {
          opacity: 0;
          transform: translateY(10px);
          animation: fadeInLyric 0.8s ease forwards;
        }
        @keyframes fadeInLyric {
          0% {
            opacity: 0;
            transform: translateY(10px);
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
    <main className="relative min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 select-none">
      <div
        className={`w-full max-w-3xl flex flex-col items-center justify-center mb-24 transition-all duration-500 ${
          transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        {isPlaying ? playing : center}
      </div>

      <div className="absolute bottom-10 flex flex-col items-center transition-all duration-500">
        <DiscordCard />
      </div>

      <style jsx global>{`
        body {
          background-color: #000;
          font-family: "Josefin Sans", sans-serif;
        }
        .animate-fade-in {
          opacity: 0;
          transform: translateY(8px);
          animation: fadeIn 0.8s ease forwards;
        }
        @keyframes fadeIn {
          0% {
            opacity: 0;
            transform: translateY(8px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}

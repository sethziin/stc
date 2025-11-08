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
  const [colors, setColors] = useState<[string, string]>(["#0a0a0a", "#111"]);
  const [textColor, setTextColor] = useState<string>("white");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 🎨 Extrai duas cores médias e cria contraste suave
  async function extractDominantColors(
    url: string
  ): Promise<{ colors: [string, string]; textColor: string }> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx)
          return resolve({ colors: ["#0a0a0a", "#111"], textColor: "white" });

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let r = 0, g = 0, b = 0, r2 = 0, g2 = 0, b2 = 0, count = 0;
        for (let i = 0; i < data.length; i += 8) { // amostra leve
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (avg > 128) {
            r += data[i]; g += data[i + 1]; b += data[i + 2];
          } else {
            r2 += data[i]; g2 += data[i + 1]; b2 += data[i + 2];
          }
          count++;
        }

        const c1 = `rgb(${r / count}, ${g / count}, ${b / count})`;
        const c2 = `rgb(${r2 / count}, ${g2 / count}, ${b2 / count})`;

        const lum = (0.299 * (r / count) + 0.587 * (g / count) + 0.114 * (b / count)) / 255;
        const txt = lum > 0.6 ? "black" : "white";

        resolve({ colors: [c1, c2], textColor: txt });
      };
      img.onerror = () => resolve({ colors: ["#0a0a0a", "#111"], textColor: "white" });
    });
  }

  // Atualiza cores com base na música
  useEffect(() => {
    async function fetchNow() {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await res.json();

        if (!lastTrackId && j.album?.image) {
          extractDominantColors(j.album.image).then((res) => {
            setColors(res.colors);
            setTextColor(res.textColor);
          });
        }

        if (lastTrackId && j.track?.id && j.track.id !== lastTrackId) {
          setTransitioning(true);
          setTimeout(() => {
            setLyrics([]);
            setActiveIdx(-1);
            setNow(j);
            setLastTrackId(j.track?.id ?? null);
            setTransitioning(false);
          }, 400);

          if (j.album?.image) {
            extractDominantColors(j.album.image).then((res) => {
              setColors(res.colors);
              setTextColor(res.textColor);
            });
          }
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

  // Letras sincronizadas
  useEffect(() => {
    async function loadLyrics() {
      if (!now?.isPlaying || !now.track?.name) {
        setLyrics([]); setActiveIdx(-1); return;
      }
      setLoadingLyrics(true);
      if (timerRef.current) clearInterval(timerRef.current);

      const params = new URLSearchParams({
        track: now.track.name,
        artist: (now.artists || []).join(", "),
      });
      if (now.durationMs) params.set("durationMs", String(now.durationMs));
      try {
        const r = await fetch(`/api/spotify/lyrics?${params}`, { cache: "no-store" });
        const j = await r.json();
        setLyrics(j.lyrics || []);
        setActiveIdx(-1);
      } catch { setLyrics([]); }
      finally { setLoadingLyrics(false); }
    }
    if (now?.track?.id) loadLyrics();
  }, [now?.track?.id]);

  // Sincroniza letras
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [now?.isPlaying, now?.progressMs, lyrics]);

  const isPlaying = now?.isPlaying && now?.track?.name;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-6 select-none overflow-hidden">
      {/* 🎨 Fundo suave com gradiente fluido */}
      <div
        className="absolute inset-0 -z-10 animated-bg"
        style={{
          background: `linear-gradient(120deg, ${colors[0]}, ${colors[1]})`,
        }}
      ></div>

      <div
        className={`w-full max-w-3xl flex flex-col items-center justify-center mb-24 text-center transition-all duration-700 ${
          transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
        style={{ color: textColor }}
      >
        {isPlaying ? (
          <>
            {now?.album?.image && (
              <img
                src={now.album.image}
                alt="album"
                className="w-28 h-28 rounded-2xl mb-6 shadow-xl object-cover"
              />
            )}
            <h1 className="text-2xl font-bold">{now?.track?.name}</h1>
            <p className="text-sm opacity-80 mt-1">
              {(now?.artists || []).join(", ")}
            </p>
            {loadingLyrics ? (
              <p className="italic mt-10 opacity-60">Carregando letra...</p>
            ) : lyrics.length ? (
              <h2
                key={lyrics[activeIdx]?.timeMs}
                className="text-3xl mt-16 animate-fade-lyric"
              >
                {lyrics[activeIdx]?.line || "..."}
              </h2>
            ) : (
              <p className="italic mt-16 opacity-60">
                Sem letra sincronizada
              </p>
            )}
          </>
        ) : (
          <h1 className="text-2xl opacity-70 animate-fade-in">cri cri cri</h1>
        )}
      </div>

      <div className="absolute bottom-10 flex flex-col items-center transition-all duration-700">
        <DiscordCard />
      </div>

      <style jsx global>{`
        .animated-bg {
          background-size: 200% 200%;
          animation: gradientShift 30s ease-in-out infinite alternate;
          filter: blur(30px);
          transform: scale(1.2);
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .animate-fade-lyric {
          opacity: 0;
          transform: translateY(10px);
          animation: fadeInLyric 0.8s ease forwards;
        }
        @keyframes fadeInLyric {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  );
}

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
type FullLyrics = { lyrics: string };

export default function SpotifyPage() {
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [fullLyrics, setFullLyrics] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [loadingLyrics, setLoadingLyrics] = useState<boolean>(false);
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<boolean>(false);
  const [colors, setColors] = useState<[string, string]>(["#000000", "#111111"]);
  const [textColor, setTextColor] = useState<string>("white");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 🎨 Extrai cores principais da capa
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
          return resolve({ colors: ["#000", "#111"], textColor: "white" });

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let r = 0, g = 0, b = 0, r2 = 0, g2 = 0, b2 = 0, count = 0;
        for (let i = 0; i < data.length; i += 8) {
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
      img.onerror = () => resolve({ colors: ["#000", "#111"], textColor: "white" });
    });
  }

  // 🔄 Atualiza informações e cores
  useEffect(() => {
    async function fetchNow() {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await res.json();

        if (!j?.isPlaying) {
          setNow(j);
          setColors(["#000000", "#202020"]);
          setTextColor("white");
          return;
        }

        if (!lastTrackId || j.track?.id !== lastTrackId) {
          setTransitioning(true);
          setTimeout(() => {
            setLyrics([]);
            setFullLyrics(null);
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
        }
      } catch {
        setNow({ isPlaying: false });
        setColors(["#000", "#222"]);
      }
    }

    fetchNow();
    const id = setInterval(fetchNow, 2000);
    return () => clearInterval(id);
  }, [lastTrackId]);

  // 🎼 Carrega letras
  useEffect(() => {
    async function loadLyrics() {
      if (!now?.isPlaying || !now.track?.name) {
        setLyrics([]); setFullLyrics(null); setActiveIdx(-1); return;
      }

      setLoadingLyrics(true);
      if (timerRef.current) clearInterval(timerRef.current);
      const params = new URLSearchParams({
        track: now.track.name,
        artist: (now.artists || []).join(", "),
      });
      try {
        const r = await fetch(`/api/spotify/lyrics?${params}`, { cache: "no-store" });
        const j = await r.json();

        if (j.lyrics?.length) {
          setLyrics(j.lyrics);
          setFullLyrics(null);
        } else if (j.fullLyrics) {
          setFullLyrics(j.fullLyrics);
          setLyrics([]);
        } else {
          setFullLyrics("Nenhuma letra disponível para esta faixa.");
          setLyrics([]);
        }
      } catch {
        setFullLyrics("Erro ao carregar letra.");
        setLyrics([]);
      } finally {
        setLoadingLyrics(false);
      }
    }

    if (now?.track?.id) loadLyrics();
  }, [now?.track?.id]);

  // ⏱️ Sincroniza letras
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
  const hasSyncedLyrics = !!lyrics.length;
  const hasFullLyrics = !!fullLyrics;

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden select-none">
      {/* 🌈 Fundo animado */}
      <div
        className="absolute inset-0 -z-10 animated-bg"
        style={{
          background: `linear-gradient(120deg, ${colors[0]}, ${colors[1]})`,
        }}
      ></div>

      {/* Container principal */}
      <div
        className={`flex items-center justify-center w-full max-w-5xl px-6 transition-all duration-1000 ease-in-out ${
          hasFullLyrics ? "gap-10 translate-x-[-8%]" : "translate-x-0"
        }`}
        style={{ color: textColor }}
      >
        {/* Lado esquerdo (álbum e info) */}
        <div
          className={`flex flex-col items-center text-center transition-all duration-1000 ease-in-out ${
            hasFullLyrics ? "translate-x-[-5%] opacity-90 scale-[0.95]" : "translate-x-0 opacity-100"
          }`}
        >
          {isPlaying ? (
            <>
              {now?.album?.image && (
                <img
                  src={now.album.image}
                  alt="album"
                  className="w-36 h-36 rounded-3xl mb-5 shadow-2xl object-cover transition-all duration-700 hover:scale-[1.03]"
                />
              )}
              <h1 className="text-2xl font-semibold tracking-tight mb-1">
                {now?.track?.name}
              </h1>
              <p className="text-sm opacity-80 mb-6">
                {(now?.artists || []).join(", ")}
              </p>

              {loadingLyrics ? (
                <p className="italic opacity-60 animate-pulse">Carregando letra...</p>
              ) : hasSyncedLyrics ? (
                <div className="h-[30vh] flex items-center justify-center">
                  <h2
                    key={lyrics[activeIdx]?.timeMs}
                    className="text-2xl font-medium animate-fade-lyric"
                    style={{
                      maxWidth: "80%",
                      lineHeight: "1.5",
                      textShadow:
                        textColor === "white"
                          ? "0 0 12px rgba(0,0,0,0.4)"
                          : "0 0 8px rgba(255,255,255,0.4)",
                    }}
                  >
                    {lyrics[activeIdx]?.line || "…"}
                  </h2>
                </div>
              ) : (
                <p className="italic opacity-70">Sem letra sincronizada</p>
              )}
            </>
          ) : (
            <h1 className="text-2xl opacity-70">nenhuma música tocando</h1>
          )}
        </div>

        {/* Lado direito (letra completa) */}
        {hasFullLyrics && (
          <div
            className="w-[45%] bg-white/10 backdrop-blur-md rounded-2xl p-6 text-left text-sm leading-relaxed animate-slide-in overflow-y-auto max-h-[60vh]"
            style={{
              color: textColor === "white" ? "white" : "#111",
              boxShadow: "0 0 20px rgba(0,0,0,0.2)",
            }}
          >
            <pre
              style={{
                whiteSpace: "pre-wrap",
                fontFamily: "Josefin Sans, sans-serif",
                lineHeight: "1.6",
              }}
            >
              {fullLyrics}
            </pre>
          </div>
        )}
      </div>

      <div className="absolute bottom-8 flex flex-col items-center transition-all duration-700">
        <DiscordCard />
      </div>

      <style jsx global>{`
        .animated-bg {
          background-size: 200% 200%;
          filter: blur(60px);
          animation: gradientShift 40s ease-in-out infinite alternate,
                     pulseGlow 10s ease-in-out infinite;
        }

        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes pulseGlow {
          0%, 100% { opacity: 0.9; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }

        .animate-fade-lyric {
          opacity: 0;
          transform: translateY(10px);
          animation: fadeInLyric 1s ease forwards;
        }

        @keyframes fadeInLyric {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .animate-slide-in {
          animation: slideIn 1s ease forwards;
        }

        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateX(30px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }

        body {
          background: #000;
          font-family: "Josefin Sans", sans-serif;
        }
      `}</style>
    </main>
  );
}

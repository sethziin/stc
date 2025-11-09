"use client";

import { useEffect, useRef, useState } from "react";
import DiscordCard from "./DiscordCard";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
    player: any;
  }
}

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
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [colors, setColors] = useState<[string, string]>(["#0a0a0a", "#111"]);
  const [textColor, setTextColor] = useState("white");
  const [transitioning, setTransitioning] = useState(false);
  const [ytReady, setYtReady] = useState(false);
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);

  const timerRef = useRef<number | null>(null);
  const syncRef = useRef<number | null>(null);
  const lastProgressRef = useRef(0);

  // 🎨 Extrai cores da capa
  async function extractDominantColors(url: string) {
    return new Promise<{ colors: [string, string]; textColor: string }>((resolve) => {
      const img = document.createElement("img");
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const c = document.createElement("canvas");
        const ctx = c.getContext("2d");
        if (!ctx)
          return resolve({ colors: ["#0a0a0a", "#111"], textColor: "white" });
        c.width = img.width;
        c.height = img.height;
        ctx.drawImage(img, 0, 0);
        const d = ctx.getImageData(0, 0, c.width, c.height).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < d.length; i += 16) {
          r += d[i]; g += d[i + 1]; b += d[i + 2]; count++;
        }
        const avg = (r + g + b) / (3 * count);
        const txt = avg > 128 ? "black" : "white";
        resolve({
          colors: [`rgb(${r / count}, ${g / count}, ${b / count})`, "#111"],
          textColor: txt,
        });
      };
      img.onerror = () => resolve({ colors: ["#0a0a0a", "#111"], textColor: "white" });
    });
  }

  // 🧠 Carrega player YouTube invisível
  useEffect(() => {
    if (window.YT) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      window.player = new window.YT.Player("ytplayer", {
        height: "0",
        width: "0",
        playerVars: { autoplay: 0, controls: 0, disablekb: 1 },
        events: {
          onReady: () => setYtReady(true),
        },
      });
    };
  }, []);

  // 🎧 Atualiza status do Spotify
  useEffect(() => {
    async function fetchNow() {
      try {
        const r = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await r.json();
        setNow(j);

        // Atualiza cores
        if (j.album?.image)
          extractDominantColors(j.album.image).then((res) => {
            setColors(res.colors);
            setTextColor(res.textColor);
          });

        // Controle YouTube
        if (ytReady && window.player) {
          if (j.isPlaying && j.track?.id) {
            // Se mudou de faixa → carrega novo vídeo
            if (j.track.id !== lastTrackId) {
              const query = `${j.artists?.[0] || ""} ${j.track.name}`;
              const s = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
              const { videoId } = await s.json();
              if (videoId) {
                window.player.loadVideoById(videoId);
              }
              setLastTrackId(j.track.id);
            }

            // Sincroniza tempo
            const ytT = window.player.getCurrentTime?.() ?? 0;
            const spT = (j.progressMs ?? 0) / 1000;
            if (Math.abs(spT - ytT) > 1.5) {
              window.player.seekTo(spT, true);
            }

            // Play
            window.player.playVideo();
          } else {
            // Pause
            window.player.pauseVideo();
          }
        }

        lastProgressRef.current = j.progressMs ?? 0;
      } catch (err) {
        console.warn("Erro Spotify:", err);
        setNow({ isPlaying: false });
      }
    }

    fetchNow();
    const id = window.setInterval(fetchNow, 2000);
    return () => window.clearInterval(id);
  }, [ytReady, lastTrackId]);

  // 🔁 Reajuste periódico (corrige drift)
  useEffect(() => {
    if (syncRef.current !== null) window.clearInterval(syncRef.current);
    syncRef.current = window.setInterval(() => {
      if (!now?.isPlaying || !window.player) return;
      const ytT = window.player.getCurrentTime?.() ?? 0;
      const spT = (now.progressMs ?? 0) / 1000;
      if (Math.abs(spT - ytT) > 2) window.player.seekTo(spT, true);
    }, 5000);

    return () => {
      if (syncRef.current !== null) window.clearInterval(syncRef.current);
    };
  }, [now?.isPlaying]);

  // 🧾 Letras
  useEffect(() => {
    async function loadLyrics() {
      if (!now?.isPlaying || !now.track?.name) return;
      setLoadingLyrics(true);
      const params = new URLSearchParams({
        track: now.track.name,
        artist: (now.artists || []).join(", "),
      });
      try {
        const r = await fetch(`/api/spotify/lyrics?${params}`, { cache: "no-store" });
        const j = await r.json();
        setLyrics(j.lyrics || []);
      } catch {
        setLyrics([]);
      } finally {
        setLoadingLyrics(false);
      }
    }
    if (now?.track?.id) loadLyrics();
  }, [now?.track?.id]);

  // ⏱️ Letras sincronizadas
  useEffect(() => {
    if (!now?.isPlaying || !lyrics.length) {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
      setActiveIdx(-1);
      return;
    }
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = window.setInterval(() => {
      const t = now.progressMs ?? 0;
      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].timeMs <= t) idx = i;
        else break;
      }
      setActiveIdx(idx);
    }, 500);
    return () => {
      if (timerRef.current !== null) window.clearInterval(timerRef.current);
    };
  }, [now?.isPlaying, now?.progressMs, lyrics]);

  const isPlaying = now?.isPlaying && now?.track?.name;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden select-none">
      {/* Fundo */}
      <div
        className="absolute inset-0 -z-10 animated-bg transition-all duration-[3000ms]"
        style={{
          background: `linear-gradient(120deg, ${colors[0]}, ${colors[1]})`,
          transition: "background 3s ease-in-out",
        }}
      ></div>

      {/* Player YouTube invisível */}
      <div id="ytplayer" />

      {/* Conteúdo */}
      <div
        className={`w-full max-w-3xl text-center px-4 transition-all duration-700 ${
          transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
        style={{ color: textColor }}
      >
        {isPlaying ? (
          <>
            <div className="flex flex-col items-center mb-8">
              {now?.album?.image && (
                <img
                  src={now.album.image}
                  alt="album"
                  className="w-40 h-40 rounded-3xl shadow-2xl object-cover mb-6"
                />
              )}
              <h1 className="text-3xl font-semibold mb-1">{now?.track?.name}</h1>
              <p className="text-base opacity-80">{(now?.artists || []).join(", ")}</p>
            </div>

            {loadingLyrics ? (
              <p className="italic opacity-60 animate-pulse mt-10">Carregando letra...</p>
            ) : lyrics.length ? (
              <div className="h-[35vh] flex items-center justify-center">
                <h2
                  key={lyrics[activeIdx]?.timeMs}
                  className="text-2xl font-medium animate-fade-lyric"
                  style={{
                    maxWidth: "80%",
                    lineHeight: "1.5",
                    textShadow:
                      textColor === "white" ? "0 0 10px rgba(0,0,0,0.5)" : "none",
                  }}
                >
                  {lyrics[activeIdx]?.line || "…"}
                </h2>
              </div>
            ) : (
              <p className="italic opacity-60 mt-16">Sem letra sincronizada</p>
            )}
          </>
        ) : (
          <h1 className="text-2xl opacity-70 animate-fade-in">cri cri cri</h1>
        )}
      </div>

      <div className="absolute bottom-8 flex flex-col items-center">
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
          0%,100% { opacity: 0.9; transform: scale(1); }
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
      `}</style>
    </main>
  );
}

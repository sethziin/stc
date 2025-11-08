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
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [loadingLyrics, setLoadingLyrics] = useState<boolean>(false);
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState<boolean>(false);
  const [colors, setColors] = useState<[string, string]>(["#0a0a0a", "#111"]);
  const [textColor, setTextColor] = useState<string>("white");
  const [volume, setVolume] = useState<number>(40);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 🎨 Extrai cores da capa
  async function extractDominantColors(url: string) {
    return new Promise<{ colors: [string, string]; textColor: string }>(
      (resolve) => {
        const img = document.createElement("img");
        img.crossOrigin = "Anonymous";
        img.src = url;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          if (!ctx)
            return resolve({
              colors: ["#0a0a0a", "#111"],
              textColor: "white",
            });

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

          let r = 0,
            g = 0,
            b = 0,
            count = 0;
          for (let i = 0; i < data.length; i += 16) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
            count++;
          }
          const avg = (r + g + b) / (3 * count);
          const txt = avg > 128 ? "black" : "white";
          resolve({
            colors: [
              `rgb(${r / count}, ${g / count}, ${b / count})`,
              "#111",
            ],
            textColor: txt,
          });
        };
        img.onerror = () =>
          resolve({ colors: ["#0a0a0a", "#111"], textColor: "white" });
      }
    );
  }

  // 🟢 Atualiza status do Spotify
  useEffect(() => {
    async function fetchNow() {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await res.json();

        setNow(j);

        // Atualiza cores
        if (j.album?.image) {
          extractDominantColors(j.album.image).then((res) => {
            setColors(res.colors);
            setTextColor(res.textColor);
          });
        }

        // Se for a primeira vez ou a mesma música após reload, garante que toque
        const shouldPlay =
          j.isPlaying &&
          j.track?.id &&
          (
            !window.player ||
            !window.player.getVideoData ||
            !window.player.getVideoData()?.video_id
          );

        if (shouldPlay) {
          playYouTube(j);
        }

        // Mudança de faixa
        if (lastTrackId && j.track?.id && j.track.id !== lastTrackId) {
          setTransitioning(true);
          setTimeout(() => {
            setLyrics([]);
            setActiveIdx(-1);
            setNow(j);
            setLastTrackId(j.track?.id ?? null);
            setTransitioning(false);
          }, 400);
          playYouTube(j);
        }

        setLastTrackId(j.track?.id ?? null);

        // Se o Spotify estiver pausado → pausa o player
        if (window.player && j.isPlaying === false) {
          const state = window.player.getPlayerState?.();
          if (state === 1) window.player.pauseVideo();
        }
      } catch (err) {
        console.error("Spotify fetch error:", err);
      }
    }

    fetchNow();
    const id = setInterval(fetchNow, 2000);
    return () => clearInterval(id);
  }, [lastTrackId]);

  // 🎼 Carrega letras
  useEffect(() => {
    async function loadLyrics() {
      if (!now?.isPlaying || !now.track?.name) return;
      setLoadingLyrics(true);
      const params = new URLSearchParams({
        track: now.track.name,
        artist: (now.artists || []).join(", "),
      });
      const r = await fetch(`/api/spotify/lyrics?${params}`);
      const j = await r.json();
      setLyrics(j.lyrics || []);
      setActiveIdx(-1);
      setLoadingLyrics(false);
    }
    if (now?.track?.id) loadLyrics();
  }, [now?.track?.id]);

  // ⏱️ Sincroniza letras
  useEffect(() => {
    if (!now?.isPlaying || !lyrics.length) return;
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
  }, [now?.isPlaying, lyrics]);

  // 🎬 Inicializa YouTube Player
  useEffect(() => {
    if (window.YT) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      window.player = new window.YT.Player("ytplayer", {
        height: "0",
        width: "0",
        videoId: "",
        playerVars: { autoplay: 0 },
        events: {
          onReady: () => window.player.setVolume(volume),
        },
      });
    };
  }, []);

  // 🔊 Toca vídeo no YouTube
  async function playYouTube(j: NowPlaying) {
    if (!j.track?.name) return;
    const query = `${j.artists?.[0] || ""} ${j.track?.name}`;
    const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
    const { videoId } = await res.json();
    if (!videoId || !window.player) return;

    window.player.loadVideoById(videoId);
    setTimeout(() => {
      window.player.seekTo((j.progressMs ?? 0) / 1000, true);
      window.player.setVolume(volume);
      window.player.playVideo();
    }, 1200);
  }

  // 🔁 Sincroniza a cada 5s
  useEffect(() => {
    const sync = setInterval(() => {
      if (!now?.isPlaying || !window.player) return;
      const ytTime = window.player.getCurrentTime?.() || 0;
      const spotifyTime = (now.progressMs ?? 0) / 1000;
      const diff = spotifyTime - ytTime;
      if (Math.abs(diff) > 1.5) window.player.seekTo(spotifyTime, true);
    }, 5000);
    return () => clearInterval(sync);
  }, [now?.progressMs]);

  // 🔉 Volume
  useEffect(() => {
    if (window.player) window.player.setVolume(volume);
  }, [volume]);

  const isPlaying = now?.isPlaying && now?.track?.name;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden select-none">
      <div
        className="absolute inset-0 -z-10 animated-bg"
        style={{
          background: `linear-gradient(120deg, ${colors[0]}, ${colors[1]})`,
          transition: "background 3s ease-in-out",
        }}
      ></div>

      <div id="ytplayer" />

      <div
        className={`w-full max-w-3xl text-center px-4 transition-all duration-700 ${
          transitioning
            ? "opacity-0 translate-y-2"
            : "opacity-100 translate-y-0"
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
                  className="w-40 h-40 rounded-3xl shadow-2xl object-cover mb-6 transition-all duration-700 hover:scale-[1.02]"
                />
              )}
              <h1 className="text-3xl font-semibold mb-1">{now?.track?.name}</h1>
              <p className="text-base opacity-80">
                {(now?.artists || []).join(", ")}
              </p>
            </div>

            {loadingLyrics ? (
              <p className="italic text-lg opacity-60 animate-pulse mt-10">
                Carregando letra...
              </p>
            ) : lyrics.length ? (
              <div className="h-[35vh] flex items-center justify-center">
                <h2
                  key={lyrics[activeIdx]?.timeMs}
                  className="text-2xl font-medium animate-fade-lyric"
                  style={{
                    maxWidth: "80%",
                    lineHeight: "1.5",
                    textShadow:
                      textColor === "white"
                        ? "0 0 10px rgba(0,0,0,0.5)"
                        : "none",
                  }}
                >
                  {lyrics[activeIdx]?.line || "…"}
                </h2>
              </div>
            ) : (
              <p className="italic opacity-60 mt-16">
                Sem letra sincronizada
              </p>
            )}
          </>
        ) : (
          <h1 className="text-2xl opacity-70 animate-fade-in">cri cri cri</h1>
        )}
      </div>

      <div className="absolute bottom-8 flex flex-col items-center transition-all duration-700">
        <label className="mb-1 opacity-70 text-sm">Volume: {volume}%</label>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-60 accent-white"
        />
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
      `}</style>
    </main>
  );
}

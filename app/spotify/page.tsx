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
  const [clientReady, setClientReady] = useState(false);
  useEffect(() => setClientReady(true), []);

  const [now, setNow] = useState<NowPlaying | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [colors, setColors] = useState<[string, string]>(["#0a0a0a", "#111"]);
  const [textColor, setTextColor] = useState("white");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const playerRef = useRef<any>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // extrai cor da capa
  async function extractColors(url: string) {
    try {
      const img = document.createElement("img");
      img.crossOrigin = "Anonymous";
      img.src = url;
      await img.decode();
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let r = 0, g = 0, b = 0, count = 0;
      for (let i = 0; i < data.length; i += 4) {
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        count++;
      }
      const avg = `rgb(${r / count},${g / count},${b / count})`;
      setColors([avg, "#000"]);
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / (count * 255);
      setTextColor(lum > 0.6 ? "black" : "white");
    } catch {}
  }

  // atualiza spotify
  useEffect(() => {
    async function fetchNow() {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await res.json();
        if (j.track?.id && j.track.id !== lastTrackId) {
          setNow(j);
          setLastTrackId(j.track.id);
          if (j.album?.image) extractColors(j.album.image);
          const query = `${j.track.name} ${j.artists?.[0] ?? ""}`;
          const r = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
          const data = await r.json();
          setVideoId(data.videoId || null);
        } else setNow(j);
      } catch {
        setNow({ isPlaying: false });
      }
    }
    fetchNow();
    const id = setInterval(fetchNow, 2000);
    return () => clearInterval(id);
  }, [lastTrackId]);

  // letras
  useEffect(() => {
    async function loadLyrics() {
      if (!now?.track?.name) return;
      setLoadingLyrics(true);
      const params = new URLSearchParams({
        track: now.track.name,
        artist: (now.artists || []).join(", "),
      });
      const r = await fetch(`/api/spotify/lyrics?${params}`, { cache: "no-store" });
      const j = await r.json();
      setLyrics(j.lyrics || []);
      setLoadingLyrics(false);
    }
    if (now?.track?.id) loadLyrics();
  }, [now?.track?.id]);

  // sincroniza letras
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
  }, [now?.isPlaying, now?.progressMs, lyrics]);

  // cria player no clique
  const handleUnlock = () => {
    setUnlocked(true);
    if (!videoId) return;
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
    (window as any).onYouTubeIframeAPIReady = () => {
      playerRef.current = new (window as any).YT.Player("yt-player", {
        height: "0",
        width: "0",
        playerVars: { autoplay: 1, controls: 0, disablekb: 1, playsinline: 1 },
        events: {
          onReady: (e: any) => {
            e.target.setVolume(100);
            e.target.playVideo();
          },
        },
      });
    };
  };

  // sincroniza youtube
  useEffect(() => {
    if (!playerRef.current || !videoId || !unlocked) return;
    playerRef.current.loadVideoById(videoId);
    setTimeout(() => {
      const s = (now?.progressMs || 0) / 1000;
      playerRef.current.seekTo(s, true);
      if (now?.isPlaying) playerRef.current.playVideo();
      else playerRef.current.pauseVideo();
    }, 800);
  }, [videoId, now?.isPlaying, unlocked]);

  const isPlaying = now?.isPlaying && now?.track?.name;

  // evita render antes do cliente estar pronto
  if (!clientReady) return <main />;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden select-none">
      <div id="yt-player" style={{ display: "none" }} />
      <div
        className="absolute inset-0 -z-10 animated-bg transition-all duration-[3000ms]"
        style={{
          background: `linear-gradient(120deg, ${colors[0]}, ${colors[1]})`,
        }}
      ></div>

      {!unlocked && (
        <div
          onClick={handleUnlock}
          className="absolute inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/60 text-white text-xl cursor-pointer transition-opacity duration-700"
        >
          <span className="animate-pulse text-2xl font-semibold tracking-wide">
            clique para ativar o som
          </span>
        </div>
      )}

      <div
        className="w-full max-w-3xl text-center px-4 transition-all duration-700"
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
              <h1 className="text-3xl font-semibold tracking-tight drop-shadow-sm mb-1">
                {now?.track?.name}
              </h1>
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
              <p className="italic opacity-60 mt-16">Sem letra sincronizada</p>
            )}
          </>
        ) : (
          <h1 className="text-2xl opacity-70 animate-fade-in">cri cri cri</h1>
        )}
      </div>

      <div className="absolute bottom-8 flex flex-col items-center transition-all duration-700">
        <DiscordCard />
      </div>
    </main>
  );
}

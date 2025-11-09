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
  const [loadingLyrics, setLoadingLyrics] = useState(false);
  const [lastTrackId, setLastTrackId] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [colors, setColors] = useState<[string, string]>(["#0a0a0a", "#111"]);
  const [textColor, setTextColor] = useState("white");
  const [videoId, setVideoId] = useState<string | null>(null);
  const [unlocked, setUnlocked] = useState(false);

  const playerRef = useRef<any>(null);
  const ytReadyPromiseRef = useRef<Promise<void> | null>(null);
  const ytReadyResolveRef = useRef<(() => void) | null>(null);
  const lyricsTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastRealignRef = useRef<number>(0);

  // ---------- extrai cores ----------
  async function extractDominantColors(url: string): Promise<{ colors: [string, string]; textColor: string }> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve({ colors: ["#0a0a0a", "#111"], textColor: "white" });
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let r=0,g=0,b=0,r2=0,g2=0,b2=0,count=0;
        for (let i=0;i<data.length;i+=8) {
          const avg=(data[i]+data[i+1]+data[i+2])/3;
          if (avg>128){ r+=data[i]; g+=data[i+1]; b+=data[i+2]; }
          else { r2+=data[i]; g2+=data[i+1]; b2+=data[i+2]; }
          count++;
        }
        const c1=`rgb(${r/count}, ${g/count}, ${b/count})`;
        const c2=`rgb(${r2/count}, ${g2/count}, ${b2/count})`;
        const lum=(0.299*(r/count)+0.587*(g/count)+0.114*(b/count))/255;
        resolve({ colors:[c1,c2], textColor: lum>0.6 ? "black":"white" });
      };
      img.onerror = () => resolve({ colors: ["#0a0a0a", "#111"], textColor: "white" });
    });
  }

  // ---------- Spotify polling ----------
  useEffect(() => {
    async function fetchNow() {
      try {
        const res = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await res.json();

        if (j.track?.id && j.track.id !== lastTrackId) {
          console.log("[SPOTIFY] nova faixa:", j.track?.name, "–", (j.artists||[]).join(", "));
          setTransitioning(true);
          setTimeout(() => { setNow(j); setLastTrackId(j.track?.id ?? null); setTransitioning(false); }, 250);

          if (j.album?.image)
            extractDominantColors(j.album.image).then(({colors,textColor}) => { setColors(colors); setTextColor(textColor); });

          const query = `${j.track?.name} ${j.artists?.[0] || ""}`;
          const r = await fetch(`/api/youtube/search?q=${encodeURIComponent(query)}`);
          const data = await r.json();
          console.log("[YOUTUBE] videoId:", data.videoId);
          setVideoId(data.videoId || null);
        } else {
          setNow(j);
          setLastTrackId(j.track?.id ?? null);
        }
      } catch (e) {
        console.warn("[SPOTIFY] erro:", e);
        setNow({ isPlaying: false });
      }
    }

    fetchNow();
    const id = setInterval(fetchNow, 2000);
    return () => clearInterval(id);
  }, [lastTrackId]);

  // ---------- Letras ----------
  useEffect(() => {
    async function loadLyrics() {
      if (!now?.track?.name) { setLyrics([]); setActiveIdx(-1); return; }
      setLoadingLyrics(true);
      if (lyricsTimerRef.current) clearInterval(lyricsTimerRef.current);
      const params = new URLSearchParams({ track: now.track.name, artist: (now.artists||[]).join(", ") });
      if (now.durationMs) params.set("durationMs", String(now.durationMs));
      try {
        const r = await fetch(`/api/spotify/lyrics?${params}`, { cache: "no-store" });
        const j = await r.json();
        setLyrics(j.lyrics || []); setActiveIdx(-1);
      } catch { setLyrics([]); }
      finally { setLoadingLyrics(false); }
    }
    if (now?.track?.id) loadLyrics();
  }, [now?.track?.id]);

  useEffect(() => {
    if (!now?.isPlaying || !lyrics.length) {
      if (lyricsTimerRef.current) clearInterval(lyricsTimerRef.current);
      setActiveIdx(-1);
      return;
    }
    if (lyricsTimerRef.current) clearInterval(lyricsTimerRef.current);
    lyricsTimerRef.current = setInterval(() => {
      const t = now.progressMs ?? 0;
      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) {
        if (lyrics[i].timeMs <= t) idx = i; else break;
      }
      setActiveIdx(idx);
    }, 500);
    return () => { if (lyricsTimerRef.current) clearInterval(lyricsTimerRef.current); };
  }, [now?.isPlaying, now?.progressMs, lyrics]);

  // ---------- Reajuste com cooldown ----------
  function realignPlayer(force = false) {
    const player = playerRef.current;
    if (!player || typeof player.getCurrentTime !== "function") return;

    const nowTs = Date.now();
    // cooldown de 5s entre realinhamentos
    if (!force && nowTs - lastRealignRef.current < 5000) return;

    const target = (now?.progressMs || 0) / 1000;
    const current = player.getCurrentTime?.() || 0;
    const drift = Math.abs(target - current);

    if (typeof player.seekTo === "function" && (drift > 2.0 || force)) {
      console.log(`[YOUTUBE] realinhando (${drift.toFixed(2)}s)`);
      player.seekTo(target, true);
      lastRealignRef.current = nowTs;
    }

    if (now?.isPlaying && typeof player.playVideo === "function") player.playVideo();
    else if (!now?.isPlaying && typeof player.pauseVideo === "function") player.pauseVideo();
  }

  // ---------- Clique inicial ----------
  async function handleUnlock() {
    setUnlocked(true);

    if (!ytReadyPromiseRef.current) {
      ytReadyPromiseRef.current = new Promise<void>((resolve) => { ytReadyResolveRef.current = resolve; });
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
      (window as any).onYouTubeIframeAPIReady = () => {
        console.log("[YOUTUBE] API pronta");
        playerRef.current = new (window as any).YT.Player("yt-player", {
          height: "0",
          width: "0",
          playerVars: {
            autoplay: 1,
            controls: 0,
            disablekb: 1,
            playsinline: 1,
          },
          events: {
            onReady: (ev: any) => { 
              console.log("[YOUTUBE] player ready");
              ev.target.setVolume(100);
              ytReadyResolveRef.current?.();
            },
          },
        });
      };
    }

    await ytReadyPromiseRef.current;

    // primeira carga
    if (videoId && playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(videoId);
      await new Promise((r) => setTimeout(r, 800));
      realignPlayer(true);
    }
  }

  // ---------- Sincroniza quando há eventos ----------
  useEffect(() => {
    if (!unlocked || !playerRef.current || !videoId) return;
    console.log("[YOUTUBE] nova faixa -> load e realinha");
    playerRef.current.loadVideoById(videoId);
    setTimeout(() => realignPlayer(true), 1000);
  }, [videoId]);

  useEffect(() => {
    if (!unlocked || !playerRef.current) return;
    console.log("[SYNC] Estado mudou:", now?.isPlaying ? "▶️ play" : "⏸ pause");
    realignPlayer(true);
  }, [now?.isPlaying]);

  useEffect(() => {
    if (!unlocked || !playerRef.current) return;
    realignPlayer();
  }, [now?.progressMs]);

  // limpeza
  useEffect(() => {
    return () => {
      if (lyricsTimerRef.current) clearInterval(lyricsTimerRef.current);
    };
  }, []);

  const isPlaying = now?.isPlaying && now?.track?.name;

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden select-none">
      <div id="yt-player" style={{ display: "none" }} />

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
        className="absolute inset-0 -z-10 animated-bg transition-all duration-[3000ms]"
        style={{ background: `linear-gradient(120deg, ${colors[0]}, ${colors[1]})`, transition: "background 3s ease-in-out" }}
      />

      <div className={`w-full max-w-3xl text-center px-4 transition-all duration-700 ${transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`} style={{ color: textColor }}>
        {isPlaying ? (
          <>
            <div className="flex flex-col items-center mb-8">
              {now?.album?.image && (
                <img src={now.album.image!} alt="album" className="w-40 h-40 rounded-3xl shadow-2xl object-cover mb-6 transition-all duration-700 hover:scale-[1.02]" />
              )}
              <h1 className="text-3xl font-semibold tracking-tight drop-shadow-sm mb-1">{now?.track?.name}</h1>
              <p className="text-base opacity-80">{(now?.artists || []).join(", ")}</p>
            </div>

            {loadingLyrics ? (
              <p className="italic text-lg opacity-60 animate-pulse mt-10">Carregando letra...</p>
            ) : lyrics.length ? (
              <div className="h-[35vh] flex items-center justify-center">
                <h2
                  key={lyrics[activeIdx]?.timeMs}
                  className="text-2xl font-medium animate-fade-lyric"
                  style={{ maxWidth: "80%", lineHeight: "1.5", textShadow: textColor === "white" ? "0 0 10px rgba(0,0,0,0.5)" : "none" }}
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

      <style jsx global>{`
        .animated-bg{background-size:200% 200%;filter:blur(60px);animation:gradientShift 40s ease-in-out infinite alternate,pulseGlow 10s ease-in-out infinite;transition:background 3s ease-in-out;}
        @keyframes gradientShift{0%{background-position:0% 50%;}50%{background-position:100% 50%;}100%{background-position:0% 50%;}}
        @keyframes pulseGlow{0%,100%{opacity:.9;transform:scale(1);}50%{opacity:1;transform:scale(1.05);} }
        .animate-fade-lyric{opacity:0;transform:translateY(10px);animation:fadeInLyric 1s ease forwards;}
        @keyframes fadeInLyric{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);} }
        body{background:#000;font-family:"Josefin Sans",sans-serif;}
      `}</style>
    </main>
  );
}

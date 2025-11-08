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
  const [bgGradient, setBgGradient] = useState<string>(
    "radial-gradient(circle at 20% 20%, #000000, #000000)"
  );
  const [textColor, setTextColor] = useState<string>("white");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 🔹 Extrai duas cores principais + define contraste automático
  async function extractDominantGradient(
    url: string
  ): Promise<{ gradient: string; textColor: string }> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      img.crossOrigin = "Anonymous";
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx)
          return resolve({
            gradient: "radial-gradient(circle, #000, #000)",
            textColor: "white",
          });

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

        let r = 0,
          g = 0,
          b = 0,
          r2 = 0,
          g2 = 0,
          b2 = 0,
          count = 0;

        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          if (avg > 128) {
            r += data[i];
            g += data[i + 1];
            b += data[i + 2];
          } else {
            r2 += data[i];
            g2 += data[i + 1];
            b2 += data[i + 2];
          }
          count++;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);
        r2 = Math.floor(r2 / count);
        g2 = Math.floor(g2 / count);
        b2 = Math.floor(b2 / count);

        const bright = `rgb(${r},${g},${b})`;
        const dark = `rgb(${r2},${g2},${b2})`;

        // calcula luminância e escolhe a cor do texto
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const contrastText = luminance > 0.6 ? "black" : "white";

        resolve({
          gradient: `radial-gradient(circle at 20% 20%, ${bright}, ${dark})`,
          textColor: contrastText,
        });
      };
      img.onerror = () =>
        resolve({
          gradient: "radial-gradient(circle, #000, #000)",
          textColor: "white",
        });
    });
  }

  // 🔹 Atualiza o estado da faixa atual
  useEffect(() => {
    async function fetchNow() {
      try {
        const r = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await r.json();

        if (lastTrackId && j.track?.id && j.track.id !== lastTrackId) {
          setTransitioning(true);
          setTimeout(() => {
            setLyrics([]);
            setActiveIdx(-1);
            setLoadingLyrics(true);
            setNow(j);
            setLastTrackId(j.track?.id ?? null);
            setTransitioning(false);
          }, 400);

          if (j.album?.image) {
            extractDominantGradient(j.album.image).then((res) => {
              setBgGradient(res.gradient);
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

  // 🔹 Carrega letra
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
        const r = await fetch(
          `/api/spotify/lyrics?${params.toString()}`,
          { cache: "no-store" }
        );
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

  // 🔹 Sincroniza letra com tempo
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

  const isPlaying = now?.isPlaying && now?.track?.name;

  const playing = (
    <div
      key={now?.track?.id}
      className={`flex flex-col items-center justify-center text-center transition-all duration-700 ${
        transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
      style={{ color: textColor, transition: "color 0.8s ease" }}
    >
      <div className="flex items-center justify-center gap-4 mb-10">
        {now?.album?.image ? (
          <img
            src={now.album.image}
            alt="album"
            className={`w-28 h-28 rounded-2xl object-cover shadow-xl transition-all duration-700 ${
              transitioning ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          />
        ) : (
          <div className="w-28 h-28 bg-white/5 rounded-xl" />
        )}
        <div className="text-left">
          <div
            className={`text-2xl font-semibold transition-all duration-700 ${
              transitioning ? "opacity-0 translate-y-2" : "opacity-100"
            }`}
          >
            {now?.track?.name || "—"}
          </div>
          <div className="text-sm opacity-70 mt-1">
            {(now?.artists || []).join(", ") || "—"}
          </div>
        </div>
      </div>

      {loadingLyrics ? (
        <p className="italic animate-pulse opacity-70">Carregando letra...</p>
      ) : !lyrics.length ? (
        <p className="italic opacity-50">Sem letra sincronizada para esta faixa.</p>
      ) : (
        <div className="h-[40vh] flex items-center justify-center">
          {activeIdx >= 0 && lyrics[activeIdx] ? (
            <h2
              key={lyrics[activeIdx].timeMs}
              className="text-3xl font-medium tracking-wide animate-fade-lyric"
              style={{
                fontFamily: "Josefin Sans, sans-serif",
                maxWidth: "80%",
                lineHeight: "1.6",
              }}
            >
              {lyrics[activeIdx].line}
            </h2>
          ) : (
            <h2 className="text-xl opacity-40 italic">...</h2>
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

  return (
    <main
      className="relative min-h-screen flex flex-col items-center justify-center p-6 select-none transition-all duration-1000"
      style={{
        background: bgGradient,
        color: textColor,
        transition: "background 1s ease, color 0.8s ease",
      }}
    >
      <div
        className={`w-full max-w-3xl flex flex-col items-center justify-center mb-24 transition-all duration-700 ${
          transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        {isPlaying ? (
          playing
        ) : (
          <h1 className="text-2xl opacity-70 animate-fade-in">cri cri cri</h1>
        )}
      </div>

      <div className="absolute bottom-10 flex flex-col items-center transition-all duration-700">
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

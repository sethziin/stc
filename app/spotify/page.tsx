"use client";
import { useEffect, useRef, useState } from "react";
import DiscordCard from "./DiscordCard";

type NowPlaying = {
  isPlaying: boolean;
  track?: { id?: string; name?: string };
  artists?: string[];
  album?: { name?: string; image?: string | null };
  colors?: string[];
  isDark?: boolean;
};

type LyricLine = { timeMs: number; line: string };

export default function Page() {
  const [now, setNow] = useState<NowPlaying | null>(null);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(-1);
  const [bgGradient, setBgGradient] = useState("radial-gradient(circle, #000, #000)");
  const [isDark, setIsDark] = useState(true);
  const [transitioning, setTransitioning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 🔁 atualiza faixa e gradiente
  useEffect(() => {
    async function fetchNow() {
      try {
        const r = await fetch("/api/spotify/now-playing", { cache: "no-store" });
        const j: NowPlaying = await r.json();
        setNow(j);

        if (j?.colors) {
          const grad = `radial-gradient(circle at 20% 20%, ${j.colors[0]}, ${j.colors[1] || "#000"})`;
          setBgGradient(grad);
          setIsDark(j.isDark ?? true);
        }
      } catch {
        setNow({ isPlaying: false });
      }
    }

    fetchNow();
    const id = setInterval(fetchNow, 3000);
    return () => clearInterval(id);
  }, []);

  // 🔹 sincroniza letras (mantém seu sistema atual)
  useEffect(() => {
    if (!now?.isPlaying) return;
    // ...
  }, [now?.track?.id]);

  const isPlaying = now?.isPlaying && now?.track?.name;
  const textColor = isDark ? "text-white" : "text-black";

  const playing = (
    <div
      key={now?.track?.id}
      className={`flex flex-col items-center justify-center text-center transition-all duration-700 ${
        transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      }`}
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
            className={`text-2xl font-semibold ${textColor} transition-all duration-700 ${
              transitioning ? "opacity-0 translate-y-2" : "opacity-100"
            }`}
          >
            {now?.track?.name || "—"}
          </div>
          <div className={`text-sm ${isDark ? "text-white/70" : "text-black/70"} mt-1`}>
            {(now?.artists || []).join(", ") || "—"}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <main
      className={`relative min-h-screen flex flex-col items-center justify-center p-6 select-none transition-all duration-1000 ${
        isDark ? "text-white" : "text-black"
      }`}
      style={{
        background: bgGradient,
        transition: "background 2s ease",
      }}
    >
      <div
        className={`w-full max-w-3xl flex flex-col items-center justify-center mb-24 transition-all duration-700 ${
          transitioning ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
        }`}
      >
        {isPlaying ? playing : (
          <h1 className={`text-2xl ${isDark ? "text-white/70" : "text-black/70"} animate-fade-in`}>
            cri cri cri
          </h1>
        )}
      </div>

      <div className="absolute bottom-10 flex flex-col items-center transition-all duration-700">
        <DiscordCard />
      </div>

      <style jsx global>{`
        body {
          font-family: "Josefin Sans", sans-serif;
          transition: background 2s ease;
        }
      `}</style>
    </main>
  );
}

import { NextResponse } from "next/server";

function parseTimedLyrics(data: any) {
  if (!data?.syncedLyrics) return null;

  // Cada linha vem no formato: [mm:ss.xx] letra
  const lines = data.syncedLyrics
    .split("\n")
    .map((raw: string) => {
      const match = raw.match(/\[(\d+):(\d+\.\d+)\](.*)/);
      if (!match) return null;
      const [, min, sec, text] = match;
      const timeMs = Math.floor((parseInt(min) * 60 + parseFloat(sec)) * 1000);
      return { timeMs, line: text.trim() };
    })
    .filter((l) => l && l.line.length > 0);

  return lines;
}

function parsePlainLyrics(text: string, durationMs = 180000) {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const step = Math.max(800, durationMs / Math.max(rawLines.length, 1));
  return rawLines.map((line, i) => ({
    timeMs: i * step,
    line,
  }));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track");
  const artist = searchParams.get("artist");
  const durationMs = Number(searchParams.get("durationMs") || 180000);

  if (!track) {
    return NextResponse.json({ lyrics: [] });
  }

  try {
    // 🎵 1️⃣ busca letras sincronizadas do LRCLIB
    const lrclib = await fetch(
      `https://lrclib.net/api/get?track_name=${encodeURIComponent(
        track
      )}&artist_name=${encodeURIComponent(artist || "")}`,
      { cache: "no-store" }
    );

    if (lrclib.ok) {
      const data = await lrclib.json();

      // tenta sincronizada primeiro
      const synced = parseTimedLyrics(data);
      if (synced && synced.length > 0) {
        return NextResponse.json({ lyrics: synced });
      }

      // tenta fallback textual (plainLyrics)
      if (data.plainLyrics) {
        const plain = parsePlainLyrics(data.plainLyrics, durationMs);
        if (plain.length > 0) return NextResponse.json({ lyrics: plain });
      }
    }

    // 🎵 2️⃣ fallback: lyrics.ovh (texto puro)
    const ovh = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist || "")}/${encodeURIComponent(
        track
      )}`,
      { cache: "no-store" }
    );
    if (ovh.ok) {
      const j = await ovh.json();
      if (j?.lyrics) {
        const lines = parsePlainLyrics(j.lyrics, durationMs);
        return NextResponse.json({ lyrics: lines });
      }
    }

    return NextResponse.json({ lyrics: [] });
  } catch (err) {
    console.error("Lyrics fetch error:", err);
    return NextResponse.json({ lyrics: [] });
  }
}

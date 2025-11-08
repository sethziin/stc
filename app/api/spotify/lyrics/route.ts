import { NextResponse } from "next/server";

type LyricLine = { timeMs: number; line: string };

const cache = new Map<string, LyricLine[]>();

function parseTimedLyrics(data: any): LyricLine[] | null {
  const raw = data?.syncedLyrics || data?.syncedLyricsText;
  if (!raw) return null;

  const lines = raw
    .split("\n")
    .map((rawLine: string): LyricLine | null => {
      const match = rawLine.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (!match) return null;
      const [, min, sec, text] = match;
      const timeMs = Math.floor((parseInt(min) * 60 + parseFloat(sec)) * 1000);
      const line = text.trim();
      return line ? { timeMs, line } : null;
    })
    .filter((l: LyricLine | null): l is LyricLine => !!l && l.line.length > 0);

  return lines.length > 0 ? lines : null;
}

function parsePlainLyrics(text: string, durationMs = 180000): LyricLine[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((l: string) => l.trim())
    .filter((l: string) => l.length > 0);

  const step = Math.max(800, durationMs / Math.max(rawLines.length, 1));
  return rawLines.map((line: string, i: number) => ({
    timeMs: i * step,
    line,
  }));
}

async function fetchWithTimeout(url: string, ms = 4000): Promise<Response> {
  return Promise.race([
    fetch(url, { cache: "no-store" }),
    new Promise<Response>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), ms)
    ),
  ]) as Promise<Response>;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track") || "";
  const artist = searchParams.get("artist") || "";
  const durationMs = Number(searchParams.get("durationMs") || 180000);

  if (!track.trim()) {
    return NextResponse.json({ lyrics: [] });
  }

  const cacheKey = `${artist.toLowerCase()}_${track.toLowerCase()}`;
  if (cache.has(cacheKey)) {
    return NextResponse.json({ lyrics: cache.get(cacheKey) });
  }

  try {
    // 1️⃣ LRCLIB com retry rápido
    const lrclibUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(
      track
    )}&artist_name=${encodeURIComponent(artist)}`;
    let data: any | null = null;

    try {
      const lrclib = await fetchWithTimeout(lrclibUrl);
      if (lrclib.ok) data = await lrclib.json();
    } catch {
      // tenta uma segunda vez se falhar por timeout
      try {
        const retry = await fetchWithTimeout(lrclibUrl, 6000);
        if (retry.ok) data = await retry.json();
      } catch {
        data = null;
      }
    }

    if (data) {
      // tenta sincronizada
      const synced = parseTimedLyrics(data);
      if (synced && synced.length > 0) {
        cache.set(cacheKey, synced);
        return NextResponse.json({ lyrics: synced });
      }

      // tenta plainLyrics (fallback)
      const rawPlain = data.plainLyrics || data.plainLyricsText;
      if (rawPlain) {
        const plain = parsePlainLyrics(rawPlain, durationMs);
        if (plain.length > 0) {
          cache.set(cacheKey, plain);
          return NextResponse.json({ lyrics: plain });
        }
      }
    }

    // 2️⃣ fallback lyrics.ovh
    const ovhUrl = `https://api.lyrics.ovh/v1/${encodeURIComponent(
      artist
    )}/${encodeURIComponent(track)}`;
    try {
      const ovh = await fetchWithTimeout(ovhUrl, 4000);
      if (ovh.ok) {
        const j = await ovh.json();
        if (j?.lyrics) {
          const lines = parsePlainLyrics(j.lyrics, durationMs);
          cache.set(cacheKey, lines);
          return NextResponse.json({ lyrics: lines });
        }
      }
    } catch {
      // ignora se falhar
    }

    // nada encontrado
    cache.set(cacheKey, []);
    return NextResponse.json({ lyrics: [] });
  } catch (err) {
    console.error("Lyrics fetch error:", err);
    return NextResponse.json({ lyrics: [] });
  }
}

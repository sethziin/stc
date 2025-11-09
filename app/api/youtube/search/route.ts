import { NextResponse } from "next/server";

const searchCache = new Map();

// pequena função de similaridade entre strings (0 a 1)
function similarity(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();

  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;

  let same = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] === shorter[i]) same++;
  }
  return same / longerLength;
}

async function searchYouTubeDirect(query: string) {
  try {
    console.log(`[YouTube Scraping] Buscando: "${query}"`);

    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.youtube.com/results?search_query=${encodedQuery}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!match) throw new Error("ytInitialData não encontrado");

    const ytInitialData = JSON.parse(match[1]);
    const contents =
      ytInitialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

    if (!Array.isArray(contents)) throw new Error("estrutura inválida");

    const videos: any[] = [];
    const qLower = query.toLowerCase();

    const blacklist = [
      "remix",
      "sped",
      "speed",
      "nightcore",
      "slowed",
      "reverb",
      "edit",
      "cover",
      "bass boosted",
      "mix",
      "loop",
      "instrumental",
      "karaoke",
      "session",
      "live",
      "performance",
      "version",
      "tutorial",
      "acoustic",
      "lyrics",
      "lyric",
      "reaction",
      "shorts",
    ];

    for (const item of contents) {
      const v = item.videoRenderer;
      if (!v?.videoId) continue;

      const title =
        v.title?.runs?.[0]?.text || v.title?.simpleText || "sem título";
      const channel = v.ownerText?.runs?.[0]?.text || "";
      const thumbnail =
        v.thumbnail?.thumbnails?.at(-1)?.url || "";

      const titleLower = title.toLowerCase();

      // ignora vídeos com palavras indesejadas
      if (blacklist.some((w) => titleLower.includes(w))) continue;

      const sim = similarity(titleLower, qLower);

      videos.push({
        videoId: v.videoId,
        title,
        channel,
        thumbnail,
        score: sim,
        source: "youtube-scraping",
      });
    }

    console.log(`[YouTube Scraping] ${videos.length} vídeos válidos`);

    if (!videos.length) return null;

    // ordena pela maior similaridade do título
    videos.sort((a, b) => b.score - a.score);

    const best = videos[0];
    console.log(`[YouTube Scraping] Escolhido: ${best.title} (similaridade ${(best.score * 100).toFixed(1)}%)`);
    return best;
  } catch (err) {
    console.error("[YouTube Scraping] Erro:", err);
    return null;
  }
}

// fallback simples
async function searchWithSimpleAPI(query: string) {
  const popular = {
    "yeah right joji": {
      videoId: "Xd7WyW5Dnb8",
      title: "Joji - YEAH RIGHT (Official Video)",
      channel: "Joji",
    },
  };

  const key = (Object.keys(popular) as Array<keyof typeof popular>).find((k) =>
    query.toLowerCase().includes(k)
  );

  if (key) {
    console.log(`[Fallback] Mapeado: ${key}`);
    const data = popular[key];
    return { ...data, source: "simple-api" };
  }

  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q)
    return NextResponse.json({ error: "Missing query" }, { status: 400 });

  console.log(`[YouTube Search] Buscando: "${q}"`);

  const cacheKey = q.toLowerCase().trim();
  if (searchCache.has(cacheKey)) {
    console.log(`[YouTube Search] Cache hit`);
    return NextResponse.json(searchCache.get(cacheKey));
  }

  const result = await searchYouTubeDirect(q);

  if (result) {
    searchCache.set(cacheKey, result);
    setTimeout(() => searchCache.delete(cacheKey), 15 * 60 * 1000);
    return NextResponse.json(result);
  }

  const fallback = await searchWithSimpleAPI(q);
  if (fallback) {
    searchCache.set(cacheKey, fallback);
    setTimeout(() => searchCache.delete(cacheKey), 15 * 60 * 1000);
    return NextResponse.json(fallback);
  }

  console.warn(`[YouTube Search] Nenhum vídeo encontrado: "${q}"`);
  const error = { videoId: null, error: "No video found", query: q };
  searchCache.set(cacheKey, error);
  setTimeout(() => searchCache.delete(cacheKey), 60 * 1000);
  return NextResponse.json(error);
}

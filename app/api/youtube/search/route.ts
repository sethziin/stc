import { NextResponse } from "next/server";

// Cache simples em memória
const searchCache = new Map();

// Função para fazer scraping direto do YouTube
async function searchYouTubeDirect(query: string) {
  try {
    console.log(`[YouTube Scraping] Buscando: "${query}"`);

    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.youtube.com/results?search_query=${encodedQuery}`;

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const html = await response.text();
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!match) throw new Error("ytInitialData não encontrado");

    const ytInitialData = JSON.parse(match[1]);
    const contents =
      ytInitialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

    if (!Array.isArray(contents)) throw new Error("estrutura inválida");

    const videos: any[] = [];
    const qLower = query.toLowerCase();

    // lista de palavras para ignorar
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
    ];

    for (const item of contents) {
      try {
        const v = item.videoRenderer;
        if (!v || !v.videoId) continue;

        const title =
          v.title?.runs?.[0]?.text || v.title?.simpleText || "sem título";
        const channel = v.ownerText?.runs?.[0]?.text || "";
        const thumbnail =
          v.thumbnail?.thumbnails?.[v.thumbnail.thumbnails.length - 1]?.url ||
          "";

        const titleLower = title.toLowerCase();

        // ignorar vídeos com palavras indesejadas
        if (blacklist.some((w) => titleLower.includes(w))) continue;

        // ignorar lives / streams
        if (titleLower.includes("live") || titleLower.includes("stream"))
          continue;

        videos.push({
          videoId: v.videoId,
          title,
          channel,
          thumbnail,
          source: "youtube-scraping",
        });
      } catch {
        continue;
      }
    }

    console.log(`[YouTube Scraping] ${videos.length} vídeos filtrados`);

    if (!videos.length) return null;

    // Pontuação de relevância
    const score = (title: string, channel: string) => {
      const t = title.toLowerCase();
      let s = 0;

      // pontos por coincidência direta com a query
      if (t.includes(qLower)) s += 8;
      if (qLower.includes(t)) s += 6;

      // pontos por artista no título ou canal
      const artistPart = qLower.split(" ")[0];
      if (t.includes(artistPart)) s += 3;
      if (channel.toLowerCase().includes(artistPart)) s += 3;

      // bônus por "official" / "audio"
      if (t.includes("official")) s += 2;
      if (t.includes("audio")) s += 1;

      // penalizar se tiver "video" ou "mv" (geralmente bloqueados)
      if (t.includes("official video")) s -= 3;
      if (channel.toLowerCase().includes("vevo")) s -= 5;

      return s;
    };

    // Ordenar por melhor correspondência
    videos.sort(
      (a, b) =>
        score(b.title, b.channel) - score(a.title, a.channel)
    );

    const best = videos[0];
    console.log(`[YouTube Scraping] Escolhido: ${best.title}`);
    return best;
  } catch (error) {
    console.error("[YouTube Scraping] Erro:", error);
    return null;
  }
}

// Fallback simples com mapeamento básico
async function searchWithSimpleAPI(query: string) {
  const popular = {
    "yeah right joji": {
      videoId: "Xd7WyW5Dnb8",
      title: "Joji - YEAH RIGHT (Official Video)",
      channel: "Joji",
    },
    "blinding lights the weeknd": {
      videoId: "4NRXx6U8ABQ",
      title: "The Weeknd - Blinding Lights (Official Video)",
      channel: "TheWeeknd",
    },
    "shape of you ed sheeran": {
      videoId: "JGwWNGJdvx8",
      title: "Ed Sheeran - Shape of You (Official Music Video)",
      channel: "Ed Sheeran",
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

// Rota principal
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

  // Scraping direto
  const result = await searchYouTubeDirect(q);

  if (result) {
    searchCache.set(cacheKey, result);
    setTimeout(() => searchCache.delete(cacheKey), 15 * 60 * 1000);
    return NextResponse.json(result);
  }

  // fallback simples
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
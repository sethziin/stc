import { NextResponse } from "next/server";

// Cache simples em memória
const searchCache = new Map();

// --- Função principal de scraping do YouTube ---
async function searchYouTubeDirect(query: string) {
  try {
    console.log(`[YouTube Scraping] Buscando: "${query}"`);

    const encodedQuery = encodeURIComponent(query);
    const url = `https://www.youtube.com/results?search_query=${encodedQuery}`;

    // Requisição simulando um navegador real
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

    if (!response.ok)
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);

    const html = await response.text();

    // Extrair o objeto ytInitialData
    const match = html.match(/var ytInitialData = ({.*?});<\/script>/);
    if (!match) throw new Error("ytInitialData não encontrado");

    const ytInitialData = JSON.parse(match[1]);

    const contents =
      ytInitialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
        ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

    if (!Array.isArray(contents))
      throw new Error("Estrutura de resultados inválida");

    const videos: any[] = [];

    for (const item of contents) {
      try {
        const videoRenderer = item.videoRenderer;
        if (videoRenderer && videoRenderer.videoId) {
          const title =
            videoRenderer.title?.runs?.[0]?.text ||
            videoRenderer.title?.simpleText;
          const channel = videoRenderer.ownerText?.runs?.[0]?.text;
          const thumbnail =
            videoRenderer.thumbnail?.thumbnails?.pop()?.url ||
            videoRenderer.thumbnail?.thumbnails?.[0]?.url;

          if (
            title &&
            !title.toLowerCase().includes("live") &&
            !title.toLowerCase().includes("stream") &&
            !title.toLowerCase().includes("full album") &&
            !title.toLowerCase().includes("cover") &&
            !title.toLowerCase().includes("reaction") &&
            !title.toLowerCase().includes("official video") && // 🔴 bloqueia vídeos VEVO
            !channel?.toLowerCase().includes("vevo") // 🔴 bloqueia canais com restrição de embed
          ) {
            videos.push({
              videoId: videoRenderer.videoId,
              title,
              channel,
              thumbnail,
              source: "youtube-scraping",
            });
          }
        }
      } catch {
        continue;
      }
    }

    console.log(`[YouTube Scraping] ${videos.length} vídeos filtrados`);

    if (!videos.length) return null;

    // 🔹 Preferir canal "- Topic"
    const topic = videos.find((v) =>
      v.channel?.toLowerCase().includes("- topic")
    );
    if (topic) {
      console.log(`[YouTube Scraping] Preferindo canal Topic: ${topic.channel}`);
      return topic;
    }

    // 🔹 Caso não tenha Topic, preferir "Official Audio"
    const officialAudio = videos.find((v) =>
      v.title.toLowerCase().includes("official audio")
    );
    if (officialAudio) {
      console.log(
        `[YouTube Scraping] Preferindo Official Audio: ${officialAudio.title}`
      );
      return officialAudio;
    }

    // 🔹 Ordenar por relevância genérica
    videos.sort((a, b) => {
      const score = (t: string) =>
        (t.includes("official") ? 3 : 0) +
        (t.includes("audio") ? 2 : 0) +
        (t.includes("music") ? 1 : 0);
      return score(b.title.toLowerCase()) - score(a.title.toLowerCase());
    });

    return videos[0];
  } catch (err) {
    console.error("[YouTube Scraping] Erro:", err);
    return null;
  }
}

// --- Fallback simples com mapeamento básico ---
async function searchWithSimpleAPI(query: string) {
  const popularVideos: Record<string, any> = {
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

  const key = Object.keys(popularVideos).find((k) =>
    query.toLowerCase().includes(k)
  );
  if (key) {
    console.log(`[Simple API] Fallback local: ${key}`);
    return { ...popularVideos[key], source: "simple-api-mapping" };
  }

  return null;
}

// --- Endpoint principal ---
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q)
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });

  const cacheKey = q.toLowerCase().trim();

  if (searchCache.has(cacheKey)) {
    console.log(`[YouTube Search] Cache hit: "${q}"`);
    return NextResponse.json(searchCache.get(cacheKey));
  }

  console.log(`[YouTube Search] Scraping para: "${q}"`);
  const scrapingResult = await searchYouTubeDirect(q);

  if (scrapingResult) {
    searchCache.set(cacheKey, scrapingResult);
    setTimeout(() => searchCache.delete(cacheKey), 15 * 60 * 1000);
    return NextResponse.json(scrapingResult);
  }

  console.log("[YouTube Search] Scraping falhou, tentando fallback...");
  const fallback = await searchWithSimpleAPI(q);

  if (fallback) {
    searchCache.set(cacheKey, fallback);
    setTimeout(() => searchCache.delete(cacheKey), 15 * 60 * 1000);
    return NextResponse.json(fallback);
  }

  const error = {
    videoId: null,
    error: "No video found",
    query: q,
    suggestion: "Try using the format: 'Artist - Song Name'",
  };
  searchCache.set(cacheKey, error);
  setTimeout(() => searchCache.delete(cacheKey), 60 * 1000);

  return NextResponse.json(error);
}

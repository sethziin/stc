import { NextResponse } from "next/server";

// ⚙️ Força runtime Node (não Edge, pq precisamos de fetch sem restrição de CORS)
export const runtime = "nodejs";

// Função utilitária pra fetch seguro
async function safeFetch(url: string, asText = false) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36",
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return asText ? await res.text() : await res.json();
  } catch (e) {
    console.error("Fetch failed:", e);
    return null;
  }
}

// remove tags html e limpa texto
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track");
  const artist = searchParams.get("artist");

  if (!track || !artist)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  console.log("🎵 Searching lyrics for:", `${track} - ${artist}`);

  // 1️⃣ MatchLyric API — sincronizada
  const ml = await safeFetch(
    `https://api.matchlyric.com/search?q=${encodeURIComponent(`${track} ${artist}`)}`
  );

  if (ml?.lyrics?.length) {
    console.log("✅ MatchLyric sync lyrics found");
    return NextResponse.json({ lyrics: ml.lyrics });
  }

  // 2️⃣ MatchLyric plain (letra completa)
  const mlPlain = await safeFetch(
    `https://api.matchlyric.com/plain?q=${encodeURIComponent(`${track} ${artist}`)}`
  );
  if (mlPlain?.lyrics) {
    console.log("✅ MatchLyric plain lyrics found");
    return NextResponse.json({ fullLyrics: mlPlain.lyrics });
  }

  // 3️⃣ Genius API search
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (token) {
    const genius = await safeFetch(
      `https://api.genius.com/search?q=${encodeURIComponent(`${track} ${artist}`)}&access_token=${token}`
    );

    if (genius?.response?.hits?.length) {
      const url = genius.response.hits[0].result.url;
      console.log("🌐 Genius URL:", url);

      const html = await safeFetch(url, true);
      if (html) {
        // tenta múltiplas variantes do container
        const match =
          html.match(/<div class="Lyrics__Container[^>]*>([\s\S]*?)<\/div>/) ||
          html.match(/<div data-lyrics-container="true">([\s\S]*?)<\/div>/) ||
          html.match(/<div class="lyrics">([\s\S]*?)<\/div>/);

        if (match) {
          const cleaned = stripHtml(match[1]);
          if (cleaned.length > 50) {
            console.log("✅ Genius lyrics parsed");
            return NextResponse.json({ fullLyrics: cleaned });
          }
        }
      }
    }
  }

  console.log("⚠️ No lyrics found in any source");
  return NextResponse.json({
    fullLyrics: "Nenhuma letra disponível para esta faixa.",
  });
}

import { NextResponse } from "next/server";

// Função utilitária para fazer requisições seguras
async function safeFetch(url: string, options?: RequestInit) {
  try {
    const res = await fetch(url, { ...options, next: { revalidate: 60 } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// Função para limpar texto HTML (no caso de letras do Genius)
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// 🔹 Função principal
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const track = searchParams.get("track");
  const artist = searchParams.get("artist");

  if (!track || !artist)
    return NextResponse.json({ error: "Missing params" }, { status: 400 });

  // 1️⃣ tenta buscar letra sincronizada (MatchLyric API)
  try {
    const sync = await safeFetch(
      `https://api.matchlyric.com/search?q=${encodeURIComponent(`${track} ${artist}`)}`
    );

    if (sync?.lyrics?.length) {
      // MatchLyric já retorna formato {timeMs, line}
      return NextResponse.json({ lyrics: sync.lyrics });
    }
  } catch (e) {
    console.warn("MatchLyric fallback failed", e);
  }

  // 2️⃣ tenta Genius (letra completa)
  try {
    const geniusSearch = await safeFetch(
      `https://api.genius.com/search?q=${encodeURIComponent(`${track} ${artist}`)}&access_token=${process.env.GENIUS_ACCESS_TOKEN}`
    );

    if (geniusSearch?.response?.hits?.length) {
      const first = geniusSearch.response.hits[0];
      const lyricsUrl = first.result.url;

      // Busca o HTML da página do Genius
      const htmlRes = await fetch(lyricsUrl);
      const html = await htmlRes.text();

      const match = html.match(/<div class="Lyrics__Container[^>]*>([\s\S]*?)<\/div>/);
      if (match) {
        const cleaned = stripHtml(match[1]);
        return NextResponse.json({ fullLyrics: cleaned });
      }
    }
  } catch (e) {
    console.warn("Genius fallback failed", e);
  }

  // 3️⃣ fallback final — busca texto cru do MatchLyric
  try {
    const plain = await safeFetch(
      `https://api.matchlyric.com/plain?q=${encodeURIComponent(`${track} ${artist}`)}`
    );
    if (plain?.lyrics) {
      return NextResponse.json({ fullLyrics: plain.lyrics });
    }
  } catch (e) {
    console.warn("Plain lyric fallback failed", e);
  }

  // 4️⃣ se tudo falhar
  return NextResponse.json({
    fullLyrics: "Nenhuma letra disponível para esta faixa.",
  });
}

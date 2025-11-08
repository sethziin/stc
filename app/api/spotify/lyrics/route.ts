import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

// limpa html e preserva quebras de linha
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
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

  console.log("🎵 Buscando letra:", `${track} - ${artist}`);

  // 1️⃣ tenta MatchLyric sincronizada
  const ml = await safeFetch(
    `https://api.matchlyric.com/search?q=${encodeURIComponent(`${track} ${artist}`)}`
  );
  if (ml?.lyrics?.length) {
    console.log("✅ MatchLyric (sincronizada)");
    return NextResponse.json({ lyrics: ml.lyrics });
  }

  // 2️⃣ tenta MatchLyric plain
  const mlPlain = await safeFetch(
    `https://api.matchlyric.com/plain?q=${encodeURIComponent(`${track} ${artist}`)}`
  );
  if (mlPlain?.lyrics) {
    console.log("✅ MatchLyric (texto completo)");
    return NextResponse.json({ fullLyrics: mlPlain.lyrics });
  }

  // 3️⃣ busca no Genius
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (token) {
    const search = await safeFetch(
      `https://api.genius.com/search?q=${encodeURIComponent(`${track} ${artist}`)}&access_token=${token}`
    );

    if (search?.response?.hits?.length) {
      const url = search.response.hits[0].result.url;
      console.log("🌐 Genius URL:", url);

      const html = await safeFetch(url, true);
      if (html) {
        // tenta todos os formatos possíveis
        const matches = [
          ...html.matchAll(
            /<div class="Lyrics__Container[^>]*>([\s\S]*?)<\/div>/g
          ),
          ...html.matchAll(
            /<div class="Lyrics__Container-sc-[^"]+">([\s\S]*?)<\/div>/g
          ),
          ...html.matchAll(
            /<div data-lyrics-container="true">([\s\S]*?)<\/div>/g
          ),
          ...html.matchAll(
            /<section[^>]*data-lyrics-container[^>]*>([\s\S]*?)<\/section>/g
          ),
        ];

        if (matches.length) {
          const combined = matches.map((m) => m[1]).join("\n");
          const cleaned = stripHtml(combined);

          if (cleaned && cleaned.length > 50) {
            console.log("✅ Genius (parsed com sucesso)");
            return NextResponse.json({ fullLyrics: cleaned });
          }
        }
      }
    }
  }

  console.log("⚠️ Nenhuma letra encontrada");
  return NextResponse.json({
    fullLyrics: "Nenhuma letra disponível para esta faixa.",
  });
}

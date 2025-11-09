import { NextResponse } from "next/server";

const searchCache = new Map<string, any>();

// -------- utils --------
const BLACKLIST = [
  "remix","sped","speed","nightcore","slowed","reverb","edit","cover",
  "bass boosted","mix","loop","instrumental","karaoke","session","live",
  "performance","tutorial","acoustic","lyrics","lyric","reaction","shorts",
  "8d","phonk","slowed+reverb","extended","hour","hours","Lofi".toLowerCase()
];

function normalize(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/&/g, " and ")
    .replace(/[^\p{Letter}\p{Number}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripParensAndFeatures(title: string): string {
  // remove ( ... ) [ ... ] { ... } e termos comuns de feat.
  let t = title.replace(/\(.*?\)|\[.*?\]|\{.*?\}/g, " ");
  t = t.replace(/\b(feat|ft|with|vs)\b.*$/i, " "); // corta a partir de feat...
  return normalize(t);
}

function coreTokens(title: string): string[] {
  const stop = new Set(["the","a","an","of","and","to","in","on","for","at","by","from","with","vs"]);
  return stripParensAndFeatures(title)
    .split(" ")
    .filter(w => w && !stop.has(w));
}

function containsBlacklisted(title: string): boolean {
  const t = normalize(title);
  return BLACKLIST.some(w => t.includes(w));
}

function parseYouTubeDurationToSeconds(lengthText?: any): number | null {
  // lengthText?.simpleText vem tipo "3:45" ou "1:02:09"
  const s = lengthText?.simpleText || lengthText?.runs?.[0]?.text;
  if (!s || typeof s !== "string") return null;
  const parts = s.split(":").map((x: string) => parseInt(x, 10));
  if (parts.some(isNaN)) return null;
  if (parts.length === 3) { // h:m:s
    return parts[0]*3600 + parts[1]*60 + parts[2];
  }
  if (parts.length === 2) { // m:s
    return parts[0]*60 + parts[1];
  }
  if (parts.length === 1) { // s
    return parts[0];
  }
  return null;
}

// similaridade simples posição-a-posicao (0..1)
function similarity(a: string, b: string): number {
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  const longerLength = longer.length || 1;
  let same = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer[i] === shorter[i]) same++;
  }
  return same / longerLength;
}

function titleCoversTokens(titleNorm: string, tokens: string[]): number {
  // retorna a fração de tokens presentes no título
  if (!tokens.length) return 0;
  let hit = 0;
  for (const tk of tokens) {
    if (titleNorm.includes(tk)) hit++;
  }
  return hit / tokens.length;
}

// -------- scraping --------
async function searchYouTubeDirect(track: string, artist?: string, durationMs?: number) {
  const q = [track, artist].filter(Boolean).join(" ");
  console.log(`[YouTube Scraping] Buscando: "${q}"`);

  const encoded = encodeURIComponent(q);
  const url = `https://www.youtube.com/results?search_query=${encoded}`;

  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();

  // tenta dois formatos comuns
  const m1 = html.match(/var ytInitialData = ({.*?});<\/script>/);
  const m2 = !m1 ? html.match(/"ytInitialData"\s*:\s*({.*?})\s*,\s*"ytInitialPlayerResponse"/) : null;
  const raw = m1?.[1] || m2?.[1];
  if (!raw) throw new Error("ytInitialData não encontrado");

  const data = JSON.parse(raw);
  const contents =
    data?.contents?.twoColumnSearchResultsRenderer?.primaryContents
      ?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

  if (!Array.isArray(contents)) throw new Error("estrutura inválida");

  const trackNorm = normalize(track);
  const artistNorm = artist ? normalize(artist) : "";
  const titleTokens = coreTokens(track);

  const candidates: Array<{
    videoId: string;
    title: string;
    channel: string;
    thumbnail: string | undefined;
    durationSec: number | null;
    score: number;
  }> = [];

  for (const item of contents) {
    const v = item.videoRenderer;
    if (!v?.videoId) continue;

    const title = v.title?.runs?.[0]?.text || v.title?.simpleText || "";
    const channel = v.ownerText?.runs?.[0]?.text || "";
    const titleNorm = normalize(title);
    const channelNorm = normalize(channel);

    // hard filters
    if (!titleNorm) continue;
    if (containsBlacklisted(title)) continue;
    // ignora resultados sem duração (muitos são lives/upload "estreia")
    const durationSec = parseYouTubeDurationToSeconds(v.lengthText);
    if (durationSec === null) continue;

    // —— SCORING ——
    // 1) cobertura dos tokens do título da faixa (peso alto)
    const coverage = titleCoversTokens(titleNorm, titleTokens); // 0..1
    // 2) similaridade geral com "track + artist"
    const fullQueryNorm = normalize([track, artist].filter(Boolean).join(" "));
    const simFull = similarity(titleNorm, fullQueryNorm); // 0..1
    // 3) artista no canal ou no título (bônus)
    const artistHit = artistNorm ? (channelNorm.includes(artistNorm) || titleNorm.includes(artistNorm) ? 1 : 0) : 0;

    // 4) duração (bônus forte quando muito próxima; penaliza quando distante)
    let durScore = 0;
    if (durationMs && durationMs > 0) {
      const target = Math.round(durationMs / 1000);
      const diff = Math.abs(durationSec - target);
      if (diff <= 2) durScore = 0.30;              // perfeito
      else if (diff <= 5) durScore = 0.20;         // ótimo
      else if (diff <= 8) durScore = 0.10;         // ok
      else if (diff <= 12) durScore = -0.05;       // um pouco distante
      else durScore = -0.15;                        // provavelmente versão errada
    }

    // 5) pequenas penalizações finais
    const smallPenalty =
      titleNorm.includes("official video") ? -0.03 : 0;

    // score final (pesos ajustados empiricamente)
    const score =
      coverage * 0.55 +
      simFull * 0.25 +
      artistHit * 0.20 +
      durScore +
      smallPenalty;

    candidates.push({
      videoId: v.videoId,
      title,
      channel,
      thumbnail: v.thumbnail?.thumbnails?.at(-1)?.url,
      durationSec,
      score,
    });
  }

  // primeiro, tente “match perfeito”: cobertura ≥ 0.9, artistaHit, e duração muito próxima (se fornecida)
  const PERFECT = candidates.filter(c => {
    const hitArtist = artist ? (normalize(c.channel).includes(artistNorm) || normalize(c.title).includes(artistNorm)) : true;
    const coverOK = titleCoversTokens(normalize(c.title), titleTokens) >= 0.9;
    let durationOK = true;
    if (durationMs && durationMs > 0 && c.durationSec != null) {
      const target = Math.round(durationMs / 1000);
      durationOK = Math.abs(c.durationSec - target) <= 3;
    }
    return hitArtist && coverOK && durationOK;
  }).sort((a,b)=>b.score - a.score);

  if (PERFECT.length) {
    const best = PERFECT[0];
    console.log(`[YouTube] PERFECT: ${best.title} — ${best.channel} (${best.durationSec}s) score=${best.score.toFixed(3)}`);
    return { ...best, source: "youtube-scraping" };
  }

  // senão, pega o melhor score geral
  candidates.sort((a,b)=>b.score - a.score);
  const best = candidates[0];
  if (best) {
    console.log(`[YouTube] BEST: ${best.title} — ${best.channel} (${best.durationSec}s) score=${best.score.toFixed(3)}`);
    return { ...best, source: "youtube-scraping" };
  }

  return null;
}

// -------- route --------
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";         // título da música
  const artist = searchParams.get("artist") || ""; // artista (opcional, mas recomendável)
  const durationMsParam = searchParams.get("durationMs");
  const durationMs = durationMsParam ? parseInt(durationMsParam, 10) : undefined;

  if (!q) {
    return NextResponse.json({ error: "Missing query 'q'" }, { status: 400 });
  }

  const cacheKey = JSON.stringify({ q: q.trim().toLowerCase(), artist: artist.trim().toLowerCase(), durationMs: durationMs || 0 });
  if (searchCache.has(cacheKey)) {
    return NextResponse.json(searchCache.get(cacheKey));
  }

  try {
    const result = await searchYouTubeDirect(q, artist, durationMs);
    if (result) {
      searchCache.set(cacheKey, result);
      setTimeout(() => searchCache.delete(cacheKey), 15 * 60 * 1000);
      return NextResponse.json(result);
    }
  } catch (e) {
    console.error("[YouTube] Erro geral:", e);
  }

  const error = { videoId: null, error: "No video found", q, artist, durationMs };
  searchCache.set(cacheKey, error);
  setTimeout(() => searchCache.delete(cacheKey), 60 * 1000);
  return NextResponse.json(error);
}

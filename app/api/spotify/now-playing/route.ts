import { NextResponse } from "next/server";
import ColorThief from "colorthief";
import { getNowPlaying } from "../utils";

export async function GET() {
  try {
    const np = await getNowPlaying();
    if (!np?.isPlaying) return NextResponse.json({ isPlaying: false });

    const albumImage = np.album?.image;
    let colors = ["#000", "#111"];
    let isDark = true;

    if (albumImage) {
      try {
        const imageBuffer = await fetch(albumImage).then((r) => r.arrayBuffer());
        const dominant = await ColorThief.getPalette(Buffer.from(imageBuffer), 2);
        colors = dominant.map((c) => `rgb(${c[0]},${c[1]},${c[2]})`);
        // luminosidade média → define se o fundo é claro ou escuro
        const avgLuma =
          (0.299 * dominant[0][0] + 0.587 * dominant[0][1] + 0.114 * dominant[0][2]) / 255;
        isDark = avgLuma < 0.5;
      } catch (err) {
        console.warn("falha ao extrair cores", err);
      }
    }

    return NextResponse.json({
      ...np,
      colors,
      isDark,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ isPlaying: false });
  }
}

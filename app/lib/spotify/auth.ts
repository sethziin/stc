import querystring from "querystring";

/**
 * Gera um novo access token do Spotify usando o refresh token fixo do .env
 */
export async function getAccessToken() {
  const client_id = process.env.SPOTIFY_CLIENT_ID!;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET!;
  const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN!;

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization:
        "Basic " + Buffer.from(`${client_id}:${client_secret}`).toString("base64"),
    },
    body: querystring.stringify({
      grant_type: "refresh_token",
      refresh_token,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Erro ao obter token Spotify:", error);
    throw new Error("Falha ao gerar access_token");
  }

  const data = await response.json();
  return data.access_token as string;
}

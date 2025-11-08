export async function getNowPlaying() {
  const token = process.env.SPOTIFY_ACCESS_TOKEN;
  if (!token) return { isPlaying: false };

  const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (res.status === 204 || res.status > 400) return { isPlaying: false };
  const song = await res.json();

  return {
    isPlaying: song.is_playing,
    progressMs: song.progress_ms,
    durationMs: song.item?.duration_ms,
    track: { id: song.item?.id, name: song.item?.name },
    artists: song.item?.artists?.map((a: any) => a.name) || [],
    album: {
      name: song.item?.album?.name,
      image: song.item?.album?.images?.[0]?.url || null,
    },
  };
}

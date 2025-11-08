"use client"

import { useEffect, useRef } from "react"

export default function BehindTheVeil() {
  const audioRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3
      audioRef.current.play().catch(() => {})
    }
  }, [])

  return (
    <main className="flex items-center justify-center min-h-screen">
      <h1 className="glitch-text text-center">the veil is thinner than you think.</h1>
      <audio ref={audioRef} src="/sound/ambient.mp3" loop />
    </main>
  )
}

"use client";

import { useEffect, useRef, useState } from "react";

export default function Home() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [title, setTitle] = useState("");
  const [currentTextIndex, setCurrentTextIndex] = useState(0);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const texts = ["stc...", "stc?", "stc!", "stc :3"];

  // toca som ambiente
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.3;
      audioRef.current.play().catch(() => {});
    }
  }, []);

  useEffect(() => {
    let isTabActive = true;

    const handleVisibilityChange = () => {
      isTabActive = !document.hidden;
      if (document.hidden) {
        document.title = "stc"; // fica fixo quando sai da aba
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      } else {
        typeWriter(); // retoma quando volta
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const typeWriter = () => {
      if (!isTabActive) return;

      const currentText = texts[currentTextIndex];
      const typingSpeed = isDeleting ? 150 : 220; // mais lento e suave
      const pauseBeforeDelete = 1800;

      if (!isDeleting) {
        // escrevendo
        if (currentCharIndex < currentText.length) {
          setTitle(currentText.substring(0, currentCharIndex + 1));
          setCurrentCharIndex((prev) => prev + 1);
          timeoutRef.current = setTimeout(typeWriter, typingSpeed);
        } else {
          // terminou de digitar → pausa antes de apagar
          timeoutRef.current = setTimeout(() => setIsDeleting(true), pauseBeforeDelete);
        }
      } else {
        // apagando
        if (currentCharIndex > 0) {
          setTitle(currentText.substring(0, currentCharIndex - 1));
          setCurrentCharIndex((prev) => prev - 1);
          timeoutRef.current = setTimeout(typeWriter, typingSpeed);
        } else {
          // passa pro próximo texto
          setIsDeleting(false);
          setCurrentTextIndex((prev) => (prev + 1) % texts.length);
          timeoutRef.current = setTimeout(typeWriter, 600);
        }
      }
    };

    // inicia animação
    typeWriter();

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [currentTextIndex, currentCharIndex, isDeleting]);

  // atualiza o título da aba
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);

  return (
    <main className="flex items-center justify-center min-h-screen bg-black text-white">
      <h1 className="glitch-text text-7xl font-bold">stc</h1>
      <audio ref={audioRef} src="/sound/ambient.mp3" loop />
      <style jsx>{`
        @keyframes glitch {
          0% { text-shadow: none; }
          25% { text-shadow: -2px -2px 0 #eb055a, 2px 2px 0 #4632f0; }
          50% { text-shadow: 2px -2px 0 #eb055a, -2px 2px 0 #4632f0; }
          75% { text-shadow: -2px 2px 0 #eb055a, 2px -2px 0 #4632f0; }
          100% { text-shadow: 2px 2px 0 #eb055a, -2px -2px 0 #4632f0; }
        }
        .glitch-text {
          animation: glitch 0.65s cubic-bezier(.25, .46, .45, .94) infinite;
          font-family: 'Josefin Sans', sans-serif;
          letter-spacing: 8px;
        }
      `}</style>
    </main>
  );
}

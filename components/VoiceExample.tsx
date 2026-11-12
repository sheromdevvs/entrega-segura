"use client";
import { useRef, useState } from "react";
import { Icon } from "./Icon";
export function VoiceExample() {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  return (
    <div className="voice-note">
      <audio
        ref={audio}
        src="/audio/courier-note.m4a"
        preload="none"
        onEnded={() => setPlaying(false)}
        onError={() => setPlaying(false)}
      />
      <button
        aria-label={
          playing
            ? "Pausar nota de voz sintética"
            : "Escuchar nota de voz sintética"
        }
        className="illustrative-play"
        onClick={async () => {
          if (!audio.current) return;
          if (playing) {
            audio.current.pause();
            setPlaying(false);
          } else {
            try {
              await audio.current.play();
              setPlaying(true);
            } catch {
              setPlaying(false);
            }
          }
        }}
      >
        <Icon name={playing ? "stop" : "play"} size={20} />
      </button>
      <div
        className={`waveform ${playing ? "is-playing" : ""}`}
        aria-hidden="true"
      >
        {Array.from({ length: 39 }, (_, i) => (
          <span
            key={i}
            style={{
              height: `${12 + ((i * 17 + i * i * 3) % 35)}px`,
              animationDelay: `${i * 31}ms`,
            }}
          />
        ))}
      </div>
      <span>Nota sintética</span>
    </div>
  );
}

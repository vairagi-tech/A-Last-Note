"use client";

import { useRef, useState } from "react";

const fmt = (s) => {
  if (!s || !isFinite(s)) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

// Deterministic "waveform" bar heights (no Math.random — stable across renders/SSR).
const BARS = Array.from({ length: 34 }, (_, i) => 5 + Math.round((Math.sin(i * 1.6) * 0.5 + 0.5) * 17));

// A styled audio card — play/pause, waveform with progress, time. `interactive`
// controls whether it actually plays (reader) or is just a preview (editor canvas).
export default function AudioPlayer({ src, title, color, interactive = true }) {
  const audioRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [dur, setDur] = useState(0);
  const accent = color || "#7c6cf0";

  const toggle = () => {
    const a = audioRef.current;
    if (!a || !src) return;
    if (a.paused) a.play().catch(() => {}); else a.pause();
  };
  const seek = (e) => {
    const a = audioRef.current; if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * dur;
  };

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", height: "100%", minHeight: 60,
      padding: "10px 14px", borderRadius: 16, boxSizing: "border-box",
      background: "rgba(255,255,255,.07)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
      border: `1px solid ${accent}44`, boxShadow: "0 4px 18px rgba(0,0,0,.18)",
    }}>
      <button onClick={toggle} aria-label={playing ? "Pause" : "Play"}
        style={{ flexShrink: 0, width: 42, height: 42, borderRadius: "50%", border: "none", cursor: "pointer", background: accent, color: "#fff", fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {playing ? "❚❚" : "▶"}
      </button>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--lp-text,#e8eaf0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 5 }}>{title || "Audio"}</div>
        <div onClick={interactive ? seek : undefined} style={{ display: "flex", alignItems: "center", gap: 2, height: 24, cursor: interactive ? "pointer" : "default" }}>
          {BARS.map((h, i) => {
            const active = i / BARS.length <= progress;
            return <span key={i} style={{ flex: 1, height: h, borderRadius: 2, background: active ? accent : `${accent}44`, transition: "background .15s" }} />;
          })}
        </div>
      </div>
      <div style={{ flexShrink: 0, fontSize: 11, fontFamily: "monospace", color: "var(--lp-dim,#9499a4)" }}>{fmt(progress * dur)}</div>
      {interactive && (
        <audio ref={audioRef} src={src} preload="metadata"
          onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)}
          onLoadedMetadata={e => setDur(e.currentTarget.duration || 0)}
          onTimeUpdate={e => setProgress(e.currentTarget.duration ? e.currentTarget.currentTime / e.currentTarget.duration : 0)} />
      )}
    </div>
  );
}

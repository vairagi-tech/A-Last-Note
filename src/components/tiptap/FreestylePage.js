"use client";

import { useRef, useState, useEffect } from "react";
import NodeCard from "@/components/tiptap/NodeCard";
import AudioPlayer from "@/components/tiptap/AudioPlayer";
import { DecorationGlyph } from "@/components/tiptap/decorations";
import { blockRevealStyle } from "@/components/tiptap/storyAnim";
import { CANVAS_W } from "@/lib/letterDoc";

// Read-only render of a freestyle ("Canva") page: every node positioned by its
// `pos`, with optional staggered block-reveal animations.
//
// The authored canvas is a fixed CANVAS_W wide. On a phone that's wider than the
// screen, which used to force two-axis scrolling. We now measure the available
// width and uniformly SCALE the whole canvas down to fit — so a freestyle letter
// looks the same on every screen, just smaller, with no sideways scrolling.
export default function FreestylePage({ pageDoc, anim }) {
  const nodes = (pageDoc?.content || []).filter(n => n.type !== "pagebreak");
  const height = Math.max(480, ...nodes.map(n => (n.attrs?.pos?.y || 0) + (n.attrs?.pos?.h || 160) + 40));
  const reveal = anim?.blockReveal && anim.blockReveal !== "none" ? anim.blockReveal : (anim?.breathPace > 0 ? "fade" : null);
  const stagger = anim?.revealStagger ?? 0.12;

  const wrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    // Only commit a new scale when it actually changes (rounded) — otherwise the
    // mobile address bar showing/hiding fires the observer constantly and churns
    // re-renders of the whole canvas during scroll.
    const measure = () => {
      const w = el.clientWidth;
      if (!w) return;
      const next = Math.round(Math.min(1, w / CANVAS_W) * 1000) / 1000;
      setScale(prev => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={wrapRef} style={{ width: "100%" }}>
      {/* Reserves the scaled height so the page flows correctly; clips any bleed. */}
      <div style={{ position: "relative", width: "100%", height: height * scale, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, left: 0, width: CANVAS_W, height, transform: `scale(${scale})`, transformOrigin: "top left" }}>
          {nodes.map((n, i) => {
            const p = n.attrs?.pos || { x: 20, y: 20 + i * 8, w: CANVAS_W - 40 };
            const deco = n.type === "decoration";
            const audio = n.type === "audio";
            return (
              <div key={i} style={{
                position: "absolute", left: 0, top: 0, width: p.w, height: (deco || audio) ? (p.h || (audio ? 64 : 100)) : (p.h || "auto"),
                transform: `translate(${p.x}px, ${p.y}px) rotate(${p.rotate || 0}deg)`,
                transformOrigin: "center", zIndex: p.z || 1, overflow: "hidden",
              }}>
                <div style={{ width: "100%", height: "100%", animation: reveal ? blockRevealStyle(reveal, i * stagger) : undefined }}>
                  {deco ? <DecorationGlyph kind={n.attrs.kind} variant={n.attrs.variant} color={n.attrs.color} content={n.attrs.content} />
                    : audio ? <AudioPlayer src={n.attrs.src} title={n.attrs.title} color={n.attrs.color} interactive />
                      : <NodeCard node={n} />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

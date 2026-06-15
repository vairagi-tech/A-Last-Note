"use client";

import { useState, useRef, useEffect } from "react";
import Moveable from "react-moveable";
import NodeCard from "@/components/tiptap/NodeCard";
import AudioPlayer from "@/components/tiptap/AudioPlayer";
import { DecorationGlyph, DECO_GROUPS } from "@/components/tiptap/decorations";
import { CANVAS_W } from "@/lib/letterDoc";
import { cloudinaryEnabled, uploadToCloudinary } from "@/lib/cloudinary";
import { compressToDataUrl, compressToFile } from "@/lib/imageCompress";

// Canva mode: the SAME document, every node freely positioned — plus decorative
// stickers/shapes/doodles you drop straight onto the surface.
const FB_DARK = { bg: "#0b0907", card: "#16120c", border: "#2a2318", text: "#cabfac", dim: "#807766", accent: "#d8a24a", onAccent: "#1b1206" };

export default function FreestyleBoard({ doc, onChange, theme, ui }) {
  const A = ui || FB_DARK;
  const btn = { padding: "4px 9px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: "transparent", color: A.text, border: `1px solid ${A.border}` };
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(null);
  const [palette, setPalette] = useState(false);
  const [, force] = useState(0);
  const refs = useRef({});
  const frame = useRef(null);

  const pages = [[]];
  (doc.content || []).forEach((n, gi) => {
    if (n.type === "pagebreak") pages.push([]);
    else pages[pages.length - 1].push({ n, gi });
  });
  const safePage = Math.min(page, pages.length - 1);
  const current = pages[safePage] || [];

  useEffect(() => { force(x => x + 1); }, [sel, safePage, doc]);

  const patchPos = (gi, patch) => onChange({ ...doc, content: doc.content.map((n, i) => i === gi ? { ...n, attrs: { ...(n.attrs || {}), pos: { ...(n.attrs?.pos || {}), ...patch } } } : n) });
  const patchAttr = (gi, patch) => onChange({ ...doc, content: doc.content.map((n, i) => i === gi ? { ...n, attrs: { ...(n.attrs || {}), ...patch } } : n) });
  const delNode = (gi) => { onChange({ ...doc, content: doc.content.filter((_, i) => i !== gi) }); setSel(null); };
  const zs = current.map(({ n }) => n.attrs?.pos?.z || 1);
  const layer = (gi, dir) => patchPos(gi, { z: dir === "front" ? Math.max(1, ...zs) + 1 : Math.min(1, ...zs) - 1 });

  const insertDeco = (item) => {
    const last = current.length ? current[current.length - 1].gi : -1;
    const at = last >= 0 ? last + 1 : doc.content.length;
    const node = { type: "decoration", attrs: { kind: item.kind, variant: item.variant, color: item.color || "", content: item.content || "", pos: { x: 70, y: 90, w: item.w, h: item.h, rotate: 0, z: Math.max(1, ...zs) + 1 } } };
    const content = [...doc.content]; content.splice(at, 0, node);
    onChange({ ...doc, content }); setSel(at);
  };

  // Upload your own sticker — a transparent PNG works best. Stored via Cloudinary
  // when configured, otherwise inlined as a data URL.
  const [uploading, setUploading] = useState(false);
  const uploadSticker = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      // Stickers are small on-screen — recompress hard so they stay light.
      const src = cloudinaryEnabled() ? await uploadToCloudinary(await compressToFile(file, { maxWidth: 600, maxHeight: 600 }), "image") : await compressToDataUrl(file, { maxWidth: 600, maxHeight: 600 });
      insertDeco({ kind: "img", variant: "upload", content: src, color: "", w: 120, h: 120 });
    } catch (e) { alert(e.message || "Couldn’t add that sticker."); }
    setUploading(false);
  };

  const selNode = sel != null ? doc.content[sel] : null;
  const isDeco = selNode?.type === "decoration";
  const recolorable = (isDeco && selNode.attrs.kind !== "emoji") || selNode?.type === "audio";
  const target = sel != null ? refs.current[sel] : null;
  if (selNode) {
    const p = selNode.attrs?.pos || { x: 30, y: 30, w: CANVAS_W - 60 };
    if (!frame.current || frame.current.gi !== sel) {
      const el = refs.current[sel];
      frame.current = { gi: sel, translate: [p.x || 0, p.y || 0], rotate: p.rotate || 0, width: p.w || CANVAS_W - 60, height: p.h || (el?.offsetHeight ?? 120) };
    }
  }

  const height = Math.max(660, ...current.map(({ n }) => (n.attrs?.pos?.y || 0) + (n.attrs?.pos?.h || 160) + 60));

  return (
    <div style={{ border: "1px solid var(--lp-divider,#2a2d3e)", borderRadius: 12, background: A.card, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center", padding: 8, borderBottom: `1px solid ${A.border}`, flexWrap: "wrap" }}>
        {pages.map((_, pi) => (
          <button key={pi} onClick={() => { setPage(pi); setSel(null); }} style={{ ...btn, background: safePage === pi ? A.accent : "transparent", color: safePage === pi ? (A.onAccent || "#fff") : A.text }}>Page {pi + 1}</button>
        ))}
        <button onClick={() => setPalette(p => !p)} style={{ ...btn, background: palette ? A.accent : "transparent", color: palette ? (A.onAccent || "#fff") : A.text }}>✨ Stickers</button>
        <div style={{ flex: 1 }} />
        {sel != null && <>
          {recolorable && <input type="color" value={selNode.attrs.color || "#e06a86"} onChange={e => patchAttr(sel, { color: e.target.value })} title="Color" style={{ width: 24, height: 24, border: "none", background: "transparent", cursor: "pointer" }} />}
          {!isDeco && <span style={{ fontSize: 10, color: A.dim }}>edit text in Write mode</span>}
          <button onClick={() => layer(sel, "front")} style={btn} title="Front">⬆</button>
          <button onClick={() => layer(sel, "back")} style={btn} title="Back">⬇</button>
          <button onClick={() => delNode(sel)} style={{ ...btn, color: "#e04040", borderColor: "#e0404044" }}>✕ Delete</button>
        </>}
      </div>

      {palette && (
        <div style={{ padding: 10, borderBottom: `1px solid ${A.border}`, maxHeight: 240, overflowY: "auto" }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: A.dim, marginBottom: 4 }}>Your stickers</div>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 8, background: A.accent + "16", border: `1px dashed ${A.accent}77`, color: A.accent, fontSize: 12, fontWeight: 600, cursor: uploading ? "wait" : "pointer" }}>
              {uploading ? "Uploading…" : "＋ Upload sticker"}
              <input type="file" accept="image/png,image/webp,image/jpeg,image/gif,image/svg+xml" style={{ display: "none" }} disabled={uploading} onChange={e => { const f = e.target.files?.[0]; if (f) uploadSticker(f); e.target.value = ""; }} />
            </label>
            <span style={{ fontSize: 10, color: A.dim, marginLeft: 8 }}>PNG with transparency looks best.</span>
          </div>
          {DECO_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: A.dim, marginBottom: 4 }}>{group.label}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {group.items.map((item, i) => (
                  <button key={i} onClick={() => insertDeco(item)} title="Add"
                    style={{ width: item.kind === "line" || item.kind === "washi" ? 56 : 40, height: 40, padding: 5, borderRadius: 8, background: A.bg, border: `1px solid ${A.border}`, cursor: "pointer" }}>
                    <DecorationGlyph kind={item.kind} variant={item.variant} color={item.color} content={item.content} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div onMouseDown={e => { if (e.target === e.currentTarget) setSel(null); }}
        style={{
          position: "relative", width: CANVAS_W, maxWidth: "100%", minHeight: height, margin: "0 auto",
          background: theme?.bg || "#0a0a0a",
          backgroundImage: "linear-gradient(rgba(128,128,128,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(128,128,128,.07) 1px,transparent 1px)",
          backgroundSize: "20px 20px",
        }}>
        {current.map(({ n, gi }) => {
          const p = n.attrs?.pos || { x: 30, y: 30, w: CANVAS_W - 60 };
          const deco = n.type === "decoration";
          const audio = n.type === "audio";
          return (
            <div key={gi} className="fs-node" data-gi={gi}
              ref={el => { if (el) refs.current[gi] = el; }}
              onMouseDown={e => { e.stopPropagation(); setSel(gi); }}
              style={{
                position: "absolute", left: 0, top: 0, width: p.w, height: (deco || audio) ? (p.h || (audio ? 64 : 100)) : (p.h || "auto"),
                transform: `translate(${p.x || 0}px, ${p.y || 0}px) rotate(${p.rotate || 0}deg)`,
                transformOrigin: "center", zIndex: p.z || 1, cursor: "move",
                outline: sel === gi ? `1.5px solid ${A.accent}` : "1px dashed rgba(128,128,128,.35)", outlineOffset: 2, borderRadius: 4,
              }}>
              <div style={{ pointerEvents: "none", width: "100%", height: "100%", ...themeVars(theme) }}>
                {deco ? <DecorationGlyph kind={n.attrs.kind} variant={n.attrs.variant} color={n.attrs.color} content={n.attrs.content} />
                  : audio ? <AudioPlayer src={n.attrs.src} title={n.attrs.title} color={n.attrs.color} interactive={false} />
                    : <div style={{ padding: 4 }}><NodeCard node={n} /></div>}
              </div>
            </div>
          );
        })}
      </div>

      {target && (
        <Moveable
          target={target} draggable resizable rotatable origin={false} keepRatio={false}
          onDragStart={({ set }) => set(frame.current.translate)}
          onDrag={({ beforeTranslate, target }) => { frame.current.translate = beforeTranslate; target.style.transform = `translate(${beforeTranslate[0]}px, ${beforeTranslate[1]}px) rotate(${frame.current.rotate}deg)`; }}
          onDragEnd={() => patchPos(sel, { x: Math.round(frame.current.translate[0]), y: Math.round(frame.current.translate[1]) })}
          onResizeStart={({ setOrigin, dragStart }) => { setOrigin(["%", "%"]); dragStart && dragStart.set(frame.current.translate); }}
          onResize={({ width, height, drag, target }) => { frame.current.width = width; frame.current.height = height; frame.current.translate = drag.beforeTranslate; target.style.width = `${width}px`; target.style.height = `${height}px`; target.style.transform = `translate(${drag.beforeTranslate[0]}px, ${drag.beforeTranslate[1]}px) rotate(${frame.current.rotate}deg)`; }}
          onResizeEnd={() => patchPos(sel, { w: Math.round(frame.current.width), h: Math.round(frame.current.height), x: Math.round(frame.current.translate[0]), y: Math.round(frame.current.translate[1]) })}
          onRotateStart={({ set }) => set(frame.current.rotate)}
          onRotate={({ beforeRotate, target }) => { frame.current.rotate = beforeRotate; target.style.transform = `translate(${frame.current.translate[0]}px, ${frame.current.translate[1]}px) rotate(${beforeRotate}deg)`; }}
          onRotateEnd={() => patchPos(sel, { rotate: Math.round(frame.current.rotate) })}
        />
      )}
    </div>
  );
}

function themeVars(t) {
  if (!t) return {};
  return { "--lp-text": t.text, "--lp-accent": t.accent, "--lp-dim": t.dim, "--lp-divider": t.divider, "--lp-quote-bg": t.quoteBg, "--lp-code-bg": t.codeBg, "--lp-heading-font": t.headingFont, "--lp-body-font": t.bodyFont, "--lp-code-font": t.codeFont, "--lp-base-size": (t.baseFontSize || 19) + "px" };
}


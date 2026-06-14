"use client";

import { useState } from "react";
import { BLOCK_TYPES, FONT_OPTIONS } from "@/lib/themes";
import { newBlock, splitIntoPages } from "@/lib/utils";
import { cloudinaryEnabled, uploadToCloudinary } from "@/lib/cloudinary";
import BlockRenderer from "@/components/BlockRenderer";
import CanvasBlock from "@/components/CanvasBlock";

const A = { bg: "#07080e", card: "#0d0f18", border: "#1a1d2e", accent: "#6366f1", text: "#c8cad4", dim: "#5a5d6e", bright: "#e8eaf0", red: "#e04040", green: "#34d399" };
const inp = { background: "#0d0f18", border: "1px solid #1a1d2e", color: "#e8eaf0", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%" };

const TYPE_COLORS = { text: "#6366f1", heading: "#818cf8", image: "#34d399", video: "#f472b6", code: "#d4903a", quote: "#a78bfa", list: "#22d3ee", callout: "#fbbf24", embed: "#60a5fa", divider: "#5a5d6e", pagebreak: "#e04040" };

export default function BlockEditor({ blocks, onChange, theme }) {
  const [view, setView] = useState("document"); // document | canvas
  const [styleOpen, setStyleOpen] = useState(null);
  const [slashAt, setSlashAt] = useState(null);
  const [addAt, setAddAt] = useState(null);
  const [dragIdx, setDragIdx] = useState(null);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);

  const set = (next) => onChange(next);
  const update = (i, patch) => set(blocks.map((b, idx) => idx === i ? { ...b, ...patch } : b));
  const updateMeta = (i, patch) => set(blocks.map((b, idx) => idx === i ? { ...b, meta: { ...b.meta, ...patch } } : b));
  const updateStyle = (i, patch) => set(blocks.map((b, idx) => idx === i ? { ...b, style: { ...b.style, ...patch } } : b));
  const remove = (i) => set(blocks.filter((_, idx) => idx !== i));
  const move = (i, dir) => { const n = i + dir; if (n < 0 || n >= blocks.length) return; const a = [...blocks]; [a[i], a[n]] = [a[n], a[i]]; set(a); };
  const duplicate = (i) => { const a = [...blocks]; a.splice(i + 1, 0, { ...blocks[i], id: newBlock().id }); set(a); };
  const insertAt = (i, type) => { const a = [...blocks]; const b = newBlock(type); a.splice(i, 0, b); set(a); setAddAt(null); setSlashAt(null); return b; };
  const convert = (i, type) => set(blocks.map((b, idx) => idx === i ? { ...newBlock(type), id: b.id } : b));

  const maxZ = () => Math.max(0, ...blocks.filter(b => b.position).map(b => b.position.z || 1));
  const minZ = () => Math.min(1, ...blocks.filter(b => b.position).map(b => b.position.z || 1));
  const toFree = (i) => update(i, { position: { x: 24, y: 24, width: 300, z: maxZ() + 1 } });
  const toFlow = (i) => update(i, { position: null });
  const layer = (i, dir) => { const z = dir === "front" ? maxZ() + 1 : minZ() - 1; update(i, { position: { ...blocks[i].position, z } }); };

  // Drag reorder (HTML5)
  const onDrop = (i) => { if (dragIdx == null || dragIdx === i) return; const a = [...blocks]; const [m] = a.splice(dragIdx, 1); a.splice(i, 0, m); set(a); setDragIdx(null); };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1 rounded-lg p-0.5" style={{ background: A.card, border: `1px solid ${A.border}` }}>
          {["document", "canvas"].map(v => (
            <button key={v} onClick={() => setView(v)} className="text-[11px] px-3 py-1.5 rounded-md capitalize"
              style={{ background: view === v ? A.accent : "transparent", color: view === v ? "#fff" : A.dim }}>{v === "document" ? "✍ Document" : "▦ Canvas"}</button>
          ))}
        </div>
        <span className="text-[10px]" style={{ color: A.dim }}>{view === "document" ? "Type, drag to reorder, press / to add a block" : "Drag & resize blocks freely on each page"}</span>
      </div>

      {view === "document" ? (
        <div>
          {blocks.map((blk, i) => (
            <div key={blk.id}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={e => e.preventDefault()}
              onDrop={() => onDrop(i)}
              className="group rounded-lg mb-1.5"
              style={{ background: A.card, border: `1px solid ${dragIdx === i ? A.accent : A.border}` }}
            >
              {blk.type === "pagebreak" ? (
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="flex-1 h-px" style={{ background: `repeating-linear-gradient(90deg, ${A.red}66 0 6px, transparent 6px 12px)` }} />
                  <span className="text-[10px] tracking-widest uppercase" style={{ color: A.red }}>✂ Read More — new page</span>
                  <div className="flex-1 h-px" style={{ background: `repeating-linear-gradient(90deg, ${A.red}66 0 6px, transparent 6px 12px)` }} />
                  <RowControls {...{ i, blk, move, remove, duplicate, toFree, toFlow, blocks }} hideStyle />
                </div>
              ) : (
                <div className="p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="cursor-grab text-[11px]" style={{ color: A.dim }} title="Drag to reorder">⋮⋮</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: (TYPE_COLORS[blk.type] || A.dim) + "20", color: TYPE_COLORS[blk.type] || A.dim }}>{blk.type}</span>
                    {blk.position && <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: A.accent + "20", color: A.accent }}>free</span>}
                    <div className="flex-1" />
                    <RowControls {...{ i, blk, move, remove, duplicate, toFree, toFlow, blocks }} onStyle={() => setStyleOpen(styleOpen === blk.id ? null : blk.id)} />
                  </div>

                  <BlockContent block={blk} i={i} update={update} updateMeta={updateMeta} convert={convert}
                    slashOpen={slashAt === blk.id} setSlash={(open) => setSlashAt(open ? blk.id : null)} />

                  {styleOpen === blk.id && <StylePanel block={blk} onStyle={(p) => updateStyle(i, p)} />}
                </div>
              )}

              <AddRow open={addAt === i} setOpen={(o) => setAddAt(o ? i : null)} onPick={(type) => insertAt(i + 1, type)} />
            </div>
          ))}

          <AddRow open={addAt === "end"} setOpen={(o) => setAddAt(o ? "end" : null)} onPick={(type) => insertAt(blocks.length, type)} alwaysShow />
        </div>
      ) : (
        <CanvasView {...{ blocks, theme, page, setPage, selected, setSelected, update, toFlow, layer, toFree }} />
      )}
    </div>
  );
}

// ─── Row controls ───
function RowControls({ i, blk, move, remove, duplicate, toFree, toFlow, blocks, onStyle, hideStyle }) {
  return (
    <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
      {!hideStyle && <button onClick={onStyle} className="text-[9px] px-1.5 py-0.5 rounded" style={ctrl}>🎨</button>}
      {!hideStyle && (blk.position
        ? <button onClick={() => toFlow(i)} className="text-[9px] px-1.5 py-0.5 rounded" style={ctrl} title="Dock into flow">⤓</button>
        : <button onClick={() => toFree(i)} className="text-[9px] px-1.5 py-0.5 rounded" style={ctrl} title="Free position">⤢</button>)}
      <button onClick={() => move(i, -1)} className="text-[9px] px-1 py-0.5 rounded" style={{ ...ctrl, opacity: i === 0 ? .3 : 1 }}>↑</button>
      <button onClick={() => move(i, 1)} className="text-[9px] px-1 py-0.5 rounded" style={{ ...ctrl, opacity: i === blocks.length - 1 ? .3 : 1 }}>↓</button>
      <button onClick={() => duplicate(i)} className="text-[9px] px-1 py-0.5 rounded" style={ctrl} title="Duplicate">⎘</button>
      <button onClick={() => remove(i)} className="text-[9px] px-1 py-0.5 rounded" style={{ ...ctrl, color: A.red, borderColor: A.red + "44" }}>✕</button>
    </div>
  );
}
const ctrl = { color: A.dim, border: `1px solid ${A.border}`, background: "transparent" };

// ─── Add-block row + slash-style menu ───
function AddRow({ open, setOpen, onPick, alwaysShow }) {
  return (
    <div className={alwaysShow ? "mt-2" : "px-3 pb-1"}>
      {!open ? (
        <button onClick={() => setOpen(true)} className="text-[10px] px-2 py-1 rounded transition-opacity"
          style={{ color: A.dim, border: `1px dashed ${A.border}`, width: alwaysShow ? "100%" : "auto", opacity: alwaysShow ? 1 : 0.5 }}>+ Add block</button>
      ) : (
        <div className="rounded-lg p-2 flex flex-wrap gap-1" style={{ background: A.bg, border: `1px solid ${A.accent}44` }}>
          {BLOCK_TYPES.map(bt => (
            <button key={bt.type} onClick={() => onPick(bt.type)} className="text-[10px] px-2 py-1 rounded hover:opacity-80"
              style={{ color: bt.type === "pagebreak" ? A.red : A.text, border: `1px solid ${A.border}` }}>{bt.icon} {bt.label}</button>
          ))}
          <button onClick={() => setOpen(false)} className="text-[10px] px-2 py-1 rounded" style={{ color: A.dim }}>cancel</button>
        </div>
      )}
    </div>
  );
}

// Notion-style markdown shortcuts: typing these at the start of a text block converts it.
const MD_RULES = [
  [/^#{1,6}\s/, "heading", null],
  [/^>\s/, "quote", null],
  [/^1\.\s/, "list", { ordered: true }],
  [/^[-*]\s/, "list", { ordered: false }],
  [/^```/, "code", null],
];

// ─── Cloudinary upload control ───
function UploadButton({ resourceType, onUploaded }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (!cloudinaryEnabled()) {
    return <span className="text-[9px] self-center whitespace-nowrap" style={{ color: A.dim }} title="Set NEXT_PUBLIC_CLOUDINARY_* in .env.local to enable uploads">URL only</span>;
  }
  return (
    <label className="text-[10px] px-2 py-1.5 rounded cursor-pointer whitespace-nowrap self-center" style={{ background: busy ? A.border : A.accent, color: "#fff" }}>
      {busy ? "Uploading…" : "⬆ Upload"}
      <input type="file" accept={resourceType === "video" ? "video/*" : "image/*"} style={{ display: "none" }} onChange={async (e) => {
        const f = e.target.files?.[0]; if (!f) return;
        setBusy(true); setErr("");
        try { const url = await uploadToCloudinary(f, resourceType); onUploaded(url); }
        catch (ex) { setErr(ex.message); alert(ex.message); }
        setBusy(false); e.target.value = "";
      }} />
    </label>
  );
}

// ─── Per-type content inputs ───
function BlockContent({ block, i, update, updateMeta, convert, slashOpen, setSlash }) {
  const onText = (v) => {
    if (v === "/") { setSlash(true); return; }
    if (block.type === "text") {
      for (const [re, type, meta] of MD_RULES) {
        if (re.test(v)) { update(i, { type, content: v.replace(re, ""), meta: meta || {} }); return; }
      }
    }
    update(i, { content: v });
  };
  const textArea = (placeholder, mono) => (
    <div style={{ position: "relative" }}>
      <textarea style={{ ...inp, minHeight: 56, resize: "vertical", fontFamily: mono ? "monospace" : "inherit" }} placeholder={placeholder}
        value={block.content} onChange={e => onText(e.target.value)} />
      {slashOpen && (
        <div className="rounded-lg p-2 flex flex-wrap gap-1 mt-1" style={{ background: A.bg, border: `1px solid ${A.accent}44` }}>
          {BLOCK_TYPES.map(bt => (
            <button key={bt.type} onClick={() => { convert(i, bt.type); setSlash(false); }} className="text-[10px] px-2 py-1 rounded"
              style={{ color: bt.type === "pagebreak" ? A.red : A.text, border: `1px solid ${A.border}` }}>{bt.icon} {bt.label}</button>
          ))}
          <button onClick={() => setSlash(false)} className="text-[10px] px-2 py-1" style={{ color: A.dim }}>esc</button>
        </div>
      )}
    </div>
  );

  switch (block.type) {
    case "text": return (<>
      {textArea("Write…  /  for blocks · # heading · > quote · - list · **bold** *italic* `code` [link](url)")}
    </>);
    case "heading": return textArea("Heading");
    case "quote": return (<div className="space-y-1.5">
      {textArea("Quote…")}
      <input style={inp} placeholder="— Author (optional)" value={block.meta?.author || ""} onChange={e => updateMeta(i, { author: e.target.value })} />
    </div>);
    case "callout": return (<div className="flex gap-2">
      <input style={{ ...inp, width: 56, textAlign: "center" }} value={block.meta?.emoji || "💡"} onChange={e => updateMeta(i, { emoji: e.target.value })} />
      <textarea style={{ ...inp, minHeight: 48, resize: "vertical" }} placeholder="Callout text…" value={block.content} onChange={e => update(i, { content: e.target.value })} />
    </div>);
    case "list": return (<div className="space-y-1.5">
      <label className="flex items-center gap-2 text-[11px]" style={{ color: A.dim }}>
        <input type="checkbox" checked={!!block.meta?.ordered} onChange={e => updateMeta(i, { ordered: e.target.checked })} /> Numbered
      </label>
      <textarea style={{ ...inp, minHeight: 56, resize: "vertical" }} placeholder="One item per line" value={block.content} onChange={e => update(i, { content: e.target.value })} />
    </div>);
    case "code": return (<div className="space-y-1.5">
      <input style={inp} placeholder="Language" value={block.meta?.lang || ""} onChange={e => updateMeta(i, { lang: e.target.value })} />
      <textarea style={{ ...inp, minHeight: 56, resize: "vertical", fontFamily: "monospace" }} placeholder="// code…" value={block.content} onChange={e => update(i, { content: e.target.value })} />
    </div>);
    case "image": return (<div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input style={inp} placeholder="Image URL (https://…)" value={block.content} onChange={e => update(i, { content: e.target.value })} />
        <UploadButton resourceType="image" onUploaded={url => update(i, { content: url })} />
      </div>
      <input style={inp} placeholder="Caption" value={block.meta?.caption || ""} onChange={e => updateMeta(i, { caption: e.target.value })} />
      {block.content && <img src={block.content} alt="" style={{ maxHeight: 90, borderRadius: 6 }} onError={e => e.target.style.display = "none"} />}
    </div>);
    case "video": return (<div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input style={inp} placeholder="YouTube or video URL" value={block.content} onChange={e => update(i, { content: e.target.value })} />
        <UploadButton resourceType="video" onUploaded={url => update(i, { content: url })} />
      </div>
      <input style={inp} placeholder="Caption" value={block.meta?.caption || ""} onChange={e => updateMeta(i, { caption: e.target.value })} />
    </div>);
    case "embed": return (<div className="space-y-1.5">
      <input style={inp} placeholder="Embed URL (iframe src)" value={block.content} onChange={e => update(i, { content: e.target.value })} />
      <input style={inp} placeholder="Caption" value={block.meta?.caption || ""} onChange={e => updateMeta(i, { caption: e.target.value })} />
    </div>);
    case "divider": return <div className="h-px my-1" style={{ background: A.border }} />;
    default: return null;
  }
}

// ─── Per-block style overrides panel ───
function StylePanel({ block, onStyle }) {
  const s = block.style || {};
  const num = (key, label, ph) => (
    <div><label className="text-[9px] block mb-0.5" style={{ color: A.dim }}>{label}</label>
      <input type="number" style={{ ...inp, padding: "5px 7px" }} placeholder={ph} value={s[key] ?? ""} onChange={e => onStyle({ [key]: e.target.value === "" ? "" : Number(e.target.value) })} /></div>
  );
  return (
    <div className="rounded-lg p-3 mt-2" style={{ background: A.bg, border: `1px solid ${A.accent}33` }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] tracking-widest uppercase" style={{ color: A.dim }}>Element Style</span>
        <button onClick={() => onStyle({ color: undefined, bg: undefined, fontFamily: undefined, fontSize: "", lineHeight: "", letterSpacing: "", align: undefined, bold: false, italic: undefined, marginBottom: "", padding: "", radius: "" })}
          className="text-[9px] px-2 py-0.5 rounded" style={{ color: A.dim, border: `1px solid ${A.border}` }}>Reset to theme</button>
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        <div><label className="text-[9px] block mb-0.5" style={{ color: A.dim }}>Color</label>
          <input type="color" value={s.color || "#cccccc"} onChange={e => onStyle({ color: e.target.value })} style={{ width: "100%", height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: "transparent" }} /></div>
        <div><label className="text-[9px] block mb-0.5" style={{ color: A.dim }}>Background</label>
          <input type="color" value={s.bg || "#0d0f18"} onChange={e => onStyle({ bg: e.target.value })} style={{ width: "100%", height: 28, borderRadius: 6, border: "none", cursor: "pointer", background: "transparent" }} /></div>
        {num("fontSize", "Size", "px")}
        {num("lineHeight", "Line H", "1.8")}
      </div>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {num("letterSpacing", "Spacing", "px")}
        {num("marginBottom", "Margin", "px")}
        {num("padding", "Padding", "px")}
        {num("radius", "Radius", "px")}
      </div>
      <div className="grid grid-cols-2 gap-2 items-end">
        <div><label className="text-[9px] block mb-0.5" style={{ color: A.dim }}>Font</label>
          <select style={{ ...inp, padding: "5px 7px" }} value={s.fontFamily || ""} onChange={e => onStyle({ fontFamily: e.target.value || undefined })}>
            <option value="">Theme default</option>
            {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select></div>
        <div className="flex gap-1 items-center">
          {["left", "center", "right"].map(al => (
            <button key={al} onClick={() => onStyle({ align: al })} className="text-[10px] px-2 py-1.5 rounded flex-1"
              style={{ background: s.align === al ? A.accent : "transparent", color: s.align === al ? "#fff" : A.dim, border: `1px solid ${A.border}` }}>{al[0].toUpperCase()}</button>
          ))}
          <button onClick={() => onStyle({ bold: !s.bold })} className="text-[10px] px-2 py-1.5 rounded font-bold" style={{ background: s.bold ? A.accent : "transparent", color: s.bold ? "#fff" : A.dim, border: `1px solid ${A.border}` }}>B</button>
          <button onClick={() => onStyle({ italic: !s.italic })} className="text-[10px] px-2 py-1.5 rounded italic" style={{ background: s.italic ? A.accent : "transparent", color: s.italic ? "#fff" : A.dim, border: `1px solid ${A.border}` }}>I</button>
        </div>
      </div>
    </div>
  );
}

// ─── Canvas view (per page free positioning) ───
function CanvasView({ blocks, theme, page, setPage, selected, setSelected, update, toFlow, layer, toFree }) {
  // Map blocks to pages, keeping global indices.
  const pages = [[]];
  blocks.forEach((b, gi) => { if (b.type === "pagebreak") pages.push([]); else pages[pages.length - 1].push({ b, gi }); });
  const safePage = Math.min(page, pages.length - 1);
  const current = pages[safePage] || [];
  const flow = current.filter(x => !x.b.position);
  const free = current.filter(x => x.b.position);

  return (
    <div>
      <div className="flex gap-1 mb-3 flex-wrap">
        {pages.map((_, pi) => (
          <button key={pi} onClick={() => setPage(pi)} className="text-[10px] px-3 py-1.5 rounded-lg"
            style={{ background: safePage === pi ? A.accent : A.card, color: safePage === pi ? "#fff" : A.dim, border: `1px solid ${A.border}` }}>Page {pi + 1}</button>
        ))}
      </div>
      <div className="mx-auto" style={{ width: theme.contentWidth || 560, maxWidth: "100%" }}>
        <div onMouseDown={() => setSelected(null)} style={{
          position: "relative", width: "100%", minHeight: 620,
          background: theme.bg, borderRadius: 10, padding: 16,
          border: `1px solid ${A.border}`,
          backgroundImage: "linear-gradient(rgba(128,128,128,.06) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,.06) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}>
          {/* flow blocks render stacked; pop any into free placement */}
          {flow.map(({ b, gi }) => (
            <div key={b.id} style={{ position: "relative" }} className="group">
              <BlockRenderer block={b} theme={theme} />
              <button onClick={() => { toFree(gi); setSelected(b.id); }} className="text-[9px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100"
                style={{ position: "absolute", top: 0, right: 0, background: A.accent, color: "#fff" }}>⤢ free</button>
            </div>
          ))}
          {/* free blocks: draggable + resizable */}
          {free.map(({ b, gi }) => (
            <CanvasBlock key={b.id} block={b} theme={theme} selected={selected === b.id}
              onSelect={() => setSelected(b.id)}
              onChange={(pos) => update(gi, { position: pos })}
              onToFlow={() => toFlow(gi)}
              onLayer={(dir) => layer(gi, dir)} />
          ))}
          {current.length === 0 && <p className="text-center text-xs" style={{ color: A.dim, paddingTop: 40 }}>Empty page</p>}
        </div>
      </div>
      <p className="text-[10px] mt-2 text-center" style={{ color: A.dim }}>Hover a stacked block → ⤢ to free it. Drag to move, corner to resize, ⬆⬇ to layer, ⤓ to dock back.</p>
    </div>
  );
}

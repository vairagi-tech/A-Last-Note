"use client";

import { useState, useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { buildExtensions } from "@/components/tiptap/extensions";
import { themeToVars, ensureFreestyle, clearFreestyle } from "@/lib/letterDoc";
import { FONT_OPTIONS } from "@/lib/themes";
import { cloudinaryEnabled, uploadToCloudinary } from "@/lib/cloudinary";
import { resolveImport } from "@/lib/embed";
import { pdfToPages, fileToDataUrl } from "@/lib/pdfSplit";
import { LetterProseStyles } from "@/components/tiptap/proseStyles";
import FreestyleBoard from "@/components/tiptap/FreestyleBoard";

const A_DARK = { card: "#16120c", border: "#2a2318", accent: "#d8a24a", onAccent: "#1b1206", text: "#cabfac", dim: "#807766", bright: "#efe7d6" };
const tb = (A, active) => ({ padding: "5px 9px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: active ? A.accent : "transparent", color: active ? (A.onAccent || "#fff") : A.text, border: `1px solid ${A.border}`, whiteSpace: "nowrap" });

export default function LetterEditor({ doc, onChange, theme, ui }) {
  const A = ui || A_DARK;
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState("write"); // write | canva
  const [urlCfg, setUrlCfg] = useState(null); // in-app URL box
  const [urlVal, setUrlVal] = useState("");
  const [importing, setImporting] = useState(null); // {done,total} while splitting a PDF
  const openUrl = (cfg) => { setUrlVal(""); setUrlCfg(cfg); };
  const submitUrl = () => { const u = urlVal.trim(); if (u && urlCfg) urlCfg.submit(u); setUrlCfg(null); };
  const editor = useEditor({
    immediatelyRender: false,
    extensions: buildExtensions(),
    content: doc || { type: "doc", content: [{ type: "paragraph" }] },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
    editorProps: { attributes: { class: "lp-prose" } },
  });

  if (!editor) return <p style={{ color: A.dim }}>Loading editor…</p>;

  // A FRESH chain per action — reusing one chain object goes stale after the
  // first .run() and makes the toolbar buttons "stick".
  const can = () => editor.chain().focus();
  // Keep the text selection while clicking a format button (don't steal focus).
  const pd = (e) => e.preventDefault();
  const uploadImage = async (file) => {
    setBusy(true);
    try { const url = await uploadToCloudinary(file, "image"); editor.chain().focus().setImage({ src: url }).run(); }
    catch (e) { alert(e.message); }
    setBusy(false);
  };
  const insertVideo = () => openUrl({ title: "Add a video", hint: "Paste a YouTube link or a direct video file URL (.mp4).", submit: (u) => editor.chain().focus().insertContent({ type: "video", attrs: { src: u } }).run() });
  const insertAudio = () => {
    if (cloudinaryEnabled()) {
      const inp = document.createElement("input"); inp.type = "file"; inp.accept = "audio/*";
      inp.onchange = async () => {
        const f = inp.files?.[0]; if (!f) return; setBusy(true);
        try { const url = await uploadToCloudinary(f, "video"); editor.chain().focus().insertContent({ type: "audio", attrs: { src: url, title: f.name.replace(/\.[^.]+$/, "") } }).run(); }
        catch (e) { alert(e.message); } setBusy(false);
      };
      inp.click();
    } else { openUrl({ title: "Add audio", hint: "Paste a direct audio file URL (.mp3 / .m4a). Voice-note file uploads need Cloudinary.", submit: (u) => editor.chain().focus().insertContent({ type: "audio", attrs: { src: u, title: "Voice note" } }).run() }); }
  };
  // Insert each design page as its OWN reader page (Read More break + content).
  const insertPages = (items) => {
    const content = [];
    items.forEach(node => content.push({ type: "pagebreak" }, node));
    editor.chain().focus().insertContent(content).run();
  };

  // Split a multi-page PDF into one image page per PDF page.
  const importPdf = async (source) => {
    setUrlCfg(null); setImporting({ done: 0, total: 0 });
    try {
      const pages = await pdfToPages(source, { onProgress: (done, total) => setImporting({ done, total }) });
      if (!pages.length) throw new Error("That PDF had no pages.");
      insertPages(pages.map(p => ({ type: "image", attrs: { src: p.dataUrl, bleed: true } })));
    } catch (e) { alert(e.message || "Couldn't import that PDF."); }
    setImporting(null);
  };

  // A picked file: PDF → split into pages; image → a single new page.
  const importFile = async (file) => {
    if (!file) return;
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) return importPdf(file);
    setUrlCfg(null); setBusy(true);
    try {
      const src = cloudinaryEnabled() ? await uploadToCloudinary(file, "image") : await fileToDataUrl(file);
      insertPages([{ type: "image", attrs: { src, bleed: true } }]);
    } catch (e) { alert(e.message); }
    setBusy(false);
  };

  // A pasted link: PDF → try to split into pages (falls back to embed on CORS);
  // Canva / Drive → one interactive embed box; image → a single page.
  const importLink = async (url) => {
    if (/\.pdf(\?|#|$)/i.test(url)) {
      setImporting({ done: 0, total: 0 });
      try {
        const pages = await pdfToPages(url, { onProgress: (done, total) => setImporting({ done, total }) });
        setImporting(null);
        return insertPages(pages.map(p => ({ type: "image", attrs: { src: p.dataUrl, bleed: true } })));
      } catch { setImporting(null); /* fall through to embed below */ }
    }
    const r = resolveImport(url);
    if (r.type === "embed") {
      let src = r.src, ratio = r.ratio || 75;
      if (r.needsResolve) {
        setBusy(true);
        try { const res = await fetch(`/api/embed/resolve?url=${encodeURIComponent(url)}`); const d = await res.json(); if (res.ok && d.src) { src = d.src; if (d.ratio) ratio = d.ratio; } } catch {}
        setBusy(false);
      }
      return insertPages([{ type: "embed", attrs: { src, ratio } }]);
    }
    insertPages([{ type: "image", attrs: { src: r.src, bleed: true } }]);
  };

  const insertImport = () => openUrl({
    kind: "import",
    title: "Import a design as pages",
    hint: "Best for multi-page designs: download from Canva as a PDF, then choose the file — each page becomes its own letter page. You can also paste a link.",
    preview: true,
    onFile: importFile,
    submit: importLink,
  });

  // Enter Canva: snapshot the written content and give every chunk a position.
  const toCanva = () => { onChange(ensureFreestyle(editor.getJSON())); setMode("canva"); };
  // Back to Write: reload latest content into the flow editor.
  const toWrite = () => { try { editor.commands.setContent(doc); } catch { /* noop */ } setMode("write"); };
  const backToFlow = () => { const flat = clearFreestyle(doc); onChange(flat); try { editor.commands.setContent(flat); } catch { /* noop */ } setMode("write"); };

  const modeBtn = (on) => ({ padding: "5px 12px", borderRadius: 7, fontSize: 12, cursor: "pointer", background: on ? A.accent : "transparent", color: on ? (A.onAccent || "#fff") : A.text, border: "none" });

  return (
    <div>
      {/* Write ↔ Canva mode */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 4, padding: 4, borderRadius: 10, background: A.card, border: `1px solid ${A.border}` }}>
          <button onClick={toWrite} style={modeBtn(mode === "write")}>✍ Write</button>
          <button onClick={toCanva} style={modeBtn(mode === "canva")}>▦ Canva</button>
        </div>
        <span style={{ fontSize: 11, color: A.dim }}>
          {mode === "write" ? "Write & format freely — text, images, video (your “HTML”)" : "Drag any chunk / image / video anywhere (your “CSS”)"}
        </span>
        {mode === "canva" && <button onClick={backToFlow} style={{ ...tb(A, false), marginLeft: "auto" }}>↺ Back to flow</button>}
      </div>

      {/* ── WRITE MODE ── */}
      <div style={{ display: mode === "write" ? "block" : "none" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, padding: "7px 9px", borderRadius: 12, background: A.card, border: `1px solid ${A.border}`, position: "sticky", top: 8, zIndex: 6, marginBottom: 14, boxShadow: "0 6px 20px rgba(0,0,0,.28)" }}>
        <button title="Bold (⌘/Ctrl+B)" style={tb(A, editor.isActive("bold"))} onMouseDown={pd} onClick={() => can().toggleBold().run()}><b>B</b></button>
        <button title="Italic (⌘/Ctrl+I)" style={tb(A, editor.isActive("italic"))} onMouseDown={pd} onClick={() => can().toggleItalic().run()}><i>i</i></button>
        <button title="Strikethrough" style={tb(A, editor.isActive("strike"))} onMouseDown={pd} onClick={() => can().toggleStrike().run()}><s>S</s></button>
        <button title="Inline code (monospace)" style={tb(A, editor.isActive("code"))} onMouseDown={pd} onClick={() => can().toggleCode().run()}>{"</>"}</button>
        <Sep A={A} />
        <button title="Big heading" style={tb(A, editor.isActive("heading", { level: 1 }))} onMouseDown={pd} onClick={() => can().toggleHeading({ level: 1 }).run()}>H1</button>
        <button title="Medium heading" style={tb(A, editor.isActive("heading", { level: 2 }))} onMouseDown={pd} onClick={() => can().toggleHeading({ level: 2 }).run()}>H2</button>
        <button title="Small heading" style={tb(A, editor.isActive("heading", { level: 3 }))} onMouseDown={pd} onClick={() => can().toggleHeading({ level: 3 }).run()}>H3</button>
        <button title="Bulleted list" style={tb(A, editor.isActive("bulletList"))} onMouseDown={pd} onClick={() => can().toggleBulletList().run()}>• List</button>
        <button title="Numbered list" style={tb(A, editor.isActive("orderedList"))} onMouseDown={pd} onClick={() => can().toggleOrderedList().run()}>1. List</button>
        <button title="Quote" style={tb(A, editor.isActive("blockquote"))} onMouseDown={pd} onClick={() => can().toggleBlockquote().run()}>❝</button>
        <button title="Code block" style={tb(A, editor.isActive("codeBlock"))} onMouseDown={pd} onClick={() => can().toggleCodeBlock().run()}>Code</button>
        <Sep A={A} />
        {[["left", "Align left"], ["center", "Align center"], ["right", "Align right"]].map(([al, t]) => (
          <button key={al} title={t} style={tb(A, editor.isActive({ textAlign: al }))} onMouseDown={pd} onClick={() => can().setTextAlign(al).run()}>{al[0].toUpperCase()}</button>
        ))}
        <label style={{ ...tb(A, false), display: "inline-flex", alignItems: "center", gap: 4 }} title="Text colour — pick a colour for the selected text">
          🎨<input type="color" onChange={e => can().setColor(e.target.value).run()} style={{ width: 18, height: 18, border: "none", background: "transparent", cursor: "pointer" }} />
        </label>
        <label style={{ ...tb(A, editor.isActive("highlight"))}} title="Highlight — colour behind the selected text">
          🖍<input type="color" onChange={e => can().toggleHighlight({ color: e.target.value }).run()} style={{ width: 18, height: 18, border: "none", background: "transparent", cursor: "pointer", verticalAlign: "middle" }} />
        </label>
        <select style={{ ...tb(A, false), padding: "4px 6px" }} defaultValue="" onChange={e => e.target.value ? can().setFontFamily(e.target.value).run() : can().unsetFontFamily().run()} title="Font for the selected text">
          <option value="">Font</option>
          {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <EmojiButton A={A} onPick={(em) => editor.chain().focus().insertContent(em).run()} />
        <Sep A={A} />
        {cloudinaryEnabled() ? (
          <label title="Upload an image from your device" style={{ ...tb(A, false), background: A.accent, color: A.onAccent || "#fff", border: "none" }}>
            {busy ? "Uploading…" : "🖼 Upload"}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ""; }} />
          </label>
        ) : (
          <button title="Add an image by link" style={tb(A, false)} onClick={() => openUrl({ title: "Add an image", hint: "Paste a DIRECT image link (.jpg .png .gif .webp).", preview: true, submit: (u) => can().setImage({ src: u }).run() })}>🖼 Image</button>
        )}
        <button title="Embed a video (YouTube or a .mp4 link)" style={tb(A, false)} onClick={insertVideo}>▶ Video</button>
        <button title="Add audio or a voice note" style={tb(A, false)} onClick={insertAudio}>🎵 Audio</button>
        <button style={tb(A, false)} onClick={insertImport} title="Import a finished design (Canva / PDF / Drive / image) as pages">📎 Import</button>
        <button title="Read More — splits the reader onto a new page here" style={{ ...tb(A, false), color: "#e04040", borderColor: "#e0404044" }} onMouseDown={pd} onClick={() => can().insertContent({ type: "pagebreak" }).run()}>✂ Read More</button>
      </div>

      <div className="lp-editor-shell"
        onMouseDown={(e) => { if (e.target === e.currentTarget || e.target.classList?.contains("lp-editor-pad")) editor.commands.focus("end"); }}
        style={{ ...themeToVars(theme), background: theme.bg, border: `1px solid ${A.border}`, borderRadius: 14, padding: 0, minHeight: "min(74vh, 880px)", cursor: "text", boxShadow: "inset 0 1px 0 rgba(255,255,255,.02)" }}>
        <div className="lp-editor-pad" style={{ maxWidth: 700, margin: "0 auto", padding: "clamp(40px, 7vh, 72px) 24px 120px" }}>
          <EditorContent editor={editor} />
        </div>
      </div>
      <p style={{ fontSize: 10, color: A.dim, marginTop: 10, textAlign: "center" }}>Write & format freely — flip to <b>▦ Canva</b> to drag anything anywhere · <b style={{ color: "#e0604a" }}>✂ Read More</b> starts a new reader page.</p>
      </div>

      {/* ── CANVA MODE ── */}
      {mode === "canva" && (
        <div style={themeToVars(theme)}>
          <FreestyleBoard doc={doc} onChange={onChange} theme={theme} ui={A} />
        </div>
      )}

      {urlCfg && <UrlModal A={A} cfg={urlCfg} val={urlVal} setVal={setUrlVal} onSubmit={submitUrl} onClose={() => setUrlCfg(null)} />}

      {importing && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1001, background: "rgba(0,0,0,.6)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: A.card, border: `1px solid ${A.border}`, borderRadius: 14, padding: "24px 30px", textAlign: "center", minWidth: 240 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: A.bright || A.text, marginBottom: 10 }}>Splitting your PDF into pages…</div>
            <div style={{ height: 6, borderRadius: 99, background: A.border, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ height: "100%", width: importing.total ? `${(importing.done / importing.total) * 100}%` : "15%", background: A.accent, transition: "width .25s" }} />
            </div>
            <div style={{ fontSize: 11, color: A.dim }}>{importing.total ? `Page ${importing.done} of ${importing.total}` : "Reading file…"}</div>
          </div>
        </div>
      )}

      <LetterProseStyles />
    </div>
  );
}

// In-app box for pasting a URL (image / video / audio / import) — replaces the
// old browser prompt(). In "import" mode it understands Canva / PDF / Drive links
// (they get embedded) and previews image links live. In plain image mode it warns
// when you paste a Canva *share* link, which is a web page and can't be an <img>.
function UrlModal({ A, cfg, val, setVal, onSubmit, onClose }) {
  const [imgErr, setImgErr] = useState(false);
  useEffect(() => { setImgErr(false); }, [val]);
  const trimmed = val.trim();
  const isImport = cfg.kind === "import";
  const resolved = isImport && trimmed ? resolveImport(trimmed) : null;

  // In image mode only, a Canva design link is a hard no (it's a page, not a file).
  const isCanvaShare = !isImport && /canva\.com\/design/i.test(val);
  const canAdd = !!trimmed && !isCanvaShare;
  const showImgPreview = cfg.preview && trimmed && !isCanvaShare && (!resolved || resolved.type === "image");
  const showEmbedNote = isImport && resolved && resolved.type === "embed";

  return (
    <div onMouseDown={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,.55)", backdropFilter: "blur(2px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onMouseDown={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: A.card, border: `1px solid ${A.border}`, borderRadius: 14, padding: 22, boxShadow: "0 20px 60px rgba(0,0,0,.45)" }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: A.bright || A.text, marginBottom: 6 }}>{cfg.title}</div>
        {cfg.hint && <div style={{ fontSize: 12, color: A.dim, lineHeight: 1.5, marginBottom: 14 }}>{cfg.hint}</div>}
        {isImport && cfg.onFile && (
          <>
            <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 12px", borderRadius: 10, border: `1.5px dashed ${A.accent}88`, background: A.accent + "10", color: A.bright || A.text, fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 6 }}>
              📄 Choose a PDF or image
              <input type="file" accept="application/pdf,image/*" style={{ display: "none" }} onChange={e => { const f = e.target.files?.[0]; if (f) { onClose(); cfg.onFile(f); } e.target.value = ""; }} />
            </label>
            <div style={{ fontSize: 10.5, color: A.dim, textAlign: "center", marginBottom: 12 }}>A multi-page PDF splits into one letter page per page.</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 12px" }}>
              <div style={{ flex: 1, height: 1, background: A.border }} /><span style={{ fontSize: 10, color: A.dim }}>or paste a link</span><div style={{ flex: 1, height: 1, background: A.border }} />
            </div>
          </>
        )}
        <input
          autoFocus={!isImport} value={val} onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && canAdd) onSubmit(); if (e.key === "Escape") onClose(); }}
          placeholder="https://…"
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, background: A.bg || "transparent", border: `1px solid ${A.border}`, color: A.text, fontSize: 14, outline: "none", boxSizing: "border-box" }}
        />
        {isCanvaShare && (
          <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 8, background: "#e0404014", border: "1px solid #e0404044", color: "#e57373", fontSize: 11.5, lineHeight: 1.5 }}>
            That’s a Canva <b>share link</b> — a web page, not an image. Use the <b>📎 Import</b> button to embed a Canva design, or in Canva do <b>Share → Download → PNG/JPG</b> and paste that image link here.
          </div>
        )}
        {showEmbedNote && (
          <div style={{ marginTop: 10, padding: "9px 11px", borderRadius: 8, background: A.accent + "14", border: `1px solid ${A.accent}44`, color: A.bright || A.text, fontSize: 11.5, lineHeight: 1.5 }}>
            Detected a <b>{resolved.label}</b> — a link embeds as <b>one interactive box</b> (the reader flips pages inside it), not separate letter pages. To split a multi-page design across pages, download it as a <b>PDF</b> and choose the file above. Either way, make sure it’s shared publicly.
          </div>
        )}
        {showImgPreview && (
          <div style={{ marginTop: 12, borderRadius: 8, overflow: "hidden", border: `1px solid ${A.border}`, background: A.bg || "#0008", minHeight: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {imgErr
              ? <div style={{ padding: 16, fontSize: 11.5, color: A.dim, textAlign: "center" }}>Couldn’t load that link as an image. Make sure it ends in .jpg / .png / .webp and is publicly viewable.</div>
              : <img src={trimmed} alt="" onError={() => setImgErr(true)} style={{ maxWidth: "100%", maxHeight: 180, display: "block" }} />}
          </div>
        )}
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={{ ...tb(A, false), padding: "8px 14px" }}>Cancel</button>
          <button onClick={onSubmit} disabled={!canAdd}
            style={{ padding: "8px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: canAdd ? "pointer" : "not-allowed", background: canAdd ? A.accent : A.border, color: canAdd ? (A.onAccent || "#fff") : A.dim, opacity: canAdd ? 1 : 0.6 }}>
            {showEmbedNote ? "Embed" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Sep({ A = A_DARK }) { return <span style={{ width: 1, background: A.border, margin: "2px 1px" }} />; }

// Full emoji picker (emoji-mart). Data + picker are lazy-loaded on first open.
function EmojiButton({ A = A_DARK, onPick }) {
  const [open, setOpen] = useState(false);
  const [mods, setMods] = useState(null);
  useEffect(() => {
    if (open && !mods) {
      Promise.all([import("@emoji-mart/data"), import("@emoji-mart/react")])
        .then(([d, p]) => setMods({ data: d.default, Picker: p.default }))
        .catch(() => {});
    }
  }, [open, mods]);
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (!e.target.closest?.(".lp-emoji")) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  return (
    <span className="lp-emoji" style={{ position: "relative" }}>
      <button style={tb(A, open)} title="Emoji" onClick={() => setOpen(o => !o)}>😊</button>
      {open && (
        <div style={{ position: "absolute", zIndex: 60, top: "115%", left: 0 }}>
          {mods ? <mods.Picker data={mods.data} theme="dark" previewPosition="none" onEmojiSelect={(e) => { onPick(e.native); setOpen(false); }} /> : <div style={{ padding: 10, fontSize: 11, color: A.dim, background: A.card, borderRadius: 8, border: `1px solid ${A.border}` }}>Loading emojis…</div>}
        </div>
      )}
    </span>
  );
}

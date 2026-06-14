// Pure helpers for the Tiptap document model (no React / client deps).
// A letter's content is a Tiptap (ProseMirror) JSON doc. "Read More" page
// breaks are `pagebreak` nodes; the reader splits the doc into pages on them.

// Split a Tiptap doc into an array of single-page docs at each pagebreak node.
export function splitDocIntoPages(doc) {
  const content = doc?.content || [];
  const pages = [[]];
  for (const node of content) {
    if (node.type === "pagebreak") pages.push([]);
    else pages[pages.length - 1].push(node);
  }
  const nonEmpty = pages.filter(p => p.length > 0);
  const groups = nonEmpty.length ? nonEmpty : [[]];
  return groups.map(c => ({ type: "doc", content: c }));
}

function text(s) { return s ? [{ type: "text", text: s }] : []; }
function para(s) { return { type: "paragraph", content: text(s) }; }

// Convert the legacy flat blocks[] model into a Tiptap doc.
export function blocksToDoc(blocks) {
  const content = [];
  for (const b of (blocks || [])) {
    switch (b.type) {
      case "heading": content.push({ type: "heading", attrs: { level: 2 }, content: text(b.content) }); break;
      case "quote": content.push({ type: "blockquote", content: [para(b.content + (b.meta?.author ? `  — ${b.meta.author}` : ""))] }); break;
      case "callout": content.push({ type: "blockquote", content: [para(`${b.meta?.emoji || "💡"} ${b.content}`)] }); break;
      case "code": content.push({ type: "codeBlock", attrs: { language: b.meta?.lang || null }, content: text(b.content) }); break;
      case "list": {
        const ordered = !!b.meta?.ordered;
        const items = (b.content || "").split("\n").filter(x => x.trim() !== "")
          .map(line => ({ type: "listItem", content: [para(line)] }));
        content.push({ type: ordered ? "orderedList" : "bulletList", content: items.length ? items : [{ type: "listItem", content: [para("")] }] });
        break;
      }
      case "image": if (b.content) content.push({ type: "image", attrs: { src: b.content, alt: b.meta?.caption || "" } }); break;
      case "video": if (b.content) content.push({ type: "video", attrs: { src: b.content, caption: b.meta?.caption || "" } }); break;
      case "embed": if (b.content) content.push({ type: "video", attrs: { src: b.content, caption: b.meta?.caption || "" } }); break;
      case "divider": content.push({ type: "horizontalRule" }); break;
      case "pagebreak": content.push({ type: "pagebreak" }); break;
      case "text":
      default: content.push(para(b.content || "")); break;
    }
  }
  if (!content.length) content.push(para(""));
  return { type: "doc", content };
}

// Fixed freestyle canvas width — coordinates are stored relative to this.
export const CANVAS_W = 600;

// Drop nodes whose type is no longer registered (legacy tldraw `drawing` /
// the old standalone `freeform` block, now replaced by document-wide freestyle).
function sanitizeDoc(doc) {
  const REMOVED = new Set(["drawing", "freeform"]);
  const content = (doc.content || []).filter(n => !REMOVED.has(n.type));
  return { type: "doc", content: content.length ? content : [para("")] };
}

// Is this page laid out freestyle? (any node carries a position)
export function isFreestylePage(pageDoc) {
  return (pageDoc?.content || []).some(n => n.attrs?.pos);
}

// Enter Canva mode: give every non-break block a position if it lacks one,
// stacking them down each page so nothing overlaps initially.
export function ensureFreestyle(doc) {
  let y = 30;
  const content = (doc.content || []).map(n => {
    if (n.type === "pagebreak") { y = 30; return n; }
    if (n.attrs?.pos) { y = Math.max(y, n.attrs.pos.y + (n.attrs.pos.h || 120) + 20); return n; }
    const pos = { x: 30, y, w: CANVAS_W - 60, h: null, rotate: 0 };
    y += 140;
    return { ...n, attrs: { ...(n.attrs || {}), pos } };
  });
  return { ...doc, content };
}

// Leave Canva mode: strip all positions, back to normal flow.
export function clearFreestyle(doc) {
  const content = (doc.content || []).map(n => {
    if (!n.attrs?.pos) return n;
    const { pos, ...rest } = n.attrs;
    return { ...n, attrs: rest };
  });
  return { ...doc, content };
}

// Return the letter's Tiptap doc, converting from legacy blocks if needed.
export function getLetterDoc(letter) {
  if (letter?.doc && letter.doc.type === "doc") return sanitizeDoc(letter.doc);
  if (Array.isArray(letter?.blocks) && letter.blocks.length) return blocksToDoc(letter.blocks);
  return { type: "doc", content: [para("")] };
}

// Map a theme object to CSS custom properties for the reader/editor content area.
export function themeToVars(t) {
  return {
    "--lp-bg": t.bg,
    "--lp-surface": t.surface || t.bg,
    "--lp-text": t.text,
    "--lp-accent": t.accent,
    "--lp-dim": t.dim,
    "--lp-divider": t.divider,
    "--lp-quote-bg": t.quoteBg || "transparent",
    "--lp-code-bg": t.codeBg || "#0a0a0a",
    "--lp-heading-font": t.headingFont,
    "--lp-body-font": t.bodyFont,
    "--lp-code-font": t.codeFont || "monospace",
    "--lp-base-size": (t.baseFontSize || 19) + "px",
  };
}

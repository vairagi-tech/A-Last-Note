"use client";

import { getYouTubeId } from "@/lib/utils";

// Lightweight inline markdown → React nodes (no dependency).
// Supports **bold**, __bold__, *italic*, _italic_, `code`, [label](url).
function renderInline(text, t) {
  if (!text || typeof text !== "string") return text;
  const re = /(\*\*([^*]+)\*\*|__([^_]+)__|\*([^*]+)\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;
  const out = [];
  let last = 0, m, k = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[2] != null || m[3] != null) out.push(<strong key={k++}>{m[2] ?? m[3]}</strong>);
    else if (m[4] != null || m[5] != null) out.push(<em key={k++}>{m[4] ?? m[5]}</em>);
    else if (m[6] != null) out.push(<code key={k++} style={{ fontFamily: t.codeFont || "monospace", background: t.quoteBg || "rgba(128,128,128,.15)", padding: "1px 5px", borderRadius: 4, fontSize: "0.9em" }}>{m[6]}</code>);
    else if (m[7] != null) out.push(<a key={k++} href={m[8]} target="_blank" rel="noreferrer" style={{ color: t.accent, textDecoration: "underline" }}>{m[7]}</a>);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// Merge per-block style overrides over a computed base style.
// Unset keys fall through to the base (which itself draws from the theme).
function withOverrides(base, style = {}) {
  const o = { ...base };
  if (style.color) o.color = style.color;
  if (style.bg) o.background = style.bg;
  if (style.fontFamily) o.fontFamily = style.fontFamily;
  if (style.fontSize) o.fontSize = Number(style.fontSize);
  if (style.lineHeight) o.lineHeight = Number(style.lineHeight);
  if (style.letterSpacing != null && style.letterSpacing !== "") o.letterSpacing = Number(style.letterSpacing);
  if (style.align) o.textAlign = style.align;
  if (style.bold) o.fontWeight = 700;
  if (style.italic != null) o.fontStyle = style.italic ? "italic" : "normal";
  if (style.marginBottom != null && style.marginBottom !== "") o.marginBottom = Number(style.marginBottom);
  if (style.padding != null && style.padding !== "") o.padding = Number(style.padding);
  if (style.radius != null && style.radius !== "") o.borderRadius = Number(style.radius);
  return o;
}

export default function BlockRenderer({ block, theme }) {
  const t = theme;
  const s = block.style || {};

  // Positioning wrapper (popped-out free placement)
  const wrapStyle = block.position
    ? {
        position: "absolute",
        left: block.position.x,
        top: block.position.y,
        width: block.position.width || "auto",
        height: block.position.height || "auto",
        zIndex: block.position.z ?? 2,
      }
    : { position: "relative" };

  const inner = () => {
    switch (block.type) {
      case "text":
        return (
          <p style={withOverrides({
            color: t.text, fontSize: t.baseFontSize || 19, fontWeight: 300, lineHeight: 2.1,
            fontStyle: "italic", whiteSpace: "pre-wrap", marginBottom: 28, fontFamily: t.bodyFont,
          }, s)}>
            {renderInline(block.content, t)}
          </p>
        );

      case "heading":
        return (
          <h2 style={withOverrides({
            color: t.text, fontSize: 30, fontWeight: 500, lineHeight: 1.3,
            marginBottom: 20, marginTop: 8, fontFamily: t.headingFont, whiteSpace: "pre-wrap",
          }, s)}>
            {renderInline(block.content, t)}
          </h2>
        );

      case "image":
        return (
          <div style={{ marginBottom: s.marginBottom != null && s.marginBottom !== "" ? Number(s.marginBottom) : 28, textAlign: s.align || block.meta?.align || "center" }}>
            {block.content && (
              <img
                src={block.content}
                alt={block.meta?.caption || ""}
                style={{
                  maxWidth: "100%", borderRadius: s.radius != null && s.radius !== "" ? Number(s.radius) : 8,
                  border: `1px solid ${t.divider}`,
                  maxHeight: block.meta?.maxHeight || 400,
                  objectFit: "cover",
                }}
                onError={e => { e.target.style.display = "none"; }}
              />
            )}
            {block.meta?.caption && (
              <p style={{ color: t.dim, fontSize: 12, marginTop: 8, fontStyle: "italic", fontFamily: t.bodyFont }}>
                {block.meta.caption}
              </p>
            )}
          </div>
        );

      case "code":
        return (
          <div style={{ marginBottom: 28 }}>
            {block.meta?.lang && (
              <span style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: t.dim, marginBottom: 6, display: "block" }}>
                {block.meta.lang}
              </span>
            )}
            <pre style={withOverrides({
              background: t.codeBg || "#0a0a0a",
              border: `1px solid ${t.divider}`,
              borderRadius: 8, padding: 16, color: t.text,
              fontSize: 13, fontFamily: t.codeFont || "'JetBrains Mono', monospace",
              lineHeight: 1.7, overflow: "auto", whiteSpace: "pre-wrap",
            }, s)}>
              {block.content}
            </pre>
          </div>
        );

      case "quote":
        return (
          <blockquote style={withOverrides({
            background: t.quoteBg || "transparent",
            borderLeft: `3px solid ${(s.color || t.accent)}40`,
            padding: "16px 20px", marginBottom: 28,
            borderRadius: "0 8px 8px 0",
          }, { bg: s.bg, marginBottom: s.marginBottom, padding: s.padding, radius: s.radius })}>
            <p style={withOverrides({
              color: t.text, fontSize: 18, fontStyle: "italic",
              lineHeight: 1.9, fontFamily: t.headingFont,
            }, s)}>
              {renderInline(block.content, t)}
            </p>
            {block.meta?.author && (
              <cite style={{ color: t.dim, fontSize: 13, display: "block", marginTop: 8, fontStyle: "normal" }}>
                — {block.meta.author}
              </cite>
            )}
          </blockquote>
        );

      case "list": {
        const items = (block.content || "").split("\n").filter(x => x.trim() !== "");
        const Tag = block.meta?.ordered ? "ol" : "ul";
        return (
          <Tag style={withOverrides({
            color: t.text, fontSize: t.baseFontSize || 18, lineHeight: 1.9,
            fontFamily: t.bodyFont, marginBottom: 28, paddingLeft: 24,
          }, s)}>
            {items.map((it, i) => <li key={i} style={{ marginBottom: 6 }}>{renderInline(it, t)}</li>)}
          </Tag>
        );
      }

      case "callout":
        return (
          <div style={withOverrides({
            display: "flex", gap: 12, alignItems: "flex-start",
            background: t.quoteBg || `${t.accent}10`,
            border: `1px solid ${t.divider}`,
            borderRadius: 10, padding: "14px 16px", marginBottom: 28,
          }, { bg: s.bg, marginBottom: s.marginBottom, padding: s.padding, radius: s.radius })}>
            <span style={{ fontSize: 20, lineHeight: 1.4 }}>{block.meta?.emoji || "💡"}</span>
            <p style={withOverrides({
              color: t.text, fontSize: 16, lineHeight: 1.7, fontFamily: t.bodyFont, whiteSpace: "pre-wrap",
            }, s)}>
              {renderInline(block.content, t)}
            </p>
          </div>
        );

      case "divider":
        return (
          <div style={{
            width: "100%", height: 1,
            background: `linear-gradient(to right, transparent, ${s.color || t.divider}, transparent)`,
            margin: `${s.marginBottom != null && s.marginBottom !== "" ? Number(s.marginBottom) : 24}px 0`,
          }} />
        );

      case "video": {
        const ytId = getYouTubeId(block.content);
        if (!ytId && !block.content) return null;
        return (
          <div style={{ marginBottom: 28 }}>
            {ytId ? (
              <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${t.divider}` }}>
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?rel=0`}
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <video
                src={block.content}
                controls
                style={{ maxWidth: "100%", borderRadius: 8, border: `1px solid ${t.divider}` }}
              />
            )}
            {block.meta?.caption && (
              <p style={{ color: t.dim, fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
                {block.meta.caption}
              </p>
            )}
          </div>
        );
      }

      case "embed": {
        if (!block.content) return null;
        return (
          <div style={{ marginBottom: 28 }}>
            <div style={{ position: "relative", paddingBottom: "60%", height: 0, borderRadius: 8, overflow: "hidden", border: `1px solid ${t.divider}` }}>
              <iframe
                src={block.content}
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                allowFullScreen
              />
            </div>
            {block.meta?.caption && (
              <p style={{ color: t.dim, fontSize: 12, marginTop: 8, fontStyle: "italic" }}>
                {block.meta.caption}
              </p>
            )}
          </div>
        );
      }

      case "pagebreak":
        // Page breaks are structural — the reader splits on them, never renders them.
        return null;

      default:
        return null;
    }
  };

  const content = inner();
  if (content === null) return null;
  return <div style={wrapStyle}>{content}</div>;
}

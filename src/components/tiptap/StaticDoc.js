"use client";

import { Fragment } from "react";
import AudioPlayer from "@/components/tiptap/AudioPlayer";
import { DecorationGlyph } from "@/components/tiptap/decorations";
import { getYouTubeId } from "@/lib/utils";

// Lightweight read-only renderer for the Tiptap/ProseMirror JSON. The reader used
// to mount a full Tiptap EDITOR per chunk just to display text — heavy, and it
// pulled the whole editor library into the reader bundle. This renders the same
// markup as plain React (no editor), so the reader is far faster with no visual
// change. Output mirrors the editor extensions exactly.

// Wrap a text node's value in its marks (bold/italic/strike/code/highlight) and
// textStyle (colour/font). Composition order is visually equivalent for these.
function Marked({ node }) {
  let out = node.text;
  const style = {};
  for (const m of node.marks || []) {
    const a = m.attrs || {};
    switch (m.type) {
      case "bold": out = <strong>{out}</strong>; break;
      case "italic": out = <em>{out}</em>; break;
      case "strike": out = <s>{out}</s>; break;
      case "code": out = <code>{out}</code>; break;
      case "highlight": out = <mark style={a.color ? { backgroundColor: a.color } : undefined}>{out}</mark>; break;
      case "textStyle":
        if (a.color) style.color = a.color;
        if (a.fontFamily) style.fontFamily = a.fontFamily;
        break;
      default: break;
    }
  }
  if (Object.keys(style).length) out = <span style={style}>{out}</span>;
  return out;
}

function Inline({ content }) {
  return (content || []).map((n, i) => {
    if (n.type === "text") return <Fragment key={i}><Marked node={n} /></Fragment>;
    if (n.type === "hardBreak") return <br key={i} />;
    return null;
  });
}

function VideoNode({ attrs }) {
  const src = attrs.src; const yt = getYouTubeId(src);
  return (
    <div style={{ margin: "16px 0" }}>
      {yt ? (
        <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--lp-divider,#2a2d3e)" }}>
          <iframe src={`https://www.youtube.com/embed/${yt}?rel=0`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      ) : src ? (
        <video src={src} controls style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--lp-divider,#2a2d3e)" }} />
      ) : <div style={{ padding: 12, color: "var(--lp-dim,#888)", fontSize: 12 }}>Empty video</div>}
      {attrs.caption && <p style={{ color: "var(--lp-dim,#888)", fontSize: 12, marginTop: 6, fontStyle: "italic" }}>{attrs.caption}</p>}
    </div>
  );
}

function EmbedNode({ attrs }) {
  const { src, ratio } = attrs;
  return (
    <div style={{ margin: "16px 0" }}>
      {src ? (
        <div style={{ position: "relative", paddingBottom: `${ratio || 75}%`, height: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--lp-divider,#2a2d3e)", background: "rgba(128,128,128,.06)" }}>
          <iframe src={src} loading="lazy" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} />
        </div>
      ) : <div style={{ padding: 12, color: "var(--lp-dim,#888)", fontSize: 12 }}>Empty embed</div>}
    </div>
  );
}

function Block({ node }) {
  const a = node.attrs || {};
  const align = a.textAlign && a.textAlign !== "left" ? { textAlign: a.textAlign } : undefined;
  switch (node.type) {
    case "paragraph": return <p style={align}><Inline content={node.content} /></p>;
    case "heading": { const Tag = `h${a.level || 1}`; return <Tag style={align}><Inline content={node.content} /></Tag>; }
    case "bulletList": return <ul>{(node.content || []).map((n, i) => <Block key={i} node={n} />)}</ul>;
    case "orderedList": return <ol>{(node.content || []).map((n, i) => <Block key={i} node={n} />)}</ol>;
    case "listItem": return <li>{(node.content || []).map((n, i) => <Block key={i} node={n} />)}</li>;
    case "blockquote": return <blockquote>{(node.content || []).map((n, i) => <Block key={i} node={n} />)}</blockquote>;
    case "codeBlock": return <pre><code><Inline content={node.content} /></code></pre>;
    case "horizontalRule": return <hr />;
    case "hardBreak": return <br />;
    case "image": return (
      <img
        src={a.src}
        alt={a.alt || ""}
        loading="lazy"
        decoding="async"
        {...(a.width && a.height ? { width: a.width, height: a.height } : {})}
        style={a.width && a.height ? { aspectRatio: `${a.width} / ${a.height}`, height: "auto" } : undefined}
        {...(a.bleed ? { "data-bleed": "true" } : {})}
      />
    );
    case "video": return <VideoNode attrs={a} />;
    case "embed": return <EmbedNode attrs={a} />;
    case "audio": return <div style={{ margin: "14px 0" }}><AudioPlayer src={a.src} title={a.title} color={a.color} interactive /></div>;
    case "decoration": return <span style={{ display: "inline-block", width: 30, height: 30, verticalAlign: "middle", margin: "0 2px" }}><DecorationGlyph kind={a.kind} variant={a.variant} color={a.color} content={a.content} /></span>;
    default: return null;
  }
}

export default function StaticDoc({ doc, innerRef }) {
  const content = doc?.type === "doc" ? doc.content : Array.isArray(doc) ? doc : doc ? [doc] : [];
  return (
    <div className="lp-read" ref={innerRef}>
      {(content || []).filter(n => n.type !== "pagebreak").map((n, i) => <Block key={i} node={n} />)}
    </div>
  );
}

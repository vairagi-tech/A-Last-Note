"use client";

import { Node, Extension, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle } from "@tiptap/extension-text-style";
import { Color } from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import { FontFamily } from "@tiptap/extension-font-family";
import { DecorationGlyph } from "@/components/tiptap/decorations";
import AudioPlayer from "@/components/tiptap/AudioPlayer";
import { getYouTubeId } from "@/lib/utils";

// ─── Read More page break ───
function PagebreakView() {
  return (
    <NodeViewWrapper contentEditable={false}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "8px 0", userSelect: "none" }}>
        <div style={{ flex: 1, height: 1, background: "repeating-linear-gradient(90deg,#e0404066 0 6px,transparent 6px 12px)" }} />
        <span style={{ fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#e04040" }}>✂ Read More — new page</span>
        <div style={{ flex: 1, height: 1, background: "repeating-linear-gradient(90deg,#e0404066 0 6px,transparent 6px 12px)" }} />
      </div>
    </NodeViewWrapper>
  );
}
export const Pagebreak = Node.create({
  name: "pagebreak", group: "block", atom: true, selectable: true,
  parseHTML() { return [{ tag: "div[data-pagebreak]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-pagebreak": "" })]; },
  addNodeView() { return ReactNodeViewRenderer(PagebreakView); },
});

// ─── Video / embed (real renderHTML so it renders even outside a node view) ───
function VideoView({ node }) {
  const src = node.attrs.src; const yt = getYouTubeId(src);
  return (
    <NodeViewWrapper contentEditable={false}>
      <div style={{ margin: "16px 0" }}>
        {yt ? (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--lp-divider,#2a2d3e)" }}>
            <iframe src={`https://www.youtube.com/embed/${yt}?rel=0`} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
          </div>
        ) : src ? (
          <video src={src} controls style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--lp-divider,#2a2d3e)" }} />
        ) : <div style={{ padding: 12, color: "var(--lp-dim,#888)", fontSize: 12 }}>Empty video</div>}
        {node.attrs.caption && <p style={{ color: "var(--lp-dim,#888)", fontSize: 12, marginTop: 6, fontStyle: "italic" }}>{node.attrs.caption}</p>}
      </div>
    </NodeViewWrapper>
  );
}
export const Video = Node.create({
  name: "video", group: "block", atom: true, selectable: true,
  addAttributes() { return { src: { default: "" }, caption: { default: "" } }; },
  parseHTML() { return [{ tag: "div[data-video]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-video": "" })]; },
  addNodeView() { return ReactNodeViewRenderer(VideoView); },
});

// ─── Embed: a PDF / Canva design / Drive doc shown in a responsive iframe ───
// Used by "Import" when the link can't be a plain <img> (PDFs, Canva designs,
// Google Drive files). `ratio` is the bottom-padding % that sets aspect ratio.
function EmbedView({ node }) {
  const { src, ratio } = node.attrs;
  return (
    <NodeViewWrapper contentEditable={false}>
      <div style={{ margin: "16px 0" }}>
        {src ? (
          <div style={{ position: "relative", paddingBottom: `${ratio || 75}%`, height: 0, borderRadius: 8, overflow: "hidden", border: "1px solid var(--lp-divider,#2a2d3e)", background: "rgba(128,128,128,.06)" }}>
            <iframe src={src} loading="lazy" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} />
          </div>
        ) : <div style={{ padding: 12, color: "var(--lp-dim,#888)", fontSize: 12 }}>Empty embed</div>}
      </div>
    </NodeViewWrapper>
  );
}
export const Embed = Node.create({
  name: "embed", group: "block", atom: true, selectable: true,
  addAttributes() { return { src: { default: "" }, ratio: { default: 75 } }; },
  parseHTML() { return [{ tag: "div[data-embed]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-embed": "" })]; },
  addNodeView() { return ReactNodeViewRenderer(EmbedView); },
});

// ─── Decoration: a sticker/shape/doodle/washi/emoji placed on the canvas ───
function DecorationView({ node }) {
  return (
    <NodeViewWrapper as="span" contentEditable={false} style={{ display: "inline-block", width: 30, height: 30, verticalAlign: "middle", margin: "0 2px" }}>
      <DecorationGlyph kind={node.attrs.kind} variant={node.attrs.variant} color={node.attrs.color} content={node.attrs.content} />
    </NodeViewWrapper>
  );
}
export const Decoration = Node.create({
  name: "decoration", group: "block", atom: true, selectable: true, draggable: false,
  addAttributes() {
    return {
      kind: { default: "shape" }, variant: { default: "heart" }, color: { default: "#e06a86" }, content: { default: "" },
    };
  },
  parseHTML() { return [{ tag: "div[data-decoration]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-decoration": "" })]; },
  addNodeView() { return ReactNodeViewRenderer(DecorationView); },
});

// ─── Audio: a voice note / music as a styled, placeable player ───
function AudioView({ node }) {
  return (
    <NodeViewWrapper contentEditable={false}>
      <div style={{ margin: "14px 0" }}>
        <AudioPlayer src={node.attrs.src} title={node.attrs.title} color={node.attrs.color} interactive />
      </div>
    </NodeViewWrapper>
  );
}
export const Audio = Node.create({
  name: "audio", group: "block", atom: true, selectable: true, draggable: false,
  addAttributes() { return { src: { default: "" }, title: { default: "Audio" }, color: { default: "#7c6cf0" } }; },
  parseHTML() { return [{ tag: "div[data-audio]" }]; },
  renderHTML({ HTMLAttributes }) { return ["div", mergeAttributes(HTMLAttributes, { "data-audio": "" })]; },
  addNodeView() { return ReactNodeViewRenderer(AudioView); },
});

// ─── Global `pos` attribute: lets ANY block carry a freestyle position ───
// {x, y, w, h, rotate}. Kept in the JSON doc, never serialized to HTML, ignored
// during normal flow editing — the reader/board apply it as "CSS".
export const PosAttribute = Extension.create({
  name: "posAttribute",
  addGlobalAttributes() {
    return [{
      types: ["paragraph", "heading", "blockquote", "bulletList", "orderedList", "codeBlock", "image", "video", "embed", "horizontalRule", "decoration", "audio"],
      attributes: { pos: { default: null, rendered: false } },
    }];
  },
});

// Imported designs carry `bleed: true`, which renders the image full-width with
// no card border/radius — so a Canva export looks like the letter itself, not an
// attachment pasted into it. Rendered as data-bleed for the CSS in proseStyles.
const BleedImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      bleed: {
        default: false,
        parseHTML: el => el.getAttribute("data-bleed") === "true",
        renderHTML: attrs => (attrs.bleed ? { "data-bleed": "true" } : {}),
      },
    };
  },
});

// Shared extension set for the editor and the read-only reader.
export function buildExtensions() {
  return [
    StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
    TextStyle, Color, Highlight.configure({ multicolor: true }), FontFamily,
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    BleedImage.configure({ inline: false, allowBase64: true }),
    Pagebreak, Video, Embed, Decoration, Audio, PosAttribute,
  ];
}

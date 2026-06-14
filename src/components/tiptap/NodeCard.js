"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { buildExtensions } from "@/components/tiptap/extensions";

// Renders a single Tiptap node (a "chunk") read-only, reusing all extensions
// so images, video and rich text render exactly as authored. The node's own
// freestyle position is stripped here — the wrapper handles placement.
export default function NodeCard({ node }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: buildExtensions(),
    content: { type: "doc", content: [{ ...node, attrs: { ...(node.attrs || {}), pos: null } }] },
    editorProps: { attributes: { class: "lp-read" } },
  });
  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

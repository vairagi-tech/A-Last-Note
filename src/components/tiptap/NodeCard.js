"use client";

import StaticDoc from "@/components/tiptap/StaticDoc";

// Renders a single node (a "chunk") read-only via the lightweight StaticDoc
// renderer — no editor instance. The node's freestyle position is stripped here;
// the wrapper handles placement.
export default function NodeCard({ node }) {
  return <StaticDoc doc={{ type: "doc", content: [{ ...node, attrs: { ...(node.attrs || {}), pos: null } }] }} />;
}

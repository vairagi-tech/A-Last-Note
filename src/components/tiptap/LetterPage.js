"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { buildExtensions } from "@/components/tiptap/extensions";
import { applyBlockReveal, wrapWords, applyWordAnim } from "@/components/tiptap/storyAnim";

const TEXTY = /^(P|H1|H2|H3|BLOCKQUOTE|LI|UL|OL)$/;

// Renders one reader page (a sub-doc) read-only, then plays the Story animations:
// per-block reveals and optional per-word text effects, staggered.
export default function LetterPage({ pageDoc, anim }) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: false,
    extensions: buildExtensions(),
    content: pageDoc || { type: "doc", content: [] },
    editorProps: { attributes: { class: "lp-read" } },
  });

  useEffect(() => {
    if (!editor || !anim) return;
    const hasBlock = anim.blockReveal && anim.blockReveal !== "none";
    const hasWord = anim.wordAnim && anim.wordAnim !== "none";
    const hasBreath = !hasBlock && anim.breathPace > 0;
    if (!hasBlock && !hasWord && !hasBreath) return;
    const tm = setTimeout(() => {
      const root = editor.view?.dom;
      const blocks = root ? Array.from(root.children) : [];
      blocks.forEach((blk, bi) => {
        const blockDelay = bi * anim.revealStagger;
        const isText = TEXTY.test(blk.tagName) || blk.querySelector("p,h1,h2,h3,li,blockquote");
        if (hasWord && isText) {
          const spans = wrapWords(blk);
          applyWordAnim(spans, anim.wordAnim, blockDelay, anim.wordStagger);
        } else if (hasBlock) {
          applyBlockReveal(blk, anim.blockReveal, blockDelay);
        } else if (hasBreath) {
          applyBlockReveal(blk, "fade", bi * anim.breathPace);
        }
      });
    }, 130);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  if (!editor) return null;
  return <EditorContent editor={editor} />;
}

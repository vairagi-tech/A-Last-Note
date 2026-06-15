"use client";

import { useEffect, useRef } from "react";
import StaticDoc from "@/components/tiptap/StaticDoc";
import { applyBlockReveal, wrapWords, applyWordAnim } from "@/components/tiptap/storyAnim";

const TEXTY = /^(P|H1|H2|H3|BLOCKQUOTE|LI|UL|OL)$/;

// Renders one reader page (a sub-doc) read-only via the lightweight StaticDoc
// renderer (no editor), then plays the Story animations on the rendered blocks:
// per-block reveals and optional per-word text effects, staggered.
// Beyond this many words on a page, per-word wrapping/animation creates too many
// DOM nodes to animate smoothly on a phone — fall back to a block-level reveal.
const WORD_ANIM_CAP = 120;

export default function LetterPage({ pageDoc, anim, lite }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !anim) return;
    // Under reduced-motion / coarse-pointer (`lite`), skip per-word animation
    // entirely and let blocks just fade — the content is identical, only cheaper.
    const hasBlock = anim.blockReveal && anim.blockReveal !== "none";
    const hasWord = !lite && anim.wordAnim && anim.wordAnim !== "none";
    const hasBreath = !hasBlock && anim.breathPace > 0;
    if (!hasBlock && !hasWord && !hasBreath) return;
    const tm = setTimeout(() => {
      const root = ref.current;
      if (!root) return;
      // Guard: very long pages get a block reveal instead of word-by-word.
      const wordCount = (root.textContent || "").trim().split(/\s+/).length;
      const wordOK = hasWord && wordCount <= WORD_ANIM_CAP;
      const blocks = Array.from(root.children);
      blocks.forEach((blk, bi) => {
        const blockDelay = bi * anim.revealStagger;
        const isText = TEXTY.test(blk.tagName) || blk.querySelector("p,h1,h2,h3,li,blockquote");
        if (wordOK && isText) {
          const spans = wrapWords(blk);
          applyWordAnim(spans, anim.wordAnim, blockDelay, anim.wordStagger);
        } else if (hasBlock || hasWord) {
          applyBlockReveal(blk, hasBlock ? anim.blockReveal : "fade", blockDelay);
        } else if (hasBreath) {
          applyBlockReveal(blk, "fade", bi * anim.breathPace);
        }
      });
    }, 130);
    return () => clearTimeout(tm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageDoc, anim, lite]);

  return <StaticDoc doc={pageDoc} innerRef={ref} />;
}

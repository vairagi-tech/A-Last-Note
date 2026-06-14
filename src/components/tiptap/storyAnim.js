"use client";

// Reader "Story" animations — block-level reveals and per-word text effects.

export const STORY_KEYFRAMES = `
@keyframes lpFade{from{opacity:0}to{opacity:1}}
@keyframes lpSlideUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@keyframes lpZoom{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:none}}
@keyframes lpSlideL{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
@keyframes lpSlideR{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
@keyframes lpWave{0%{opacity:0;transform:translateY(11px)}55%{opacity:1;transform:translateY(-7px)}100%{transform:translateY(0)}}
@keyframes lpBounce{0%{opacity:0;transform:translateY(20px)}60%{opacity:1;transform:translateY(-7px)}80%{transform:translateY(2px)}100%{transform:translateY(0)}}
@keyframes lpFloatLoop{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
`;

const BLOCK = { fade: "lpFade", slideUp: "lpSlideUp", zoom: "lpZoom", slideLeft: "lpSlideL", slideRight: "lpSlideR", float: "lpFade", bounce: "lpBounce", wave: "lpWave" };
const WORD = { fade: "lpFade", slideUp: "lpSlideUp", wave: "lpWave", bounce: "lpBounce", typewriter: "lpFade" };

export function StoryStyles() { return <style>{STORY_KEYFRAMES}</style>; }

// Returns the inline `animation` string for a block-level reveal (used by JSX).
export function blockRevealStyle(anim, delay) {
  const name = BLOCK[anim];
  if (!name) return undefined;
  const base = `${name} .62s cubic-bezier(.2,.7,.3,1) ${delay}s both`;
  return anim === "float" ? `${base}, lpFloatLoop 3.6s ease-in-out ${(delay + 0.62).toFixed(2)}s infinite` : base;
}

// Imperatively reveal a DOM block (sets opacity:0 then the staggered animation).
export function applyBlockReveal(el, anim, delay) {
  const css = blockRevealStyle(anim, delay);
  if (!css) return;
  el.style.opacity = "0";
  el.style.animation = css;
}

// Wrap each word of a block in an inline-block span (for per-word animation).
export function wrapWords(el) {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  const spans = [];
  for (const tn of textNodes) {
    if (!tn.textContent || !tn.parentNode) continue;
    const parts = tn.textContent.split(/(\s+)/);
    const frag = document.createDocumentFragment();
    for (const part of parts) {
      if (part === "") continue;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
      const s = document.createElement("span");
      s.textContent = part;
      s.style.display = "inline-block";
      s.style.whiteSpace = "pre";
      frag.appendChild(s);
      spans.push(s);
    }
    tn.parentNode.replaceChild(frag, tn);
  }
  return spans;
}

export function applyWordAnim(spans, anim, baseDelay, stagger) {
  const name = WORD[anim];
  if (!name) return;
  const dur = anim === "typewriter" ? 0.02 : 0.5;
  spans.forEach((s, i) => {
    s.style.opacity = "0";
    s.style.animation = `${name} ${dur}s ease ${(baseDelay + i * stagger).toFixed(3)}s both`;
  });
}

// Normalize the experience settings into a concrete anim config.
export function animConfig(exp = {}) {
  return {
    blockReveal: exp.blockReveal || "none",
    revealStagger: exp.revealStagger != null ? Number(exp.revealStagger) : (exp.breathPace ? Number(exp.breathPace) : 0.12),
    wordAnim: exp.wordAnim || "none",
    wordStagger: exp.wordStagger != null ? Number(exp.wordStagger) : 0.04,
    breathPace: Number(exp.breathPace) || 0,
  };
}

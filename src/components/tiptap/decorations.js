"use client";

// Decorative elements you drop on the Canva surface — shapes, doodles, washi
// tape, emoji stickers, lines. Rendered the same in the editor and the reader.

const fillStyle = { width: "100%", height: "100%", display: "block" };

function Svg({ children, ...rest }) {
  return <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" style={fillStyle} {...rest}>{children}</svg>;
}

function washiBg(color) {
  return `repeating-linear-gradient(45deg, ${color}cc 0 10px, ${color}99 10px 20px)`;
}

// Renders a single decoration to fill its container (the positioned box).
export function DecorationGlyph({ kind, variant, color, content }) {
  const c = color || "#e0a0a8";

  if (kind === "img") {
    return <img src={content} alt="" draggable={false} style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", pointerEvents: "none" }} />;
  }
  const stroke = { fill: "none", stroke: c, strokeWidth: 5, strokeLinecap: "round", strokeLinejoin: "round" };

  if (kind === "washi") {
    return <div style={{ width: "100%", height: "100%", background: washiBg(c), borderRadius: 2, boxShadow: "0 1px 4px rgba(0,0,0,.12)" }} />;
  }
  if (kind === "emoji") {
    return <Svg><text x="50" y="55" fontSize="80" textAnchor="middle" dominantBaseline="central">{content || "✨"}</text></Svg>;
  }
  if (kind === "line") {
    return <Svg><line x1="4" y1="50" x2="96" y2="50" {...stroke} strokeDasharray={variant === "dashed" ? "8 8" : undefined} /></Svg>;
  }
  if (kind === "doodle") {
    switch (variant) {
      case "arrow":
        return <Svg><path d="M12 32 C 34 76, 60 80, 84 52" {...stroke} /><path d="M84 52 l -3 -16 M84 52 l -16 5" {...stroke} /></Svg>;
      case "underline":
        return <Svg><path d="M6 58 Q 28 44, 50 58 T 94 56" {...stroke} /></Svg>;
      case "squiggle":
        return <Svg><path d="M8 50 C 22 18, 36 82, 50 50 S 78 18, 92 50" {...stroke} /></Svg>;
      case "sparkle":
        return <Svg><g {...stroke}><path d="M50 8 V92" /><path d="M8 50 H92" /><path d="M22 22 L78 78" /><path d="M78 22 L22 78" /></g></Svg>;
      default:
        return <Svg><path d="M50 8 V92 M8 50 H92" {...stroke} /></Svg>;
    }
  }
  // shapes (filled)
  switch (variant) {
    case "heart":
      return <Svg><path d="M50 84C20 62 8 44 8 28A20 20 0 0 1 50 20 20 20 0 0 1 92 28C92 44 80 62 50 84Z" fill={c} /></Svg>;
    case "star":
      return <Svg><path d="M50 6 61 38 95 38 67 58 78 92 50 72 22 92 33 58 5 38 39 38Z" fill={c} /></Svg>;
    case "circle":
      return <Svg><circle cx="50" cy="50" r="42" fill={c} /></Svg>;
    case "square":
      return <Svg><rect x="12" y="12" width="76" height="76" rx="12" fill={c} /></Svg>;
    case "blob":
      return <Svg><path d="M64 12C80 16 93 30 90 48 87 66 95 78 80 88 65 98 44 92 30 84 16 76 6 62 10 46 14 30 8 14 26 9 44 4 48 8 64 12Z" fill={c} /></Svg>;
    default:
      return <Svg><circle cx="50" cy="50" r="42" fill={c} /></Svg>;
  }
}

// Curated Microsoft Fluent 3D emoji (self-hosted in /public/stickers/3d).
const FLUENT_3D = [
  "red_heart", "sparkling_heart", "two_hearts", "growing_heart", "revolving_hearts", "heart_with_ribbon", "love_letter",
  "sparkles", "star", "glowing_star", "cherry_blossom", "rose", "bouquet", "hibiscus", "butterfly",
  "sun", "sun_with_face", "crescent_moon", "cloud", "rainbow", "fire", "dove", "four_leaf_clover", "maple_leaf", "snowflake",
  "party_popper", "balloon", "birthday_cake", "wrapped_gift", "confetti_ball", "ribbon", "teddy_bear",
  "smiling_face_with_hearts", "musical_notes", "candle",
];

// The palette shown in Canva mode. Grouped for a clean picker.
export const DECO_GROUPS = [
  {
    label: "3D Stickers",
    items: FLUENT_3D.map(n => ({ kind: "img", variant: n, content: `/stickers/3d/${n}.png`, color: "", w: 90, h: 90 })),
  },
  {
    label: "Shapes",
    items: [
      { kind: "shape", variant: "heart", color: "#e06a86", w: 110, h: 100 },
      { kind: "shape", variant: "star", color: "#e0a83a", w: 110, h: 110 },
      { kind: "shape", variant: "circle", color: "#7aa8e0", w: 100, h: 100 },
      { kind: "shape", variant: "blob", color: "#8ad0a8", w: 120, h: 120 },
      { kind: "shape", variant: "square", color: "#b89ae0", w: 100, h: 100 },
    ],
  },
  {
    label: "Doodles",
    items: [
      { kind: "doodle", variant: "arrow", color: "#e0a83a", w: 150, h: 110 },
      { kind: "doodle", variant: "underline", color: "#7c6cf0", w: 180, h: 50 },
      { kind: "doodle", variant: "squiggle", color: "#e06a86", w: 150, h: 80 },
      { kind: "doodle", variant: "sparkle", color: "#7c6cf0", w: 90, h: 90 },
    ],
  },
  {
    label: "Lines",
    items: [
      { kind: "line", variant: "solid", color: "#9499a4", w: 200, h: 20 },
      { kind: "line", variant: "dashed", color: "#9499a4", w: 200, h: 20 },
    ],
  },
  {
    label: "Washi tape",
    items: [
      { kind: "washi", variant: "pink", color: "#e8a0b4", w: 170, h: 44 },
      { kind: "washi", variant: "mint", color: "#9ad8bc", w: 170, h: 44 },
      { kind: "washi", variant: "amber", color: "#e8c878", w: 170, h: 44 },
    ],
  },
  {
    label: "Stickers",
    items: ["✨", "🌸", "❤️", "⭐", "🔥", "🦋", "🌙", "☁️", "💌", "🕊️", "🌟", "🥹"].map(e => ({ kind: "emoji", variant: "emoji", content: e, color: "", w: 84, h: 84 })),
  },
];

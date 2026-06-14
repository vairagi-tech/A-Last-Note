export const THEMES = {
  darkAmber: {
    name: "Dark Amber", icon: "🕯️",
    bg: "#060402", surface: "#0e0a06", text: "#d4c4a8", accent: "#b07840",
    dim: "#4a3828", divider: "#2a1e14",
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Crimson Pro', Georgia, serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: true, glowColor: "rgba(120,60,20,0.1)",
    quoteBg: "rgba(176,120,64,0.06)", codeBg: "#0c0804",
    baseFontSize: 19, contentWidth: 560, bgImage: "",
  },
  minimal: {
    name: "Clean Minimal", icon: "◻️",
    bg: "#fafafa", surface: "#ffffff", text: "#1a1a1a", accent: "#111111",
    dim: "#999", divider: "#e5e5e5",
    headingFont: "'DM Sans', sans-serif",
    bodyFont: "'DM Sans', sans-serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: false, glowColor: "transparent",
    quoteBg: "#f5f5f5", codeBg: "#f8f8f8",
    baseFontSize: 18, contentWidth: 600, bgImage: "",
  },
  ancient: {
    name: "Ancient Scroll", icon: "📜",
    bg: "#f4e8d0", surface: "#efe2ca", text: "#3a2810", accent: "#8a5e2a",
    dim: "#9a8a6a", divider: "#d4c4a0",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Crimson Pro', Georgia, serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: true, glowColor: "rgba(160,120,60,0.08)",
    quoteBg: "rgba(138,94,42,0.08)", codeBg: "#ece0c8",
    baseFontSize: 19, contentWidth: 560, bgImage: "",
  },
  midnight: {
    name: "Midnight Ocean", icon: "🌊",
    bg: "#040810", surface: "#0a1020", text: "#b0c4d8", accent: "#4aa8c4",
    dim: "#3a4a5a", divider: "#1a2838",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Crimson Pro', Georgia, serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: false, glowColor: "rgba(40,100,140,0.1)",
    quoteBg: "rgba(74,168,196,0.06)", codeBg: "#060c18",
    baseFontSize: 19, contentWidth: 560, bgImage: "",
  },
  sakura: {
    name: "Sakura", icon: "🌸",
    bg: "#fef6f6", surface: "#fff0f0", text: "#4a2030", accent: "#d4607a",
    dim: "#c090a0", divider: "#f0d0d8",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Crimson Pro', Georgia, serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: false, glowColor: "rgba(212,96,122,0.06)",
    quoteBg: "rgba(212,96,122,0.05)", codeBg: "#fdf0f2",
    baseFontSize: 18, contentWidth: 580, bgImage: "",
  },
  neon: {
    name: "Neon Noir", icon: "💚",
    bg: "#0a0a0a", surface: "#111111", text: "#d0d0d0", accent: "#00ff88",
    dim: "#404040", divider: "#1a1a1a",
    headingFont: "'JetBrains Mono', monospace",
    bodyFont: "'DM Sans', sans-serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: false, glowColor: "rgba(0,255,136,0.04)",
    quoteBg: "rgba(0,255,136,0.04)", codeBg: "#0d0d0d",
    baseFontSize: 18, contentWidth: 600, bgImage: "",
  },
  vedic: {
    name: "Vedic", icon: "🕉️",
    bg: "#1a0e06", surface: "#241408", text: "#e8d0a8", accent: "#d4943a",
    dim: "#6a4a2a", divider: "#3a2410",
    headingFont: "'Noto Serif Devanagari', serif",
    bodyFont: "'Noto Serif Devanagari', serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: true, glowColor: "rgba(200,120,40,0.08)",
    quoteBg: "rgba(212,148,58,0.06)", codeBg: "#160a04",
    baseFontSize: 19, contentWidth: 560, bgImage: "",
  },
  // ─── new presets ───
  noir: {
    name: "Pure Noir", icon: "🖤",
    bg: "#000000", surface: "#0a0a0a", text: "#e8e8e8", accent: "#ffffff",
    dim: "#555555", divider: "#222222",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'DM Sans', sans-serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: false, glowColor: "transparent",
    quoteBg: "rgba(255,255,255,0.04)", codeBg: "#0d0d0d",
    baseFontSize: 19, contentWidth: 560, bgImage: "",
  },
  rose: {
    name: "Rose Gold", icon: "🌹",
    bg: "#1a0d10", surface: "#241318", text: "#f0d4d8", accent: "#e0a0a8",
    dim: "#7a5058", divider: "#3a2228",
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Crimson Pro', Georgia, serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: true, glowColor: "rgba(224,160,168,0.08)",
    quoteBg: "rgba(224,160,168,0.06)", codeBg: "#160a0c",
    baseFontSize: 19, contentWidth: 560, bgImage: "",
  },
  forest: {
    name: "Deep Forest", icon: "🌲",
    bg: "#08120c", surface: "#0e1c14", text: "#c0d8c8", accent: "#5ac488",
    dim: "#3a5a48", divider: "#1a2c20",
    headingFont: "'Playfair Display', Georgia, serif",
    bodyFont: "'Crimson Pro', Georgia, serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: false, glowColor: "rgba(90,196,136,0.07)",
    quoteBg: "rgba(90,196,136,0.05)", codeBg: "#06100a",
    baseFontSize: 19, contentWidth: 560, bgImage: "",
  },
  paper: {
    name: "Warm Paper", icon: "📄",
    bg: "#f8f4ec", surface: "#fffdf8", text: "#2a2620", accent: "#c0703a",
    dim: "#a89c88", divider: "#e4ddd0",
    headingFont: "'Cormorant Garamond', Georgia, serif",
    bodyFont: "'Crimson Pro', Georgia, serif",
    codeFont: "'JetBrains Mono', monospace",
    grain: true, glowColor: "transparent",
    quoteBg: "rgba(192,112,58,0.06)", codeBg: "#f0ebe0",
    baseFontSize: 19, contentWidth: 580, bgImage: "",
  },
};

export const BLOCK_TYPES = [
  { type: "text", label: "Text", icon: "T" },
  { type: "heading", label: "Heading", icon: "H" },
  { type: "image", label: "Image", icon: "🖼" },
  { type: "video", label: "Video", icon: "▶" },
  { type: "code", label: "Code", icon: "</>" },
  { type: "quote", label: "Quote", icon: "❝" },
  { type: "list", label: "List", icon: "≔" },
  { type: "callout", label: "Callout", icon: "💡" },
  { type: "embed", label: "Embed", icon: "🔗" },
  { type: "divider", label: "Divider", icon: "—" },
  { type: "pagebreak", label: "Read More", icon: "✂" },
];

export const FONT_OPTIONS = [
  { value: "'Cormorant Garamond', serif", label: "Cormorant Garamond" },
  { value: "'Playfair Display', serif", label: "Playfair Display" },
  { value: "'Crimson Pro', serif", label: "Crimson Pro" },
  { value: "'DM Sans', sans-serif", label: "DM Sans" },
  { value: "'JetBrains Mono', monospace", label: "JetBrains Mono" },
  { value: "'Noto Serif Devanagari', serif", label: "Noto Serif Devanagari" },
];

export function getTheme(config) {
  if (config?.theme === "custom" && config?.customTheme) return { ...DEFAULT_CUSTOM_THEME, ...config.customTheme };
  return THEMES[config?.theme] || THEMES.darkAmber;
}

export const DEFAULT_CUSTOM_THEME = {
  ...THEMES.darkAmber,
  name: "Custom",
  icon: "🎨",
};

// Resolve a customizable button's style into a concrete CSS object,
// falling back to the theme's default reader-button look.
export function resolveButtonStyle(btn, t, highlight) {
  const s = btn?.style || {};
  return {
    background: s.bg || "transparent",
    border: `1px solid ${s.border || (highlight ? t.accent + "80" : t.divider)}`,
    color: s.color || (highlight ? t.accent : t.dim),
    fontSize: s.fontSize || 10,
    letterSpacing: s.letterSpacing != null ? s.letterSpacing : 4,
    textTransform: s.textTransform || "uppercase",
    padding: s.padding || "13px 32px",
    borderRadius: s.radius != null ? s.radius : 0,
    fontFamily: s.fontFamily || t.headingFont,
    cursor: "pointer",
    transition: "all 0.3s",
  };
}

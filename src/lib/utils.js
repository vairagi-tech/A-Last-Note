export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function generateLinkId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) result += chars[Math.floor(Math.random() * chars.length)];
  return result;
}

export function generateToken() {
  return generateId() + generateId();
}

export function formatTime(s) {
  if (!s && s !== 0) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function getDeviceInfo() {
  if (typeof navigator === "undefined") return { device: "Unknown", browser: "Unknown" };
  const ua = navigator.userAgent;
  const device = /Mobi|Android/i.test(ua) ? "Mobile" : /iPad|Tablet/i.test(ua) ? "Tablet" : "Desktop";
  let browser = "Other";
  if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) browser = "Chrome";
  else if (/Firefox/i.test(ua)) browser = "Firefox";
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari";
  else if (/Edge/i.test(ua)) browser = "Edge";
  return { device, browser };
}

// A stable-ish device/browser fingerprint that survives incognito on the SAME
// browser (same UA, screen, timezone, cores…). Not crypto-strong; combined with
// IP server-side to identify a returning reader for per-reader caps.
export function getFingerprint() {
  if (typeof navigator === "undefined") return "";
  const n = navigator;
  let tz = "";
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { /* noop */ }
  const scr = typeof screen !== "undefined" ? `${screen.width}x${screen.height}x${screen.colorDepth}` : "";
  return [n.userAgent, n.language, n.platform || "", n.hardwareConcurrency || "", n.maxTouchPoints || "", scr, tz].join("|");
}

// Geo-lite: no external call — derive coarse context from the browser itself.
export function getReaderContext() {
  if (typeof navigator === "undefined") return {};
  const { device, browser } = getDeviceInfo();
  let timezone = "";
  try { timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* noop */ }
  return {
    device,
    browser,
    timezone,
    language: navigator.language || "",
    screen: typeof window !== "undefined" ? `${window.screen?.width || 0}x${window.screen?.height || 0}` : "",
  };
}

// ─── Block / section / letter factories ─────────────────────

// A block: flow by default (position null). `style` holds per-element overrides.
export function newBlock(type = "text") {
  const base = {
    id: generateId(),
    type,
    content: "",
    meta: {},
    style: {},      // per-element overrides (color, fontSize, align, bold, ...)
    position: null, // null = flow; { x, y, width, height, z } = popped-out free placement
  };
  // sensible per-type starting meta
  if (type === "list") base.meta = { ordered: false };
  if (type === "callout") base.meta = { emoji: "💡" };
  return base;
}

// "Read More" page break — a block the reader splits pages on.
export function newPageBreak() {
  return newBlock("pagebreak");
}

export const DEFAULT_BUTTONS = {
  start: { label: "Start Reading", style: {} },
  readMore: { label: "Read More →", style: {} },
  finish: { label: "Finish Reading", style: {} },
};

export const DEFAULT_SETTINGS = {
  enabled: true,
  expiryEnabled: true,
  expiryHours: 24,        // legacy; the editor derives expiryValue/expiryUnit on load
  perReaderLimit: null, // null = unlimited
  totalLimit: null,     // null = unlimited
  nameMode: "off",      // "off" | "optional" | "required"
  password: null,
  drm: false,           // protection mode: blackout on capture / focus loss
  holdToReveal: false,  // content blurred unless pressed-and-held
  endMessage: "",       // reader's final fade text (default applied at render)
  // ─── Reading-window position (where the letter sits in the reader viewport) ───
  // Any field left null inherits: per-letter → workspace default → system default.
  layout: {
    vAlign: "center",   // "top" | "center" | "bottom" — vertical placement
    width: "normal",    // "narrow" | "normal" | "wide" — preset, mapped to px
    contentWidth: null, // fine-tune: explicit px (overrides the width preset)
    topOffset: null,    // fine-tune: explicit top padding px
    sidePadding: null,  // fine-tune: explicit horizontal padding px
  },
  // ─── Experience: each idea is an opt-in toggle; off = original behavior ───
  experience: {
    breathPace: 0,         // legacy "breathing reveal" — maps to a slow block fade
    emberDissolve: false,  // on finish, words drift apart like embers instead of cutting to black
    sealedFrom: null,      // ISO datetime — before it, the letter is "sealed" and won't open
    minimalAnalytics: false, // replace forensic tracking with a single "did it land" ember
    // ─── Story animations (play on the reader) ───
    blockReveal: "none",   // none|fade|slideUp|zoom|slideLeft|slideRight|float|bounce
    revealStagger: null,   // seconds between blocks (null → derive from breathPace or 0.12)
    wordAnim: "none",      // none|typewriter|fade|slideUp|wave|bounce  (per-word)
    wordStagger: 0.04,     // seconds between words
  },
};

export const DEFAULT_EXPERIENCE = { breathPace: 0, emberDissolve: false, sealedFrom: null, minimalAnalytics: false, blockReveal: "none", revealStagger: null, wordAnim: "none", wordStagger: 0.04 };

// Reading-window layout defaults + width presets (px).
export const DEFAULT_LAYOUT = { vAlign: "center", width: "normal", contentWidth: null, topOffset: null, sidePadding: null };
export const WIDTH_PRESETS = { narrow: 460, normal: 560, wide: 720 };

// Resolve the effective reading-window layout by cascading:
//   per-letter layout → workspace default layout → system default.
// Each field falls back independently, so a letter that only sets vAlign still
// inherits the workspace width, etc. Returns concrete render values.
export function resolveLayout(letterLayout, defaultLayout) {
  const pick = (k) => {
    const a = letterLayout && letterLayout[k];
    if (a !== undefined && a !== null && a !== "") return a;
    const b = defaultLayout && defaultLayout[k];
    if (b !== undefined && b !== null && b !== "") return b;
    return DEFAULT_LAYOUT[k];
  };
  const vAlign = pick("vAlign");
  const widthKey = pick("width");
  const contentWidth = pick("contentWidth"); // may stay null → caller falls back to theme
  return {
    vAlign,
    align: { top: "flex-start", center: "center", bottom: "flex-end" }[vAlign] || "center",
    widthKey,
    presetWidth: WIDTH_PRESETS[widthKey] || WIDTH_PRESETS.normal,
    contentWidth: contentWidth != null ? Number(contentWidth) : null,
    topOffset: (() => { const v = pick("topOffset"); return v != null ? Number(v) : null; })(),
    sidePadding: (() => { const v = pick("sidePadding"); return v != null ? Number(v) : null; })(),
  };
}

export function newLetter() {
  return {
    title: "Untitled Letter",
    opening: "",
    blocks: [newBlock("text")],
    theme: "darkAmber",
    customTheme: null,
    buttons: JSON.parse(JSON.stringify(DEFAULT_BUTTONS)),
    settings: { ...DEFAULT_SETTINGS },
  };
}

// Legacy section title kept; older blocks may lack style/position.
function normalizeBlock(b) {
  return { style: {}, position: null, meta: {}, ...b };
}

// Migrate the old sections[] model to a flat blocks[] with inline pagebreaks,
// and backfill missing buttons/settings so the editor never hits a null field.
// Idempotent: if `blocks` already exists, just normalizes it.
export function flattenSectionsToBlocks(letter) {
  if (!letter) return letter;
  let blocks;
  if (Array.isArray(letter.blocks) && letter.blocks.length) {
    blocks = letter.blocks.map(normalizeBlock);
  } else {
    const sections = Array.isArray(letter.sections) ? letter.sections : [];
    blocks = [];
    sections.forEach((sec, i) => {
      if (i > 0) blocks.push(newPageBreak());
      if (sec.title) { const h = newBlock("heading"); h.content = sec.title; blocks.push(h); }
      (sec.blocks || []).forEach(b => blocks.push(normalizeBlock(b)));
    });
    if (!blocks.length) blocks.push(newBlock("text"));
  }
  return {
    ...letter,
    blocks,
    buttons: letter.buttons || JSON.parse(JSON.stringify(DEFAULT_BUTTONS)),
    settings: { ...DEFAULT_SETTINGS, ...(letter.settings || {}) },
  };
}

// Split a flat blocks[] into reader pages on each pagebreak.
// Drops empty pages; always returns at least one page.
export function splitIntoPages(blocks) {
  const pages = [[]];
  (blocks || []).forEach(b => {
    if (b.type === "pagebreak") pages.push([]);
    else pages[pages.length - 1].push(b);
  });
  const nonEmpty = pages.filter(p => p.length > 0);
  return nonEmpty.length ? nonEmpty : [[]];
}

export function getYouTubeId(url) {
  if (!url) return null;
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([^&\n?#]+)/);
  return match ? match[1] : null;
}

// Status helpers used by the dashboard.
export function isExpired(letter) {
  if (!letter?.settings?.expiryEnabled) return false;
  if (!letter?.publishedAt || !letter?.settings?.expiryHours) return false;
  const expiry = new Date(letter.publishedAt).getTime() + letter.settings.expiryHours * 3600000;
  return Date.now() > expiry;
}

export function isTotalCapReached(letter) {
  const cap = letter?.settings?.totalLimit;
  return cap != null && (letter?.stats?.totalReads || 0) >= cap;
}

export function letterStatus(letter) {
  if (!letter) return "draft";
  if (letter.settings?.enabled === false) return "disabled";
  if (isExpired(letter)) return "expired";
  if (isTotalCapReached(letter)) return "destroyed";
  if (!letter.linkId) return "draft";
  return "active";
}

export function exportSessionsCSV(sessions) {
  const rows = [["ID", "Name", "Status", "Page", "PageTime", "TotalTime", "Device", "Browser", "Timezone", "Clicks", "MaxScroll%", "TabSwitches", "Idle", "Completed", "Started"]];
  sessions.forEach(s => {
    const maxScroll = s.scrollDepthByPage ? Math.max(0, ...Object.values(s.scrollDepthByPage)) : 0;
    rows.push([
      s.sessionId, s.name || "Anonymous", s.status, (s.currentSection || 0) + 1, formatTime(s.sectionTime),
      formatTime(s.totalTime), s.device, s.browser, s.timezone || "—", s.clicks || 0, maxScroll,
      s.tabSwitches || 0, formatTime(s.idleSeconds || 0),
      s.completed ? "Yes" : "No", s.startedAt ? new Date(s.startedAt).toLocaleString() : "—",
    ]);
  });
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "reader-analytics.csv"; a.click();
  URL.revokeObjectURL(url);
}

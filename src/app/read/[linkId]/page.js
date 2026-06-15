"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { getTheme, resolveButtonStyle } from "@/lib/themes";
import { generateId, generateToken, formatTime, getReaderContext, getFingerprint, resolveLayout } from "@/lib/utils";
import { getLetterDoc, splitDocIntoPages, themeToVars, isFreestylePage } from "@/lib/letterDoc";
import { getDeviceProfile } from "@/lib/perf";
import { LetterProseStyles } from "@/components/tiptap/proseStyles";
import { StoryStyles, animConfig } from "@/components/tiptap/storyAnim";

// Tiptap (text) + freestyle pages render client-side only.
const LetterPage = dynamic(() => import("@/components/tiptap/LetterPage"), { ssr: false });
const FreestylePage = dynamic(() => import("@/components/tiptap/FreestylePage"), { ssr: false });

const BLOCKED_COPY = {
  disabled: "This letter is currently unavailable.",
  expired: "This letter has expired.",
  total: "This letter has been sealed — it can no longer be opened.",
  perReader: "You've already read this the maximum number of times.",
  notfound: "This letter doesn't exist.",
  sealed: "This letter is still sealed.",
};

export default function ReaderPage({ params }) {
  const { linkId } = params;
  const [letter, setLetter] = useState(null);
  const [stage, setStage] = useState("loading"); // loading, blocked, password, name, landing, reading, finishing, destroyed
  const [blockReason, setBlockReason] = useState(null);
  const [gate, setGate] = useState({ needsPassword: false, nameMode: "off" });
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [idx, setIdx] = useState(0);
  const [show, setShow] = useState(true);
  const [screenshotWarning, setScreenshotWarning] = useState(false);
  const [captured, setCaptured] = useState(false); // DRM blackout active
  const [holding, setHolding] = useState(false);   // hold-to-reveal pressed
  const [opensAt, setOpensAt] = useState(null);    // sealed-until date (when blocked "sealed")
  const minimalRef = useRef(false);                // tender-analytics mode
  const previewRef = useRef(false);                // owner preview — never counts
  // Device profile: one switch the heavy effects read so this can't regress.
  // Starts "lite" (cheap) for SSR/first paint, resolved on mount.
  const [perf, setPerf] = useState({ coarse: false, reducedMotion: false, smallScreen: false, animate: false, lite: true });

  const sid = useRef(generateId());
  const token = useRef("");
  const fp = useRef("");
  const readerName = useRef("");
  const tStart = useRef(Date.now());
  const pStart = useRef(Date.now());
  const tabSw = useRef(0);
  const clicks = useRef(0);
  const idleSec = useRef(0);
  const lastActivity = useRef(Date.now());
  const scrollByPage = useRef({});
  const pageTimes = useRef([]);
  const pingRef = useRef(null);
  const scrollRef = useRef(null);

  const ctx = useRef({});
  const log = useCallback((type, detail, page) => {
    if (previewRef.current) return; // owner preview is invisible to analytics
    // Tender-analytics mode keeps only "did it land" — open + finish, nothing granular.
    if (minimalRef.current && type !== "open" && type !== "finish") return;
    fetch(`/api/sessions/${sid.current}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type, detail, page }) }).catch(() => {});
  }, []);

  // Reader identity token (stable across visits)
  useEffect(() => {
    setPerf(getDeviceProfile());
    try { previewRef.current = new URLSearchParams(window.location.search).get("preview") === "1"; } catch {}
    try {
      let t = localStorage.getItem("lp_reader");
      if (!t) { t = generateToken(); localStorage.setItem("lp_reader", t); }
      token.current = t;
    } catch { token.current = generateToken(); }
    ctx.current = getReaderContext();
    fp.current = getFingerprint();
    probe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  const probe = async () => {
    // Owner preview: fetch the letter directly (no gates, no counting) and read.
    if (previewRef.current) {
      try {
        const r = await fetch(`/api/letters/${linkId}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ preview: true }) });
        const d = await r.json();
        if (d.blocked) { setBlockReason(d.reason); setStage("blocked"); return; }
        setLetter(d.letter); setStage("landing"); return;
      } catch { setBlockReason("notfound"); setStage("blocked"); return; }
    }
    try {
      const r = await fetch(`/api/letters/${linkId}/read`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ probe: true, readerToken: token.current, fingerprint: fp.current }) });
      const d = await r.json();
      if (d.blocked) { setBlockReason(d.reason); setOpensAt(d.opensAt || null); setStage("blocked"); return; }
      setGate({ needsPassword: d.needsPassword, nameMode: d.nameMode });
      if (d.needsPassword) setStage("password");
      else if (d.nameMode !== "off") setStage("name");
      else beginRead("", "");
    } catch { setBlockReason("notfound"); setStage("blocked"); }
  };

  const beginRead = async (name, password) => {
    try {
      const r = await fetch(`/api/letters/${linkId}/read`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ readerToken: token.current, name, password, device: ctx.current.device, browser: ctx.current.browser, fingerprint: fp.current }),
      });
      const d = await r.json();
      if (d.blocked) {
        if (d.reason === "password") { setPwError(true); setStage("password"); return; }
        if (d.reason === "name") { setStage("name"); return; }
        setBlockReason(d.reason); setOpensAt(d.opensAt || null); setStage("blocked"); return;
      }
      readerName.current = name || "";
      minimalRef.current = !!d.letter?.settings?.experience?.minimalAnalytics;
      setLetter(d.letter);
      setStage("landing");
      log("open", `Opened${name ? " by " + name : ""}`);
      if (name) log("name_submitted", name);
    } catch { setBlockReason("notfound"); setStage("blocked"); }
  };

  // Activity / idle / click tracking
  useEffect(() => {
    const act = () => { lastActivity.current = Date.now(); };
    const onClick = () => { clicks.current++; act(); };
    const idleTick = setInterval(() => { if (Date.now() - lastActivity.current > 10000) idleSec.current += 1; }, 1000);
    const opts = { passive: true };
    document.addEventListener("click", onClick, opts);
    document.addEventListener("keydown", act, opts);
    document.addEventListener("mousemove", act, opts);
    return () => { clearInterval(idleTick); document.removeEventListener("click", onClick); document.removeEventListener("keydown", act); document.removeEventListener("mousemove", act); };
  }, []);

  // Tab + screenshot + copy tracking
  useEffect(() => {
    const vis = () => { if (document.hidden) { tabSw.current++; log("tab_blur", "Tab lost focus", idx); } };
    const key = (e) => {
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && ["3", "4", "5", "S", "s"].includes(e.key)) || e.key === "PrintScreen") {
        setScreenshotWarning(true); setTimeout(() => setScreenshotWarning(false), 2000);
        log("screenshot_attempt", "Screenshot shortcut", idx);
      }
    };
    const copy = () => log("copy_attempt", "Copied text", idx);
    document.addEventListener("visibilitychange", vis);
    document.addEventListener("keydown", key);
    document.addEventListener("copy", copy);
    return () => { document.removeEventListener("visibilitychange", vis); document.removeEventListener("keydown", key); document.removeEventListener("copy", copy); };
  }, [idx, log]);

  // ── DRM / anti-capture protection ──
  const drm = !!letter?.settings?.drm;
  const hold = !!letter?.settings?.holdToReveal;
  useEffect(() => {
    if (!drm) return;
    const black = () => setCaptured(true);
    const clear = () => setCaptured(false);
    const onVis = () => setCaptured(document.hidden);
    const prevent = (e) => { e.preventDefault(); return false; };
    const onKey = (e) => {
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && ["3", "4", "5", "S", "s"].includes(e.key)) || e.key === "PrintScreen") {
        setCaptured(true); log("screenshot_attempt", "Capture blocked (blackout)", idx); setTimeout(() => setCaptured(false), 1800);
      }
    };
    window.addEventListener("blur", black);
    window.addEventListener("focus", clear);
    document.addEventListener("visibilitychange", onVis);
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("dragstart", prevent);
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("keyup", onKey);
    document.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("blur", black);
      window.removeEventListener("focus", clear);
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("dragstart", prevent);
      document.removeEventListener("copy", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("keyup", onKey);
      document.removeEventListener("keydown", onKey);
    };
  }, [drm, idx, log]);

  // Analytics ping
  useEffect(() => {
    if (previewRef.current) return; // preview never pings
    if (stage !== "reading" && stage !== "landing") return;
    const ping = () => {
      fetch("/api/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sid.current, letterId: linkId, readerToken: token.current, name: readerName.current || null,
          status: stage === "reading" ? "reading" : "waiting",
          currentSection: idx, sectionTime: Math.floor((Date.now() - pStart.current) / 1000),
          totalTime: Math.floor((Date.now() - tStart.current) / 1000),
          ...ctx.current, pageTimes: pageTimes.current, scrollDepthByPage: scrollByPage.current,
          clicks: clicks.current, idleSeconds: idleSec.current, tabSwitches: tabSw.current,
          startedAt: tStart.current, completed: false,
        }),
      }).catch(() => {});
    };
    ping();
    // Tender-analytics: one presence ping, no per-interval surveillance.
    // 12s (was 4s) — enough for "still reading" presence without hammering the DB.
    if (!letter?.settings?.experience?.minimalAnalytics) pingRef.current = setInterval(ping, 12000);
    return () => clearInterval(pingRef.current);
  }, [stage, idx, linkId, letter]);

  const t = letter ? getTheme(letter) : getTheme(null);
  const pages = letter ? splitDocIntoPages(getLetterDoc(letter)) : [{ type: "doc", content: [] }];
  const btns = letter?.buttons || {};
  const exp = letter?.settings?.experience || {};
  const anim = animConfig(exp);
  // Honour reduced-motion: skip the heavy dissolve/ember finale, keep the quick fade.
  const emberOn = !!exp.emberDissolve && !perf.reducedMotion;

  // Page-turn crossfade. Was a 500ms blackout before the page even changed —
  // which read as "the button is laggy". Now it's a quick ~160ms fade, and instant
  // under reduced-motion. The button responds immediately.
  const fade = (cb) => {
    if (perf.reducedMotion) { cb(); setShow(true); return; }
    setShow(false);
    setTimeout(() => { cb(); requestAnimationFrame(() => setShow(true)); }, 160);
  };

  // Scroll-depth tracking on the DOCUMENT (the page scrolls natively now, not an
  // inner overflow box). Throttled via rAF + a time gate so a fast mobile scroll
  // never fires log()/fetch() on every frame.
  const scrollIdle = useRef(true);
  const lastScrollLog = useRef(0);
  const measureScroll = useCallback(() => {
    scrollIdle.current = true;
    const doc = document.documentElement;
    const scrollable = doc.scrollHeight - window.innerHeight;
    const pct = scrollable <= 0 ? 100 : Math.min(100, Math.round((window.scrollY / scrollable) * 100));
    const prev = scrollByPage.current[idx] || 0;
    if (pct <= prev) return;
    scrollByPage.current[idx] = pct;
    const now = Date.now();
    if (now - lastScrollLog.current < 250) return; // gate network churn
    lastScrollLog.current = now;
    [25, 50, 75, 100].forEach(m => { if (prev < m && pct >= m) log("scroll_milestone", `${m}% of page ${idx + 1}`, idx); });
  }, [idx, log]);

  useEffect(() => {
    if (stage !== "reading") return;
    const onScroll = () => {
      if (!scrollIdle.current) return;
      scrollIdle.current = false;
      requestAnimationFrame(measureScroll);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [stage, measureScroll]);

  // Each reader page starts at the top of the document (the page scrolls natively).
  useEffect(() => {
    if (stage === "reading") { try { window.scrollTo(0, 0); } catch {} }
  }, [idx, stage]);

  const recordPageTime = () => {
    pageTimes.current.push({ page: idx, title: `Page ${idx + 1}`, seconds: Math.floor((Date.now() - pStart.current) / 1000), enteredAt: pStart.current });
  };

  const start = () => { fade(() => { setStage("reading"); pStart.current = Date.now(); }); log("start", "Started reading", 0); };
  const next = () => { recordPageTime(); log("page_view", `Page ${idx + 1} → ${idx + 2}`, idx); fade(() => { pStart.current = Date.now(); setIdx(p => p + 1); }); };

  const finish = async () => {
    clearInterval(pingRef.current); recordPageTime();
    if (!previewRef.current) await fetch("/api/sessions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: sid.current, letterId: linkId, readerToken: token.current, name: readerName.current || null,
        status: "finished", currentSection: pages.length, sectionTime: 0,
        totalTime: Math.floor((Date.now() - tStart.current) / 1000), ...ctx.current,
        pageTimes: pageTimes.current, scrollDepthByPage: scrollByPage.current,
        clicks: clicks.current, idleSeconds: idleSec.current, tabSwitches: tabSw.current,
        startedAt: tStart.current, completed: true,
      }),
    }).catch(() => {});
    log("finish", `Done in ${formatTime(Math.floor((Date.now() - tStart.current) / 1000))}`, idx);
    if (emberOn) {
      // Watch the words come apart — content dissolves into embers, then the goodbye, then black.
      setStage("dissolving");
      setTimeout(() => { setShow(false); setStage("finishing"); }, 2800);
      setTimeout(() => setStage("destroyed"), 6200);
    } else {
      setShow(false);
      setTimeout(() => setStage("finishing"), 600);
      setTimeout(() => setStage("destroyed"), 3500);
    }
  };

  // ─── shared chrome ───
  // Reading-window placement. The workspace default is already merged under the
  // letter's own layout server-side (read endpoint), so resolve directly here.
  const llayout = letter?.settings?.layout || null;
  const lay = resolveLayout(llayout, null);
  // Width: explicit fine-tune px → explicit non-default preset → theme width → preset.
  const maxW = lay.contentWidth != null
    ? lay.contentWidth
    : (llayout && llayout.width && llayout.width !== "normal")
      ? lay.presetWidth
      : (t.contentWidth || lay.presetWidth);
  const padTop = lay.topOffset != null ? lay.topOffset : 48;
  const padSide = lay.sidePadding != null ? lay.sidePadding : 24;
  // The DOCUMENT scrolls natively (no inner overflow box). `100dvh` tracks the
  // mobile address bar; `overflow` is NOT hidden so the page can always scroll.
  // Column flex: justifyContent is the VERTICAL axis (top/center/bottom placement);
  // alignItems is horizontal — always centered.
  const base = { fontFamily: t.bodyFont, minHeight: "100dvh", width: "100%", background: t.bg, backgroundImage: t.bgImage ? `url(${t.bgImage})` : undefined, backgroundSize: "cover", backgroundAttachment: "fixed", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: lay.align, padding: `${padTop}px ${padSide}px ${Math.max(padTop, 64)}px`, position: "relative",
    ...(drm ? { userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" } : {}) };
  const blurNow = drm && hold && !holding;
  const protFilter = blurNow ? "blur(18px)" : undefined;
  const holdProps = (drm && hold) ? {
    onMouseDown: () => setHolding(true), onMouseUp: () => setHolding(false), onMouseLeave: () => setHolding(false),
    onTouchStart: () => setHolding(true), onTouchEnd: () => setHolding(false), onTouchCancel: () => setHolding(false),
  } : {};
  const wrap = { maxWidth: maxW, width: "100%", position: "relative", zIndex: 1, opacity: show ? 1 : 0, transition: "opacity 0.28s ease" };
  const Grain = () => t.grain ? <div className="animate-grain" style={{ position: "fixed", inset: "-50%", width: "200%", height: "200%", opacity: .12, pointerEvents: "none", zIndex: 0, backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.1'/%3E%3C/svg%3E")` }} /> : null;
  const Glow = () => t.glowColor && t.glowColor !== "transparent" ? <div style={{ position: "fixed", top: "35%", left: "50%", transform: "translateX(-50%)", width: perf.smallScreen ? 320 : 500, height: perf.smallScreen ? 240 : 350, borderRadius: "50%", pointerEvents: "none", zIndex: 0, background: `radial-gradient(ellipse at center, ${t.glowColor} 0%, transparent 70%)` }} /> : null;
  const Watermark = () => <div style={{ position: "fixed", bottom: 14, right: 18, fontSize: 8, letterSpacing: 2, color: t.divider, fontFamily: "monospace", zIndex: 2, userSelect: "none" }}>ID: {sid.current.slice(0, 8)}</div>;
  const PreviewBadge = () => previewRef.current ? <div style={{ position: "fixed", top: 12, left: 12, zIndex: 20, fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: t.bg, background: t.accent, padding: "4px 10px", borderRadius: 999, fontFamily: t.bodyFont, fontWeight: 600 }}>👁 Preview · not counted</div> : null;
  const ScreenshotOverlay = () => screenshotWarning ? (
    <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(255,0,0,0.15)", display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <div style={{ background: "rgba(0,0,0,0.9)", padding: "20px 40px", borderRadius: 12, textAlign: "center" }}>
        <p style={{ color: "#ff4444", fontSize: 14, fontWeight: 600 }}>⚠️ Screenshot Detected</p>
        <p style={{ color: "#888", fontSize: 11 }}>Logged · {sid.current.slice(0, 8)}</p>
      </div>
    </div>
  ) : null;

  // Anti-capture layer: print blackout, moving forensic watermark, and a full
  // blackout overlay shown on focus loss / tab switch / screenshot keys.
  const ProtectionLayer = () => {
    if (!drm) return null;
    const mark = `${readerName.current || "private"} · ${sid.current.slice(0, 8)}`;
    // Forensic watermark grid. On capable desktops it drifts slowly; on phones /
    // reduced-motion it stays static (same deterrent, no per-frame repaint). Span
    // count is bounded — 160 spans were a real scroll-cost on mobile.
    const wmCount = perf.lite ? 28 : 70;
    return (
      <>
        <style>{`@media print { html, body { background:#000 !important; } body * { visibility:hidden !important; } }
          @keyframes lpfloat { 0%{transform:translate(-8%,-6%) rotate(-24deg)} 100%{transform:translate(8%,6%) rotate(-24deg)} }`}</style>
        <div aria-hidden style={{ position: "fixed", inset: "-25%", zIndex: 4, pointerEvents: "none", opacity: 0.05, display: "flex", flexWrap: "wrap", gap: 36, transform: "rotate(-24deg)", animation: perf.animate ? "lpfloat 9s ease-in-out infinite alternate" : undefined, color: t.text, fontSize: 13, fontFamily: "monospace", lineHeight: 2.4 }}>
          {Array.from({ length: wmCount }).map((_, i) => <span key={i}>{mark}</span>)}
        </div>
        {captured && (
          <div style={{ position: "fixed", inset: 0, zIndex: 2147483647, background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "#161616", fontSize: 11, letterSpacing: 4, textTransform: "uppercase" }}>● protected</p>
          </div>
        )}
      </>
    );
  };

  // ─── stages ───
  if (stage === "destroyed") return <div style={{ background: "#000", width: "100%", minHeight: "100vh" }} />;

  if (stage === "loading") return <div style={base}><p style={{ color: t.dim, fontStyle: "italic" }}>Loading…</p></div>;

  if (stage === "blocked") return (
    <div style={base}><Grain /><Glow /><div style={{ textAlign: "center", zIndex: 1, maxWidth: 380 }}>
      <p style={{ color: t.accent, fontSize: 30, marginBottom: 16 }}>{blockReason === "sealed" ? "✉" : "✦"}</p>
      <p style={{ color: t.text, fontSize: 17, fontStyle: "italic" }}>{BLOCKED_COPY[blockReason] || "This letter is unavailable."}</p>
      {blockReason === "sealed" && opensAt && (
        <p style={{ color: t.dim, fontSize: 13, marginTop: 14, letterSpacing: 1 }}>
          Opens {new Date(opensAt).toLocaleString([], { dateStyle: "long", timeStyle: "short" })}
        </p>
      )}
    </div></div>
  );

  if (stage === "password") return (
    <div style={base}><Grain /><Glow /><div style={{ ...wrap, textAlign: "center", maxWidth: 360 }}>
      <p style={{ fontSize: 10, letterSpacing: 5, textTransform: "uppercase", color: t.dim, marginBottom: 28 }}>🔒 Protected Letter</p>
      <input type="password" autoFocus value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(false); }}
        onKeyDown={e => e.key === "Enter" && (gate.nameMode !== "off" ? setStage("name") : beginRead("", pwInput))}
        placeholder="Enter password" style={{ width: "100%", textAlign: "center", padding: "12px", background: "transparent", border: `1px solid ${pwError ? "#e04040" : t.divider}`, color: t.text, borderRadius: 8, marginBottom: 16, fontSize: 14 }} />
      {pwError && <p style={{ color: "#e04040", fontSize: 11, marginBottom: 12 }}>Incorrect password</p>}
      <button style={resolveButtonStyle(btns.start, t, true)} onClick={() => gate.nameMode !== "off" ? setStage("name") : beginRead("", pwInput)}>Continue</button>
    </div></div>
  );

  if (stage === "name") return (
    <div style={base}><Grain /><Glow /><div style={{ ...wrap, textAlign: "center", maxWidth: 360 }}>
      <p style={{ fontSize: 10, letterSpacing: 5, textTransform: "uppercase", color: t.dim, marginBottom: 28 }}>Before you open this</p>
      <p style={{ color: t.text, fontSize: 18, fontStyle: "italic", marginBottom: 20 }}>What should we call you?</p>
      <input autoFocus value={nameInput} onChange={e => setNameInput(e.target.value)}
        onKeyDown={e => e.key === "Enter" && (nameInput.trim() || gate.nameMode === "optional") && beginRead(nameInput.trim(), pwInput)}
        placeholder="Your name" style={{ width: "100%", textAlign: "center", padding: "12px", background: "transparent", border: `1px solid ${t.divider}`, color: t.text, borderRadius: 8, marginBottom: 16, fontSize: 14 }} />
      <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
        <button style={resolveButtonStyle(btns.start, t, true)} onClick={() => (nameInput.trim() || gate.nameMode === "optional") && beginRead(nameInput.trim(), pwInput)}>Continue</button>
        {gate.nameMode === "optional" && <button style={resolveButtonStyle(btns.start, t, false)} onClick={() => beginRead("", pwInput)}>Skip</button>}
      </div>
    </div></div>
  );

  if (stage === "finishing") return (
    <div style={base} className="animate-fade-in"><Glow /><ScreenshotOverlay />
      <div style={{ textAlign: "center", zIndex: 1 }} className="animate-fade-in">
        <p style={{ color: t.accent, fontSize: 24, fontWeight: 300, fontStyle: "italic" }}>{letter?.settings?.endMessage || "Ab ho gaya."}</p>
        <p style={{ color: t.dim, fontSize: 12, letterSpacing: 3, marginTop: 16 }}>— ✦ —</p>
      </div>
    </div>
  );

  if (stage === "landing") return (
    <div style={base}><Grain /><Glow /><Watermark /><PreviewBadge /><ScreenshotOverlay /><ProtectionLayer />
      <div {...holdProps} style={{ ...wrap, textAlign: "center", filter: protFilter, transition: "filter 0.2s" }}>
        <div style={{ fontSize: 10, letterSpacing: 5, textTransform: "uppercase", color: t.dim, marginBottom: 48 }}>A Letter{readerName.current ? ` For ${readerName.current}` : " For You"}</div>
        {letter?.opening && <p style={{ color: t.text, fontSize: 21, fontWeight: 300, lineHeight: 2, fontStyle: "italic", marginBottom: 48, whiteSpace: "pre-wrap", fontFamily: t.headingFont }}>{letter.opening}</p>}
        <div style={{ width: "100%", height: 1, background: `linear-gradient(to right, transparent, ${t.divider}, transparent)`, marginBottom: 36 }} />
        <button style={resolveButtonStyle(btns.start, t, false)} onClick={start}>{btns.start?.label || "Start Reading"}</button>
        {drm && hold && <p style={{ color: t.dim, fontSize: 10, letterSpacing: 2, marginTop: 24 }}>🔒 press &amp; hold to read</p>}
      </div>
    </div>
  );

  // ─── reading ───
  const isLast = idx === pages.length - 1;
  const dissolving = stage === "dissolving";
  // Freestyle pages are authored on a fixed-width canvas — give them the room to
  // render 1:1 on desktop; FreestylePage scales itself down to fit phones.
  const freestyleNow = isFreestylePage(pages[idx]);
  const readWrap = freestyleNow ? { ...wrap, maxWidth: Math.max(wrap.maxWidth || 560, 600) } : wrap;
  // Freestyle "cards" are a fixed-width canvas scaled to fit — use less side padding
  // so the card renders bigger, while still honouring the chosen vertical placement.
  const readBase = freestyleNow
    ? { ...base, padding: `${Math.min(padTop, 16)}px 8px 64px` }
    : base;

  return (
    <div style={readBase}><Grain /><Glow /><Watermark /><PreviewBadge /><ScreenshotOverlay /><ProtectionLayer /><LetterProseStyles /><StoryStyles />
      <style>{`
        @keyframes lpDissolve { 0%{opacity:1;filter:blur(0);transform:translateY(0) scale(1)} 100%{opacity:0;filter:blur(10px);transform:translateY(-60px) scale(1.04)} }
        @keyframes lpEmber { 0%{opacity:0;transform:translateY(0) scale(.6)} 15%{opacity:1} 100%{opacity:0;transform:translateY(-240px) scale(1.1)} }
      `}</style>
      <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: 2, background: t.divider, zIndex: 10 }}>
        <div style={{ height: "100%", background: t.accent, width: `${((idx + 1) / pages.length) * 100}%`, transition: "width 0.5s" }} />
      </div>
      <div style={{ position: "fixed", top: 14, right: 18, fontSize: 10, letterSpacing: 3, color: t.dim, zIndex: 10, fontFamily: t.bodyFont }}>{idx + 1} / {pages.length}</div>
      {drm && hold && !holding && <div style={{ position: "fixed", bottom: 16, left: 0, width: "100%", textAlign: "center", fontSize: 10, letterSpacing: 2, color: t.dim, zIndex: 10 }}>🔒 press &amp; hold to read</div>}
      {dissolving && <EmberOverlay t={t} lite={perf.lite} />}

      <div ref={scrollRef} {...holdProps} style={{ ...readWrap, ...themeToVars(t), filter: protFilter, transition: "filter 0.2s", animation: dissolving ? "lpDissolve 2.6s ease-in forwards" : undefined }}>
        {pages.length > 1 && (
          <div style={{ fontSize: 10, letterSpacing: 4, color: t.divider, marginBottom: freestyleNow ? 14 : 36, textAlign: "center" }}>
            — {["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][idx] || idx + 1} —
          </div>
        )}
        {isFreestylePage(pages[idx])
          ? <FreestylePage key={idx} pageDoc={pages[idx]} anim={anim} lite={perf.lite} />
          : <LetterPage key={idx} pageDoc={pages[idx]} anim={anim} lite={perf.lite} />}
        <div style={{ width: "100%", height: 1, background: `linear-gradient(to right, transparent, ${t.divider}60, transparent)`, marginTop: 16, marginBottom: 32 }} />
        {!dissolving && (
          <div style={{ textAlign: "center" }}>
            {isLast
              ? <button style={resolveButtonStyle(btns.finish, t, true)} onClick={finish}>{btns.finish?.label || "Finish Reading"}</button>
              : <button style={resolveButtonStyle(btns.readMore, t, false)} onClick={next}>{btns.readMore?.label || "Read More →"}</button>}
          </div>
        )}
      </div>
    </div>
  );
}

// Embers rising as the letter dissolves. Varied by index (no Math.random — SSR-safe).
// The glow is a radial-gradient background, not box-shadow (box-shadow on dozens of
// animated nodes was a real mobile repaint cost); count is reduced on phones.
function EmberOverlay({ t, lite }) {
  const count = lite ? 16 : 34;
  return (
    <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 6, pointerEvents: "none", overflow: "hidden" }}>
      {Array.from({ length: count }).map((_, i) => {
        const left = (i * 37) % 100;
        const delay = (i % 11) * 0.16;
        const size = 3 + (i % 5);
        const dur = 3 + (i % 4) * 0.6;
        return (
          <span key={i} style={{
            position: "absolute", bottom: `${10 + (i % 7) * 6}%`, left: `${left}%`,
            width: size * 3, height: size * 3, borderRadius: "50%",
            background: `radial-gradient(circle, ${t.accent} 0%, transparent 70%)`,
            opacity: 0, willChange: "transform, opacity", animation: `lpEmber ${dur}s ease-out ${delay}s forwards`,
          }} />
        );
      })}
    </div>
  );
}

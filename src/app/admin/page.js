"use client";
import { useState, useEffect, createContext, useContext } from "react";
import { THEMES, FONT_OPTIONS, getTheme, DEFAULT_CUSTOM_THEME, resolveButtonStyle } from "@/lib/themes";
import { formatTime, newLetter, flattenSectionsToBlocks, exportSessionsCSV, letterStatus, DEFAULT_BUTTONS } from "@/lib/utils";
import { getLetterDoc } from "@/lib/letterDoc";
import { TEMPLATES, getTemplate } from "@/lib/templates";
import dynamic from "next/dynamic";
import { UserButton, useUser } from "@clerk/nextjs";

const CLERK_ON = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const LetterEditor = dynamic(() => import("@/components/tiptap/LetterEditor"), { ssr: false, loading: () => <p style={{ color: "#5a5d6e" }}>Loading editor…</p> });

const PALETTES = {
  // Warm "candlelit" palette — matches the amber landing hero (gold accent, warm-black panels).
  dark: { bg: "#0b0907", side: "#100d09", card: "#16120c", border: "#2a2318", accent: "#d8a24a", onAccent: "#1b1206", text: "#cabfac", dim: "#807766", bright: "#efe7d6", red: "#e0604a", green: "#34d399", amber: "#d4903a" },
  light: { bg: "#f7f4ee", side: "#fffdf8", card: "#fffdf8", border: "#e9e3d6", accent: "#b07a1a", onAccent: "#ffffff", text: "#473f31", dim: "#9c9484", bright: "#221c12", red: "#c2410c", green: "#15803d", amber: "#b45309" },
};
const ThemeCtx = createContext(PALETTES.dark);
const useTheme = () => useContext(ThemeCtx);
const A = PALETTES.dark; // module fallback for any spot not yet themed
const STC = { active: "#34d399", disabled: "#9499a4", expired: "#d4903a", destroyed: "#e04040", draft: "#9499a4" };

export default function AdminPage() {
  const [view, setView] = useState("home");          // home | editor | analytics
  const [navOpen, setNavOpen] = useState(false);     // mobile sidebar drawer
  const [anLetterId, setAnLetterId] = useState(null); // null = overview, set = drilled into a letter
  const [tab, setTab] = useState("content");
  const [letters, setLetters] = useState([]);
  const [active, setActive] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [allSessions, setAllSessions] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logs, setLogs] = useState([]);
  const [saved, setSaved] = useState(false);
  const [defaults, setDefaults] = useState({});
  const [creatingNew, setCreatingNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTpl, setNewTpl] = useState("blank");
  const [confirmDel, setConfirmDel] = useState(null); // letter pending delete
  const [mode, setMode] = useState("dark");
  const A = mode === "light" ? PALETTES.light : PALETTES.dark;
  const toggleMode = () => { const m = mode === "dark" ? "light" : "dark"; setMode(m); try { localStorage.setItem("lp_theme", m); } catch { /* noop */ } };
  useEffect(() => { try { const m = localStorage.getItem("lp_theme"); if (m) setMode(m); } catch { /* noop */ } }, []);
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";

  const loadLetters = () => fetch("/api/letters").then(r => r.ok ? r.json() : []).then(d => setLetters(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => { loadLetters(); fetch("/api/me/settings").then(r => r.ok ? r.json() : {}).then(setDefaults).catch(() => {}); }, []);

  // drilled-in letter: poll its sessions
  useEffect(() => {
    if (view !== "analytics" || !anLetterId) return;
    const poll = () => fetch(`/api/sessions?letterId=${anLetterId}`).then(r => r.ok ? r.json() : []).then(d => setSessions(Array.isArray(d) ? d : [])).catch(() => {});
    poll(); const iv = setInterval(poll, 5000); return () => clearInterval(iv);
  }, [view, anLetterId]);

  // overview: all sessions across owned letters
  useEffect(() => {
    if (view !== "analytics" || anLetterId) return;
    const poll = () => fetch(`/api/sessions`).then(r => r.ok ? r.json() : []).then(d => setAllSessions(Array.isArray(d) ? d : [])).catch(() => {});
    poll(); const iv = setInterval(poll, 8000); return () => clearInterval(iv);
  }, [view, anLetterId]);

  useEffect(() => { if (!selectedLog) return; fetch(`/api/sessions/${selectedLog}`).then(r => r.json()).then(d => setLogs(d?.logs || [])).catch(() => setLogs([])); }, [selectedLog]);

  const upd = (patch) => setActive(p => ({ ...p, ...patch }));
  const updSettings = (patch) => setActive(p => ({ ...p, settings: { ...p.settings, ...patch } }));
  const updExp = (patch) => setActive(p => ({ ...p, settings: { ...p.settings, experience: { ...(p.settings?.experience || {}), ...patch } } }));
  const updLayout = (patch) => setActive(p => ({ ...p, settings: { ...p.settings, layout: { ...(p.settings?.layout || {}), ...patch } } }));
  const updButton = (key, patch) => setActive(p => { const base = p.buttons || DEFAULT_BUTTONS; const cur = base[key] || { label: "", style: {} }; return { ...p, buttons: { ...base, [key]: { ...cur, ...patch } } }; });
  const updBtnStyle = (key, patch) => setActive(p => { const base = p.buttons || DEFAULT_BUTTONS; const cur = base[key] || { label: "", style: {} }; return { ...p, buttons: { ...base, [key]: { ...cur, style: { ...(cur.style || {}), ...patch } } } }; });

  const openEditor = async (linkId) => {
    const d = await fetch(`/api/letters/${linkId}`).then(r => r.json());
    const norm = flattenSectionsToBlocks(d);
    const s = norm.settings || {};
    if (s.expiryValue == null && s.expiryHours != null) { s.expiryValue = s.expiryHours; s.expiryUnit = s.expiryUnit || "hours"; }
    setActive({ ...norm, doc: getLetterDoc(norm) });
    setTab("content"); setView("editor");
  };

  const createLetter = async (title, template) => {
    const base = newLetter();
    const t = template || getTemplate("blank");
    base.title = (title && title.trim()) || (t.key !== "blank" ? t.name : "Untitled Letter");
    base.theme = t.theme || defaults.theme || base.theme;
    if (t.customTheme) base.customTheme = t.customTheme;
    if (t.opening) base.opening = t.opening;
    if (t.doc) { base.doc = t.doc; base.blocks = []; }
    if (t.buttons) base.buttons = { ...base.buttons, ...t.buttons };
    base.settings.experience = { ...base.settings.experience, ...(defaults.experience || {}), ...(t.experience || {}) };
    base.settings.layout = { ...base.settings.layout, ...(defaults.layout || {}) };
    const res = await fetch("/api/letters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(base) }).catch(() => null);
    if (!res || !res.ok) {
      alert("Couldn't create the letter. " + (res?.status === 401
        ? "Admin session invalid on the server (401) — on a live site this is usually Clerk DEV keys; switch to production keys."
        : `Server error (${res?.status || "network"}).`));
      return;
    }
    const d = await res.json();
    await loadLetters();
    const norm = flattenSectionsToBlocks(d);
    const s = norm.settings || {};
    if (s.expiryValue == null && s.expiryHours != null) { s.expiryValue = s.expiryHours; s.expiryUnit = s.expiryUnit || "hours"; }
    setActive({ ...norm, doc: getLetterDoc(norm) }); setTab(t.key === "custom" ? "themes" : "content"); setView("editor");
  };
  const startNew = () => { setNewName(""); setNewTpl("blank"); setCreatingNew(true); setNavOpen(false); };
  const confirmNew = () => { const t = getTemplate(newTpl); setCreatingNew(false); createLetter(newName, t); };

  const duplicateLetter = async (l) => {
    const full = await fetch(`/api/letters/${l.linkId}`).then(r => r.json());
    const copy = { ...newLetter(), title: (full.title || "Untitled") + " (copy)", opening: full.opening, blocks: full.blocks || [], doc: full.doc || getLetterDoc(full), theme: full.theme, customTheme: full.customTheme, buttons: full.buttons, settings: full.settings };
    await fetch("/api/letters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(copy) });
    loadLetters();
  };
  const doDelete = async () => {
    const l = confirmDel; if (!l) return;
    setConfirmDel(null);
    setLetters(ls => ls.filter(x => x.linkId !== l.linkId));
    if (active?.linkId === l.linkId) { setActive(null); setView("home"); }
    await fetch(`/api/letters/${l.linkId}`, { method: "DELETE" });
    loadLetters();
  };
  const patchLetter = async (linkId, body) => { await fetch(`/api/letters/${linkId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); loadLetters(); };
  const renameLetter = async (linkId, title) => {
    const t = (title || "").trim() || "Untitled";
    setLetters(ls => ls.map(l => l.linkId === linkId ? { ...l, title: t } : l));
    if (active?.linkId === linkId) setActive(p => ({ ...p, title: t }));
    await fetch(`/api/letters/${linkId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: t }) });
  };

  const save = async () => {
    const body = { ...active, linkId: active.linkId };
    let res;
    try {
      res = await fetch("/api/letters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } catch {
      alert("Couldn't save — network error. Check your connection.");
      return null;
    }
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const hint = res.status === 401
        ? "Your admin session isn't valid on the server (401)."
        : res.status === 403 ? "This letter belongs to a different account (403)."
        : `Server error (${res.status}).`;
      alert("Couldn't save. " + hint + (data.detail ? `\n\nDetail: ${data.detail}` : ""));
      return null;
    }
    const letter = await res.json();
    setActive(p => ({ ...p, linkId: letter.linkId, stats: letter.stats }));
    setSaved(true); setTimeout(() => setSaved(false), 2000); loadLetters();
    return letter.linkId || active.linkId;
  };

  // Preview ALWAYS reflects current edits: save first (so the draft is on the
  // server), then open the reader in preview mode (which never counts a read).
  // The tab is opened synchronously so the browser doesn't block it as a popup.
  const previewLetter = async () => {
    const w = window.open("", "_blank");
    const id = await save();
    if (w) { if (id) w.location = `/read/${id}?preview=1`; else w.close(); }
  };

  const saveDefaults = async (next) => { setDefaults(next); fetch("/api/me/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }).catch(() => {}); };

  const theme = active ? getTheme(active) : THEMES.darkAmber;
  const st = active?.settings || {};

  // ════════════════ SHELL ════════════════
  return (
   <ThemeCtx.Provider value={A}>
    <div style={{ display: "flex", minHeight: "100vh", background: A.bg, color: A.text }}>
      {navOpen && <div className="md:hidden" onClick={() => setNavOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 30 }} />}
      {/* ─── SIDEBAR ─── */}
      <aside className={`fixed md:sticky top-0 z-40 transition-transform duration-200 ${navOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
        style={{ width: 250, flexShrink: 0, background: A.side, borderRight: `1px solid ${A.border}`, display: "flex", flexDirection: "column", height: "100vh" }}>
        <div className="flex items-center gap-2 px-3 py-3" style={{ borderBottom: `1px solid ${A.border}` }}>
          <BrandMark className="flex-1" />
          <button onClick={toggleMode} title={mode === "dark" ? "Light mode" : "Dark mode"} className="p-1 rounded-md" style={{ color: A.dim }}>{mode === "dark" ? <IcoSun /> : <IcoMoon />}</button>
          {CLERK_ON && <UserButton afterSignOutUrl="/" />}
        </div>

        <div className="p-2 overflow-y-auto flex-1">
          <SideItem icon={<IcoHome />} label="Home" active={view === "home"} onClick={() => { setView("home"); setNavOpen(false); }} />
          <SideItem icon={<IcoPen />} label="New letter" onClick={startNew} />

          <SideHeader>Letters</SideHeader>
          {letters.length === 0 && <p className="text-[11px] px-2 py-1" style={{ color: A.dim }}>No letters yet</p>}
          {letters.map(l => {
            const s = letterStatus(l);
            return (
              <button key={l.linkId} onClick={() => { openEditor(l.linkId); setNavOpen(false); }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[13px]"
                style={{ background: view === "editor" && active?.linkId === l.linkId ? A.card : "transparent", color: A.text }}>
                <span style={{ color: A.dim }}><IcoDoc /></span>
                <span className="flex-1 truncate">{l.title || "Untitled"}</span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STC[s] }} title={s} />
              </button>
            );
          })}

          <SideHeader>Analytics</SideHeader>
          <SideItem icon={<IcoChart />} label="Analytics" active={view === "analytics"} onClick={() => { setView("analytics"); setAnLetterId(null); setSelectedLog(null); setNavOpen(false); }} />
        </div>

        <div className="p-2" style={{ borderTop: `1px solid ${A.border}` }}>
          <a href="/" className="flex items-center gap-1.5 text-[11px] px-2 py-1.5 rounded-md" style={{ color: A.dim }}><IcoLink /> View public site</a>
        </div>
      </aside>

      {/* ─── MAIN ─── */}
      <main style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: "auto" }}>
        <div className="md:hidden flex items-center gap-3 px-4 py-3 sticky top-0 z-20" style={{ borderBottom: `1px solid ${A.border}`, background: A.bg }}>
          <button onClick={() => setNavOpen(true)} className="text-lg leading-none px-2 py-1 rounded-md" style={{ color: A.bright, border: `1px solid ${A.border}` }} aria-label="Menu">☰</button>
          <BrandMark />
        </div>
        {view === "home" && <HomePane name={CLERK_ON ? <WorkspaceName /> : "your"} letters={letters} createLetter={startNew} openEditor={openEditor} patchLetter={patchLetter} duplicateLetter={duplicateLetter} deleteLetter={setConfirmDel} renameLetter={renameLetter} appUrl={appUrl} defaults={defaults} saveDefaults={saveDefaults} />}

        {view === "editor" && active && (
          <EditorPane {...{ active, setActive, theme, st, tab, setTab, save, saved, previewLetter, appUrl, upd, updSettings, updExp, updLayout, updButton, updBtnStyle }} />
        )}

        {view === "analytics" && !anLetterId && <OverviewPane letters={letters} allSessions={allSessions} onOpen={(id) => { setAnLetterId(id); setSelectedLog(null); }} />}
        {view === "analytics" && anLetterId && (
          <LetterAnalytics {...{ letters, anLetterId, setAnLetterId, sessions, setSessions, selectedLog, setSelectedLog, logs }} />
        )}
      </main>

      {/* ─── New-letter: name + template gallery ─── */}
      {creatingNew && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.6)", zIndex: 50 }} onMouseDown={e => { if (e.target === e.currentTarget) setCreatingNew(false); }}>
          <div className="rounded-2xl p-6 w-full max-w-2xl" style={{ background: A.card, border: `1px solid ${A.border}`, maxHeight: "88vh", overflowY: "auto" }}>
            <p className="text-[10px] tracking-widest uppercase mb-1" style={{ color: A.dim }}>New letter</p>
            <h2 className="text-lg font-semibold mb-4" style={{ color: A.bright }}>Name it &amp; pick a starting design</h2>
            <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmNew(); if (e.key === "Escape") setCreatingNew(false); }}
              placeholder="Name (optional — defaults to the template name)" className="w-full rounded-lg p-3 text-sm mb-4" style={inp(A)} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
              {TEMPLATES.map(t => (
                <button key={t.key} onClick={() => setNewTpl(t.key)} className="text-left rounded-xl overflow-hidden transition-all"
                  style={{ border: `2px solid ${newTpl === t.key ? A.accent : A.border}`, background: A.bg }}>
                  <TemplatePreview t={t} />
                  <div className="px-2.5 py-2">
                    <div className="text-xs font-semibold flex items-center gap-1" style={{ color: A.bright }}>{t.emoji} {t.name}</div>
                    <div className="text-[10px]" style={{ color: A.dim }}>{t.blurb}</div>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreatingNew(false)} className="text-xs px-4 py-2 rounded-lg" style={{ color: A.dim, border: `1px solid ${A.border}` }}>Cancel</button>
              <button onClick={confirmNew} className="text-xs px-4 py-2 rounded-lg font-medium" style={{ background: A.accent, color: A.onAccent }}>Create →</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Soft delete confirmation ─── */}
      {confirmDel && (
        <div className="fixed inset-0 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,.6)", zIndex: 50 }} onMouseDown={e => { if (e.target === e.currentTarget) setConfirmDel(null); }}>
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: A.card, border: `1px solid ${A.red}44` }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: A.red }}><IcoTrash /><h2 className="text-lg font-semibold">Delete this letter?</h2></div>
            <p className="text-sm mb-1" style={{ color: A.bright }}>“{confirmDel.title || "Untitled"}”</p>
            <p className="text-[12px] mb-5" style={{ color: A.dim }}>This permanently removes the letter and its analytics. The shared link will stop working. This can&rsquo;t be undone.</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="text-xs px-4 py-2 rounded-lg" style={{ color: A.dim, border: `1px solid ${A.border}` }}>Cancel</button>
              <button onClick={doDelete} className="flex items-center gap-1.5 text-xs px-4 py-2 rounded-lg font-medium" style={{ background: A.red, color: "#fff" }}><IcoTrash /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
   </ThemeCtx.Provider>
  );
}

function WorkspaceName() {
  const { user } = useUser();
  const n = user?.firstName || user?.username || (user?.primaryEmailAddress?.emailAddress || "").split("@")[0] || "My";
  return <>{n}&rsquo;s Letters</>;
}

// The feather/quill mark from the landing hero — currentColor so it inherits.
const Feather = (p) => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p}><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></svg>;

// App brand: feather badge + "A Last Note" in italic serif.
function BrandMark({ className = "" }) {
  const A = useTheme();
  return (
    <span className={`flex items-center gap-2 min-w-0 ${className}`}>
      <span className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0" style={{ background: A.accent, color: A.onAccent }}><Feather /></span>
      <span className="truncate" style={{ color: A.bright, fontFamily: "'Cormorant Garamond', Georgia, serif", fontStyle: "italic", fontWeight: 600, fontSize: 16 }}>A Last Note</span>
    </span>
  );
}

function SideHeader({ children }) {
  const A = useTheme();  return <div className="text-[10px] tracking-widest uppercase px-2 mt-4 mb-1" style={{ color: A.dim }}>{children}</div>;
}
function SideItem({ icon, label, active, onClick }) {
  const A = useTheme();  return (
    <button onClick={onClick} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-[13px]"
      style={{ background: active ? A.card : "transparent", color: active ? A.bright : A.text }}>
      <span style={{ fontSize: 13 }}>{icon}</span><span className="flex-1">{label}</span>
    </button>
  );
}

// ════════════════ HOME ════════════════
function HomePane({ name, letters, createLetter, openEditor, patchLetter, duplicateLetter, deleteLetter, renameLetter, appUrl, defaults, saveDefaults }) {
  const A = useTheme();  const [showDefaults, setShowDefaults] = useState(false);
  const [renaming, setRenaming] = useState(null); // { id, value }
  const exp = defaults.experience || {};
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-14">
      <p className="text-[11px] tracking-[4px] uppercase mb-3" style={{ color: A.dim }}>Your workspace</p>
      <h1 className="text-4xl font-bold mb-2" style={{ color: A.bright }}>{name}</h1>
      <p className="text-sm mb-8" style={{ color: A.dim }}>Write something you could never say out loud. Send it once. Let it go.</p>

      <div className="flex gap-2 mb-10 flex-wrap">
        <button onClick={createLetter} className="text-sm px-4 py-2.5 rounded-xl font-medium" style={{ background: A.accent, color: A.onAccent }}>✍️  Write a new letter</button>
        <button onClick={() => setShowDefaults(s => !s)} className="text-sm px-4 py-2.5 rounded-xl" style={{ color: A.text, border: `1px solid ${A.border}` }}>⚙️  Workspace defaults</button>
      </div>

      {showDefaults && (
        <div className="rounded-2xl p-5 mb-10" style={{ background: A.card, border: `1px solid ${A.border}` }}>
          <p className="text-[10px] tracking-widest uppercase mb-3" style={{ color: A.dim }}>Defaults for new letters</p>
          <Row label="Default theme" sub="New letters start with this theme">
            <select className="rounded-lg p-2 text-xs" style={inp(A)} value={defaults.theme || "darkAmber"} onChange={e => saveDefaults({ ...defaults, theme: e.target.value })}>
              {Object.entries(THEMES).map(([k, t]) => <option key={k} value={k}>{t.icon} {t.name}</option>)}
            </select></Row>
          <Row label="🌬 Default breathing reveal" sub="Pace new letters inherit">
            <select className="rounded-lg p-2 text-xs" style={inp(A)} value={exp.breathPace || 0} onChange={e => saveDefaults({ ...defaults, experience: { ...exp, breathPace: Number(e.target.value) } })}>
              <option value={0}>Off</option>{[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}s / line</option>)}
            </select></Row>
          <Row label="🔥 Default ember dissolve" sub="">
            <Toggle val={!!exp.emberDissolve} toggle={() => saveDefaults({ ...defaults, experience: { ...exp, emberDissolve: !exp.emberDissolve } })} /></Row>
          <Row label="🕯 Default tender analytics" sub="">
            <Toggle val={!!exp.minimalAnalytics} toggle={() => saveDefaults({ ...defaults, experience: { ...exp, minimalAnalytics: !exp.minimalAnalytics } })} /></Row>
          <p className="text-[10px] tracking-widest uppercase mb-2 mt-5" style={{ color: A.dim }}>📐 Default reading position</p>
          <p className="text-[11px] mb-3" style={{ color: A.dim }}>Applies to every letter that doesn&rsquo;t set its own position.</p>
          <LayoutControls layout={defaults.layout} on={patch => saveDefaults({ ...defaults, layout: { ...(defaults.layout || {}), ...patch } })} />
        </div>
      )}

      <p className="text-[11px] tracking-widest uppercase mb-3" style={{ color: A.dim }}>Recent letters</p>
      {letters.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: A.card, border: `1px dashed ${A.border}` }}>
          <p className="text-sm" style={{ color: A.dim }}>Nothing here yet. Write your first letter ↑</p>
        </div>
      ) : (
        <div className="grid gap-2">
          {letters.map(l => {
            const s = letterStatus(l); const reads = l.stats?.totalReads || 0; const cap = l.settings?.totalLimit;
            return (
              <div key={l.linkId} className="rounded-xl p-4 flex items-center gap-3 flex-wrap" style={{ background: A.card, border: `1px solid ${A.border}` }}>
                <div className="flex-1 min-w-[180px]">
                  {renaming?.id === l.linkId ? (
                    <input autoFocus value={renaming.value} onChange={e => setRenaming({ id: l.linkId, value: e.target.value })}
                      onBlur={() => { renameLetter(l.linkId, renaming.value); setRenaming(null); }}
                      onKeyDown={e => { if (e.key === "Enter") { renameLetter(l.linkId, renaming.value); setRenaming(null); } if (e.key === "Escape") setRenaming(null); }}
                      className="text-sm font-semibold rounded px-1.5 py-0.5 w-full max-w-xs" style={{ ...inp(A), color: A.bright }} />
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold cursor-pointer" style={{ color: A.bright }} onClick={() => openEditor(l.linkId)}>{l.title || "Untitled"}</span>
                      <button onClick={() => setRenaming({ id: l.linkId, value: l.title || "" })} title="Rename" className="opacity-50 hover:opacity-100" style={{ color: A.dim }}><IcoPen /></button>
                      <span className="text-[9px] px-2 py-0.5 rounded-full uppercase tracking-wide" style={{ background: STC[s] + "20", color: STC[s] }}>{s}</span>
                      {l.settings?.password && <span title="password">🔒</span>}
                    </div>
                  )}
                  <div className="text-[11px] mt-1 cursor-pointer" style={{ color: A.dim }} onClick={() => openEditor(l.linkId)}>{l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "—"} · {reads}{cap != null ? `/${cap}` : ""} reads</div>
                </div>
                <label className="flex items-center gap-1.5 text-[10px]" style={{ color: A.dim }}>On<Toggle val={l.settings?.enabled !== false} toggle={() => patchLetter(l.linkId, { settings: { enabled: !(l.settings?.enabled !== false) } })} /></label>
                <a href={`/read/${l.linkId}?preview=1`} target="_blank" rel="noreferrer" className="text-[10px] px-2.5 py-1.5 rounded-lg" style={{ color: A.text, border: `1px solid ${A.border}` }}>Preview</a>
                <button onClick={() => duplicateLetter(l)} title="Duplicate" className="px-2 py-1.5 rounded-lg" style={{ color: A.dim, border: `1px solid ${A.border}` }}><IcoCopy /></button>
                <button onClick={() => deleteLetter(l)} className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg" style={{ color: A.red, border: `1px solid ${A.red}33` }}><IcoTrash /> Delete</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ════════════════ EDITOR ════════════════
function EditorPane({ active, setActive, theme, st, tab, setTab, save, saved, previewLetter, appUrl, upd, updSettings, updExp, updLayout, updButton, updBtnStyle }) {
  const A = useTheme();  const ttab = t => `px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer ${tab === t ? "" : ""}`;
  const [copied, setCopied] = useState(false);
  // Copy with a fallback for browsers/contexts without navigator.clipboard, plus
  // visible "Copied!" feedback.
  const copyText = async (text) => {
    let ok = false;
    try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch { /* fall through */ }
    if (!ok) {
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
        document.body.appendChild(ta); ta.focus(); ta.select();
        ok = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch { ok = false; }
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1800); }
    else { window.prompt("Copy this link:", text); }
  };
  return (
    <div>
      <div className="flex items-center gap-3 px-4 md:px-6 py-3 flex-wrap sticky top-0 z-20" style={{ borderBottom: `1px solid ${A.border}`, background: A.bg }}>
        <input value={active.title || ""} onChange={e => upd({ title: e.target.value })} placeholder="Untitled letter"
          className="text-base font-semibold flex-1 bg-transparent outline-none" style={{ color: A.bright, minWidth: 120 }} />
        <button onClick={previewLetter} title="Saves your latest edits, then opens the reader view (does not count as a read)" className="text-xs px-3 py-1.5 rounded-lg" style={{ background: A.green + "15", color: A.green, border: `1px solid ${A.green}33` }}>↗ Preview</button>
        <button onClick={save} title="Saves and publishes — the shared link now shows these edits" className="text-xs px-4 py-2 rounded-lg font-medium" style={{ background: saved ? A.green : A.accent, color: A.onAccent }}>{saved ? "✓ Saved" : "Save & Publish"}</button>
      </div>

      <div className="flex gap-1 px-4 md:px-6 py-2 flex-wrap overflow-x-auto" style={{ borderBottom: `1px solid ${A.border}` }}>
        {["content", "themes", "buttons", "experience", "share"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={ttab(t)}
            style={{ background: tab === t ? A.accent + "20" : "transparent", color: tab === t ? A.accent : A.dim }}>
            {({ content: "Write", themes: "Theme", buttons: "Buttons", experience: "Experience", share: "Share" })[t]}
          </button>
        ))}
      </div>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-6">
        {tab === "content" && (
          <div>
            <label className="text-[10px] tracking-widest uppercase block mb-2" style={{ color: A.dim }}>Opening — the first line they see</label>
            <textarea className="w-full rounded-xl px-4 py-3 mb-7" style={{ ...inp(A), resize: "vertical", fontSize: 15, lineHeight: 1.6 }} rows={2} placeholder="A soft line to open with, before they press Start…" value={active.opening || ""} onChange={e => upd({ opening: e.target.value })} />
            <LetterEditor key={active.linkId || "new"} doc={active.doc} onChange={(doc) => upd({ doc })} theme={theme} ui={A} />
          </div>
        )}
        {tab === "themes" && <ThemesTab active={active} setActive={setActive} theme={theme} />}
        {tab === "buttons" && (
          <div>
            <label className="text-[10px] tracking-widest uppercase block mb-3" style={{ color: A.dim }}>Buttons</label>
            {[["start", "Start (landing)"], ["readMore", "Read More"], ["finish", "Finish (last page)"]].map(([key, label]) => {
              const btn = active.buttons?.[key] || { label: "", style: {} };
              return (
                <div key={key} className="rounded-xl p-4 mb-3" style={{ background: A.card, border: `1px solid ${A.border}` }}>
                  <div className="text-xs font-semibold mb-3" style={{ color: A.bright }}>{label}</div>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div><label className="text-[10px] block mb-1" style={{ color: A.dim }}>Label</label><input style={inp(A)} value={btn.label} onChange={e => updButton(key, { label: e.target.value })} /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <ColorField label="Text" val={btn.style?.color} on={v => updBtnStyle(key, { color: v })} />
                      <ColorField label="Bg" val={btn.style?.bg} on={v => updBtnStyle(key, { bg: v })} />
                      <ColorField label="Border" val={btn.style?.border} on={v => updBtnStyle(key, { border: v })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <NumField label="Radius" val={btn.style?.radius} on={v => updBtnStyle(key, { radius: v })} />
                    <NumField label="Font px" val={btn.style?.fontSize} on={v => updBtnStyle(key, { fontSize: v })} />
                    <NumField label="Spacing" val={btn.style?.letterSpacing} on={v => updBtnStyle(key, { letterSpacing: v })} />
                    <div><label className="text-[9px] block mb-0.5" style={{ color: A.dim }}>Padding</label><input style={{ ...inp(A), padding: "5px 7px" }} placeholder="13px 32px" value={btn.style?.padding || ""} onChange={e => updBtnStyle(key, { padding: e.target.value })} /></div>
                  </div>
                  <div className="rounded-lg p-4 flex justify-center" style={{ background: theme.bg, border: `1px solid ${A.border}` }}><button style={resolveButtonStyle(btn, theme, key === "finish")}>{btn.label || "Button"}</button></div>
                </div>
              );
            })}
          </div>
        )}
        {tab === "experience" && (() => {
          const exp = st.experience || {}; const localDt = toLocalInput(exp.sealedFrom);
          return (
            <div>
              <label className="text-[10px] tracking-widest uppercase block mb-1" style={{ color: A.dim }}>The Experience</label>
              <p className="text-[11px] mb-4" style={{ color: A.dim }}>Each is optional. Off = the plain reading. On = something more felt.</p>
              <div className="rounded-xl p-5 mb-3" style={{ background: A.card, border: `1px solid ${A.border}` }}>
                <Row label="🌬  Breathing reveal" sub="Lines arrive at the pace of a slow breath — the reader can't rush it">
                  <select className="rounded-lg p-2 text-xs" style={inp(A)} value={exp.breathPace || 0} onChange={e => updExp({ breathPace: Number(e.target.value) })}>
                    <option value={0}>Off</option>{[2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n}s / line</option>)}
                  </select></Row>
                <Row label="🔥  Ember dissolve" sub="At the end, the words drift apart like embers — a goodbye you watch happen">
                  <Toggle val={!!exp.emberDissolve} toggle={() => updExp({ emberDissolve: !exp.emberDissolve })} /></Row>
                <Row label="✉️  Sealed until" sub="Stays sealed until this moment. Leave blank for no seal">
                  <input type="datetime-local" className="rounded-lg p-2 text-xs" style={inp(A)} value={localDt} onChange={e => updExp({ sealedFrom: e.target.value ? new Date(e.target.value).toISOString() : null })} /></Row>
                <Row label="🕯  Tender analytics" sub="Replace forensic tracking with one signal: did it land?">
                  <Toggle val={!!exp.minimalAnalytics} toggle={() => updExp({ minimalAnalytics: !exp.minimalAnalytics })} /></Row>
              </div>

              <label className="text-[10px] tracking-widest uppercase block mb-2 mt-5" style={{ color: A.dim }}>📐 Reading position</label>
              <p className="text-[11px] mb-3" style={{ color: A.dim }}>Where the letter sits when it&rsquo;s read — on a phone and on a laptop.</p>
              <LayoutControls layout={st.layout} on={updLayout} />

              <label className="text-[10px] tracking-widest uppercase block mb-2 mt-5" style={{ color: A.dim }}>✨ Story Animation</label>
              <div className="rounded-xl p-5 mb-3" style={{ background: A.card, border: `1px solid ${A.border}` }}>
                <Row label="Block animation" sub="How each block (line, image, sticker) appears on the reader">
                  <select className="rounded-lg p-2 text-xs" style={inp(A)} value={exp.blockReveal || "none"} onChange={e => updExp({ blockReveal: e.target.value })}>
                    {[["none", "None"], ["fade", "Fade in"], ["slideUp", "Slide up"], ["zoom", "Zoom in"], ["slideLeft", "Slide left"], ["slideRight", "Slide right"], ["float", "Float"], ["bounce", "Bounce"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></Row>
                <Row label="Block speed" sub="Pause between each block">
                  <select className="rounded-lg p-2 text-xs" style={inp(A)} value={exp.revealStagger ?? ""} onChange={e => updExp({ revealStagger: e.target.value === "" ? null : Number(e.target.value) })}>
                    <option value="">Default</option>{[["0", "Instant"], ["0.08", "Fast"], ["0.15", "Gentle"], ["0.3", "Slow"], ["0.6", "Very slow"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></Row>
                <Row label="Word animation" sub="Each word animates in — typewriter, wave, etc.">
                  <select className="rounded-lg p-2 text-xs" style={inp(A)} value={exp.wordAnim || "none"} onChange={e => updExp({ wordAnim: e.target.value })}>
                    {[["none", "None"], ["typewriter", "Typewriter"], ["fade", "Fade"], ["slideUp", "Slide up"], ["wave", "Wave"], ["bounce", "Bounce"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></Row>
                <Row label="Word speed" sub="Pause between each word">
                  <select className="rounded-lg p-2 text-xs" style={inp(A)} value={exp.wordStagger ?? 0.04} onChange={e => updExp({ wordStagger: Number(e.target.value) })}>
                    {[["0.02", "Fast"], ["0.04", "Normal"], ["0.07", "Slow"], ["0.12", "Very slow"]].map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select></Row>
              </div>
              <p className="text-[11px]" style={{ color: A.dim }}>Preview in the reader (↗ Preview). More coming — the writer&rsquo;s own letting-go, a wordless reply, your voice.</p>
            </div>
          );
        })()}
        {tab === "share" && (
          <div>
            {active.linkId && (
              <div className="rounded-xl p-5 mb-4" style={{ background: A.green + "08", border: `1px solid ${A.green}33` }}>
                <h3 className="text-sm font-semibold mb-2" style={{ color: A.green }}>Shareable link</h3>
                <div className="flex items-center gap-2 mb-3">
                  <code className="flex-1 text-xs p-2.5 rounded-lg" style={{ background: A.bg, color: A.bright, border: `1px solid ${A.border}` }}>{appUrl}/read/{active.linkId}</code>
                  <button onClick={() => copyText(`${appUrl}/read/${active.linkId}`)} className="text-xs px-3 py-2 rounded-lg" style={{ background: A.accent, color: A.onAccent }}>{copied ? "Copied!" : "Copy"}</button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <a href={`https://wa.me/?text=${encodeURIComponent(`${appUrl}/read/${active.linkId}`)}`} target="_blank" rel="noreferrer" className="text-xs px-3 py-2 rounded-lg" style={{ background: "#25D366", color: "#fff" }}>WhatsApp</a>
                  <img alt="QR" width={96} height={96} style={{ borderRadius: 8, background: "#fff", padding: 4 }} src={`https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(`${appUrl}/read/${active.linkId}`)}`} />
                </div>
              </div>
            )}
            <div className="rounded-xl p-5 mb-4" style={{ background: A.card, border: `1px solid ${A.border}` }}>
              <h3 className="text-sm font-semibold mb-3" style={{ color: A.bright }}>Access & lifetime</h3>
              <Row label="Letter enabled" sub="Master on/off — turn the whole letter on or off anytime, even after sending"><Toggle val={st.enabled !== false} toggle={() => updSettings({ enabled: !(st.enabled !== false) })} /></Row>
              <Row label="Self-expiry" sub="When on, the letter stops opening after the time below (counted from when you publish)"><Toggle val={st.expiryEnabled !== false} toggle={() => updSettings({ expiryEnabled: !(st.expiryEnabled !== false) })} /></Row>
              <Row label="Expires after" sub="Time from publish until it stops opening. Blank = no auto-expiry">
                <div className="flex gap-1 items-center">
                  <input type="number" min="1" className="w-16 text-center rounded-lg p-2 text-xs" style={inp(A)} placeholder="24" value={st.expiryValue ?? ""} onChange={e => updSettings({ expiryValue: intOrNull(e.target.value) })} />
                  <select className="rounded-lg p-2 text-xs" style={inp(A)} value={st.expiryUnit || "hours"} onChange={e => updSettings({ expiryUnit: e.target.value })}>
                    <option value="minutes">minutes</option><option value="hours">hours</option><option value="days">days</option>
                  </select>
                </div></Row>
              <Row label="Total reads cap" sub="After this many opens (across everyone) the letter self-seals. Blank = unlimited"><input type="number" min="1" className="w-20 text-center rounded-lg p-2 text-xs" style={inp(A)} placeholder="∞" value={st.totalLimit ?? ""} onChange={e => updSettings({ totalLimit: intOrNull(e.target.value) })} /></Row>
              <Row label="Per-reader cap" sub="How many times one person may re-open it. Blank = unlimited"><input type="number" min="1" className="w-20 text-center rounded-lg p-2 text-xs" style={inp(A)} placeholder="∞" value={st.perReaderLimit ?? ""} onChange={e => updSettings({ perReaderLimit: intOrNull(e.target.value) })} /></Row>
              <Row label="Reader name" sub="Ask who they are">
                <select className="rounded-lg p-2 text-xs" style={inp(A)} value={st.nameMode || "off"} onChange={e => updSettings({ nameMode: e.target.value })}><option value="off">Don&apos;t ask</option><option value="optional">Optional</option><option value="required">Required</option></select></Row>
              <Row label="Password" sub="Hashed server-side. Blank to keep; type to change">
                <div className="flex gap-1 items-center">
                  <input type="password" className="w-36 rounded-lg p-2 text-xs" style={inp(A)} placeholder={st.password === "__KEEP__" ? "•••• (set)" : "none"} value={st.password === "__KEEP__" ? "" : (st.password || "")} onChange={e => updSettings({ password: e.target.value })} />
                  {st.password === "__KEEP__" && <button onClick={() => updSettings({ password: null })} className="text-[10px] px-2 py-1.5 rounded-lg" style={{ color: A.red, border: `1px solid ${A.red}33` }}>Remove</button>}
                </div></Row>
              <Row label="End message" sub="Final fade text (default “Ab ho gaya.”)"><input className="w-44 rounded-lg p-2 text-xs" style={inp(A)} placeholder="Ab ho gaya." value={st.endMessage || ""} onChange={e => updSettings({ endMessage: e.target.value })} /></Row>
            </div>
            <div className="rounded-xl p-5" style={{ background: A.card, border: `1px solid ${A.border}` }}>
              <h3 className="text-sm font-semibold mb-1" style={{ color: A.bright }}>🛡 Protection (anti-capture)</h3>
              <p className="text-[11px] mb-2" style={{ color: A.dim }}>A strong deterrent, not a guarantee — browsers can&apos;t force all OS screenshots of text to be black.</p>
              <Row label="Protection mode" sub="Blackout on capture/focus-loss + anti-copy + watermark"><Toggle val={!!st.drm} toggle={() => updSettings({ drm: !st.drm })} /></Row>
              <Row label="Hold to reveal" sub="Blurred unless pressed & held"><Toggle val={!!st.holdToReveal} toggle={() => updSettings({ holdToReveal: !st.holdToReveal })} /></Row>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════ ANALYTICS: OVERVIEW (click a letter to drill in) ════════════════
function OverviewPane({ letters, allSessions, onOpen }) {
  const A = useTheme();  const totalReads = letters.reduce((a, l) => a + (l.stats?.totalReads || 0), 0);
  const opened = allSessions.length;
  const finished = allSessions.filter(s => s.completed).length;
  const cards = [
    { l: "Letters", v: letters.length, c: A.accent }, { l: "Total reads", v: totalReads, c: A.green },
    { l: "Opened", v: opened, c: A.amber }, { l: "Finished", v: finished, c: A.bright },
  ];
  const perLetter = letters.map(l => {
    const ss = allSessions.filter(s => s.letterId === l.linkId);
    return { l, opened: ss.length, finished: ss.filter(s => s.completed).length };
  });
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <h1 className="text-2xl font-bold mb-1" style={{ color: A.bright }}>Overview</h1>
      <p className="text-sm mb-8" style={{ color: A.dim }}>Across all your letters.</p>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {cards.map((c, i) => (
          <div key={i} className="rounded-xl p-5 text-center" style={{ background: A.card, border: `1px solid ${A.border}` }}>
            <div className="text-3xl font-bold" style={{ color: c.c }}>{c.v}</div>
            <div className="text-[9px] tracking-widest uppercase mt-1" style={{ color: A.dim }}>{c.l}</div>
          </div>
        ))}
      </div>
      <p className="text-[11px] tracking-widest uppercase mb-2" style={{ color: A.dim }}>Per letter <span className="lowercase tracking-normal">· click to open</span></p>
      <div className="rounded-xl overflow-hidden" style={{ background: A.card, border: `1px solid ${A.border}` }}>
        {perLetter.length === 0 && <p className="text-sm p-6 text-center" style={{ color: A.dim }}>No letters yet.</p>}
        {perLetter.map(({ l, opened, finished }) => {
          const s = letterStatus(l);
          return (
            <button key={l.linkId} onClick={() => onOpen(l.linkId)} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-90" style={{ borderBottom: `1px solid ${A.border}55`, background: "transparent" }}>
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STC[s] }} />
              <span className="flex-1 text-sm truncate" style={{ color: A.bright }}>{l.title || "Untitled"}</span>
              <span className="text-xs hidden sm:inline" style={{ color: A.dim }}>{l.stats?.totalReads || 0} reads</span>
              <span className="text-xs" style={{ color: A.amber }}>{opened} opened</span>
              <span className="text-xs" style={{ color: A.green }}>{finished} finished</span>
              <span style={{ color: A.dim }}>›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════ ANALYTICS: ONE LETTER (drilled in) ════════════════
function LetterAnalytics({ letters, anLetterId, setAnLetterId, sessions, setSessions, selectedLog, setSelectedLog, logs }) {
  const A = useTheme();  const sel = letters.find(l => l.linkId === anLetterId);
  const minimal = sel?.settings?.experience?.minimalAnalytics;
  // dedupe by sessionId so a duplicate id can't break selection/highlighting
  const rows = []; const seen = new Set();
  for (const s of sessions) { if (s.sessionId && !seen.has(s.sessionId)) { seen.add(s.sessionId); rows.push(s); } }
  const total = rows.length;
  const completed = rows.filter(s => s.completed).length;
  const activeCount = rows.filter(s => s.status === "reading" && Date.now() - new Date(s.lastPing).getTime() < 15000).length;
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-10">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => { setAnLetterId(null); setSelectedLog(null); }} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ color: A.text, border: `1px solid ${A.border}` }}><IcoBack /> Overview</button>
        <h1 className="text-xl font-bold truncate" style={{ color: A.bright }}>{sel?.title || "Untitled"}</h1>
      </div>

      {sel && minimal && (
        <div className="rounded-2xl p-12 text-center" style={{ background: A.card, border: `1px solid ${A.border}` }}>
          <div className="text-5xl mb-4" style={{ filter: completed > 0 ? "none" : "grayscale(1) opacity(0.4)" }}>🕯️</div>
          <p className="text-lg" style={{ color: completed > 0 ? A.amber : A.dim }}>{completed > 0 ? "It landed." : (total > 0 ? "Opened — not finished yet." : "Not opened yet.")}</p>
          <p className="text-xs mt-3" style={{ color: A.dim }}>{total} opened · {completed} read to the end</p>
          <p className="text-[10px] mt-6 max-w-xs mx-auto leading-relaxed" style={{ color: A.dim }}>Tender mode is on — no device, no tab-switches, no surveillance. Just whether your words were received.</p>
        </div>
      )}

      {sel && !minimal && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            {[{ l: "Opened", v: total, c: A.accent }, { l: "Live", v: activeCount, c: A.green }, { l: "Finished", v: completed, c: A.amber }, { l: "Avg time", v: formatTime(completed > 0 ? rows.filter(s => s.completed).reduce((a, s) => a + (s.totalTime || 0), 0) / completed : 0), c: A.bright }].map((c, i) => (
              <div key={i} className="rounded-xl p-4 text-center" style={{ background: A.card, border: `1px solid ${A.border}` }}>
                <div className="text-2xl font-bold" style={{ color: c.c }}>{c.v}</div><div className="text-[9px] tracking-widest uppercase mt-1" style={{ color: A.dim }}>{c.l}</div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px]" style={{ color: A.dim }}>Tap a reader to see their timeline</span>
            <div className="flex gap-2">
              <button onClick={() => exportSessionsCSV(rows)} className="text-[10px] px-3 py-1.5 rounded-lg" style={{ color: A.accent, border: `1px solid ${A.accent}33` }}>CSV</button>
              <button onClick={() => { if (confirm("Clear all analytics for this letter?")) fetch(`/api/sessions?letterId=${anLetterId}`, { method: "DELETE" }).then(() => { setSessions([]); setSelectedLog(null); }); }} className="text-[10px] px-3 py-1.5 rounded-lg" style={{ color: A.red, border: `1px solid ${A.red}33` }}>Clear</button>
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="rounded-xl p-10 text-center" style={{ background: A.card, border: `1px solid ${A.border}` }}><p className="text-sm" style={{ color: A.dim }}>No readers yet. Share your link!</p></div>
          ) : (
            <div className="rounded-xl overflow-auto mb-6" style={{ background: A.card, border: `1px solid ${A.border}` }}>
              <table className="w-full text-xs" style={{ borderCollapse: "collapse" }}>
                <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["Reader", "Status", "Page", "Time", "Total", "Device", "Zone", "Clicks", "Scroll", "Tabs"].map(h => <th key={h} className="p-2.5 text-left text-[9px] tracking-widest uppercase" style={{ color: A.dim }}>{h}</th>)}</tr></thead>
                <tbody>{rows.map(s => {
                  const on = s.status === "reading" && Date.now() - new Date(s.lastPing).getTime() < 15000;
                  const maxScroll = s.scrollDepthByPage ? Math.max(0, ...Object.values(s.scrollDepthByPage)) : 0;
                  return (<tr key={s.sessionId} onClick={() => setSelectedLog(prev => prev === s.sessionId ? null : s.sessionId)} className="cursor-pointer" style={{ borderBottom: `1px solid ${A.border}55`, background: selectedLog === s.sessionId ? A.accent + "22" : "transparent" }}>
                    <td className="p-2.5 text-[11px]" style={{ color: A.bright }}>{s.name || <span style={{ color: A.dim }}>{s.sessionId?.slice(0, 6)}</span>}</td>
                    <td className="p-2.5"><span className="text-[9px] px-2 py-0.5 rounded-full" style={{ background: (s.completed ? A.amber : on ? A.green : A.red) + "18", color: s.completed ? A.amber : on ? A.green : A.red }}>{s.completed ? "Done" : on ? "Live" : "Away"}</span></td>
                    <td className="p-2.5" style={{ color: A.text }}>{s.completed ? "✓" : (s.currentSection || 0) + 1}</td>
                    <td className="p-2.5 font-mono text-[11px]" style={{ color: A.text }}>{formatTime(s.sectionTime)}</td>
                    <td className="p-2.5 font-mono text-[11px] font-semibold" style={{ color: A.bright }}>{formatTime(s.totalTime)}</td>
                    <td className="p-2.5 text-[11px]" style={{ color: A.dim }}>{s.device}·{s.browser}</td>
                    <td className="p-2.5 text-[10px]" style={{ color: A.dim }}>{s.timezone || "—"}</td>
                    <td className="p-2.5 font-mono" style={{ color: A.dim }}>{s.clicks || 0}</td>
                    <td className="p-2.5 font-mono" style={{ color: A.dim }}>{maxScroll}%</td>
                    <td className="p-2.5 font-mono" style={{ color: (s.tabSwitches || 0) > 2 ? A.red : A.dim }}>{s.tabSwitches || 0}</td>
                  </tr>);
                })}</tbody>
              </table>
            </div>
          )}
          {selectedLog && (
            <div>
              <p className="text-[11px] tracking-widest uppercase mb-2" style={{ color: A.dim }}>Event timeline</p>
              <div className="rounded-xl overflow-auto" style={{ background: A.card, border: `1px solid ${A.border}`, maxHeight: 360 }}>
                {logs.length === 0 ? <div className="p-6 text-center"><p className="text-xs" style={{ color: A.dim }}>No events.</p></div> : (
                  <table className="w-full text-[11px]" style={{ borderCollapse: "collapse" }}>
                    <thead><tr style={{ borderBottom: `1px solid ${A.border}` }}>{["Time", "Event", "Details"].map(h => <th key={h} className="p-2.5 text-left text-[9px] tracking-widest uppercase" style={{ color: A.dim }}>{h}</th>)}</tr></thead>
                    <tbody>{logs.map((l, i) => (
                      <tr key={i}><td className="p-2.5 font-mono text-[10px]" style={{ color: A.dim }}>{new Date(l.ts).toLocaleTimeString()}</td>
                        <td className="p-2.5"><span className="text-[9px] px-2 py-0.5 rounded-full" style={ltag(l.type)}>{l.type}</span></td>
                        <td className="p-2.5" style={{ color: A.text }}>{l.detail || "—"}</td></tr>
                    ))}</tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// A theme's stored font often carries extra fallbacks (", Georgia, serif") that
// don't string-match a dropdown <option>, which makes the <select> render a blank
// "none" row at the top. Match on the primary family so a real option is always
// selected — no phantom empty entry.
const matchFont = (v) => {
  if (!v) return FONT_OPTIONS[0].value;
  const fam = String(v).split(",")[0].trim().toLowerCase();
  return (FONT_OPTIONS.find(f => f.value.split(",")[0].trim().toLowerCase() === fam) || FONT_OPTIONS[0]).value;
};

// ─── Themes tab ───
function ThemesTab({ active, setActive, theme }) {
  const A = useTheme();  const ct = active.customTheme || DEFAULT_CUSTOM_THEME;
  const setCustom = (patch) => setActive(p => ({ ...p, customTheme: { ...(p.customTheme || DEFAULT_CUSTOM_THEME), ...patch } }));
  return (
    <div>
      <label className="text-[10px] tracking-widest uppercase block mb-3" style={{ color: A.dim }}>Reader theme</label>
      <div className="grid grid-cols-4 gap-3 mb-6">
        {Object.entries(THEMES).map(([key, t]) => (
          <div key={key} onClick={() => setActive(p => ({ ...p, theme: key }))} className="rounded-xl p-4 cursor-pointer text-center transition-all hover:scale-[1.02]" style={{ background: t.bg, border: `2px solid ${active.theme === key ? A.accent : t.divider}` }}>
            <div className="text-2xl mb-2">{t.icon}</div><div className="text-[11px] font-medium" style={{ color: t.text }}>{t.name}</div>
            <div className="flex gap-1 justify-center mt-2">{[t.bg, t.text, t.accent].map((c, i) => <div key={i} className="w-3 h-3 rounded-full" style={{ background: c, border: "1px solid rgba(128,128,128,.2)" }} />)}</div>
          </div>
        ))}
        <div onClick={() => setActive(p => ({ ...p, theme: "custom", customTheme: p.customTheme || { ...DEFAULT_CUSTOM_THEME } }))} className="rounded-xl p-4 cursor-pointer text-center" style={{ background: active.theme === "custom" ? A.accent + "12" : A.card, border: `2px solid ${active.theme === "custom" ? A.accent : A.border}` }}>
          <div className="text-2xl mb-2">🎨</div><div className="text-[11px] font-medium" style={{ color: A.bright }}>Custom</div>
        </div>
      </div>
      {active.theme === "custom" && (
        <div className="rounded-xl p-5 mb-6" style={{ background: A.card, border: `1px solid ${A.border}` }}>
          <label className="text-[10px] tracking-widest uppercase block mb-3" style={{ color: A.dim }}>Custom theme</label>
          <div className="grid grid-cols-4 gap-3 mb-4">{[["bg", "Background"], ["surface", "Surface"], ["text", "Text"], ["accent", "Accent"], ["dim", "Muted"], ["divider", "Divider"], ["quoteBg", "Quote Bg"], ["codeBg", "Code Bg"]].map(([k, l]) => <ColorField key={k} label={l} val={ct[k]} on={v => setCustom({ [k]: v })} />)}</div>
          <div className="grid grid-cols-3 gap-3 mb-4">{[["headingFont", "Heading"], ["bodyFont", "Body"], ["codeFont", "Code"]].map(([k, l]) => (
            <div key={k}><label className="text-[10px] block mb-1" style={{ color: A.dim }}>{l} font</label><select className="w-full rounded-lg p-2 text-xs" style={inp(A)} value={matchFont(ct[k])} onChange={e => setCustom({ [k]: e.target.value })}>{FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
          ))}</div>
          <div className="grid grid-cols-3 gap-3 items-end">
            <NumField label="Base font px" val={ct.baseFontSize} on={v => setCustom({ baseFontSize: v })} />
            <NumField label="Content width" val={ct.contentWidth} on={v => setCustom({ contentWidth: v })} />
            <label className="flex items-center gap-2 text-[11px]" style={{ color: A.dim }}>Grain<Toggle val={ct.grain} toggle={() => setCustom({ grain: !ct.grain })} /></label>
          </div>
          <div className="mt-3"><label className="text-[10px] block mb-1" style={{ color: A.dim }}>Background image URL</label><input className="w-full rounded-lg p-2 text-xs" style={inp(A)} placeholder="https://…" value={ct.bgImage || ""} onChange={e => setCustom({ bgImage: e.target.value })} /></div>
        </div>
      )}
      <label className="text-[10px] tracking-widest uppercase block mb-2" style={{ color: A.dim }}>Preview</label>
      <div className="rounded-xl p-8 text-center" style={{ background: theme.bg, border: `1px solid ${theme.divider}` }}>
        <p style={{ fontFamily: theme.headingFont, fontSize: 18, color: theme.text, fontStyle: "italic", marginBottom: 12 }}>This is how your letter looks</p>
        <p style={{ fontFamily: theme.bodyFont, fontSize: theme.baseFontSize || 14, color: theme.dim, lineHeight: 1.8 }}>Body text renders like this</p>
        <div className="mx-auto my-4" style={{ width: 60, height: 1, background: theme.divider }} />
        <p style={{ fontFamily: theme.bodyFont, fontSize: 12, color: theme.accent }}>Accent highlight</p>
      </div>
    </div>
  );
}

// ─── aesthetic line icons (stroke = currentColor) ───
const Svg = (p) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...p} />;
const IcoHome = () => <Svg><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V21h14V9.5" /></Svg>;
const IcoPen = () => <Svg><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></Svg>;
const IcoDoc = () => <Svg><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" /><path d="M14 3v5h5" /></Svg>;
const IcoChart = () => <Svg><path d="M3 3v18h18" /><path d="M7 14v3M12 9v8M17 5v12" /></Svg>;
const IcoBack = () => <Svg><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Svg>;
const IcoLink = () => <Svg width="13" height="13"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></Svg>;
const IcoTrash = () => <Svg width="14" height="14"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /></Svg>;
const IcoCopy = () => <Svg width="14" height="14"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></Svg>;
const IcoSun = () => <Svg width="15" height="15"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>;
const IcoMoon = () => <Svg width="15" height="15"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" /></Svg>;
// AI-style sparkle for the workspace mark
const IcoSpark = ({ size = 15 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l1.8 4.9L18.7 8.7 13.8 10.5 12 15.4l-1.8-4.9L5.3 8.7l4.9-1.8L12 2Z" /><path d="M19 14l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9L19 14Z" opacity=".7" /></svg>;

// Themed mini-preview of a template (its actual theme + heading + a sample line).
function TemplatePreview({ t }) {
  const th = getTheme({ theme: t.theme, customTheme: t.customTheme });
  const title = (t.doc?.content || []).find(n => n.type === "heading")?.content?.[0]?.text || t.name;
  return (
    <div style={{ height: 84, background: th.bg, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 8, right: 10, fontSize: 18, opacity: 0.9 }}>{t.emoji}</div>
      <div style={{ fontFamily: th.headingFont, color: th.text, fontSize: 14, fontWeight: 600, lineHeight: 1.15, maxWidth: "82%" }}>{title}</div>
      <div style={{ width: 38, height: 2, background: th.accent, marginTop: 8, borderRadius: 2 }} />
      <div style={{ fontFamily: th.bodyFont, color: th.dim, fontSize: 9, marginTop: 6 }}>{t.theme}</div>
    </div>
  );
}

// ─── tiny helpers ───
function inp(A = PALETTES.dark) { return { background: A.bg, border: `1px solid ${A.border}`, color: A.bright }; }
// Parse an int field; blank or junk → null (never NaN, which would break gate checks).
function intOrNull(v) { if (v === "" || v == null) return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; }
// Format an ISO date for a datetime-local input in the user's LOCAL time (not UTC).
function toLocalInput(iso) { if (!iso) return ""; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function ColorField({ label, val, on }) {
  const A = useTheme();  return (<div className="flex items-center gap-2"><input type="color" value={val || "#000000"} onChange={e => on(e.target.value)} className="w-8 h-8 rounded-md cursor-pointer" style={{ border: "none", background: "transparent" }} /><div><div className="text-[10px]" style={{ color: A.bright }}>{label}</div><div className="text-[9px] font-mono" style={{ color: A.dim }}>{val}</div></div></div>);
}
function NumField({ label, val, on }) {
  const A = useTheme();  return (<div><label className="text-[9px] block mb-0.5" style={{ color: A.dim }}>{label}</label><input type="number" className="w-full rounded-lg p-2 text-xs" style={inp(A)} value={val ?? ""} onChange={e => on(e.target.value === "" ? undefined : Number(e.target.value))} /></div>);
}
function Row({ label, sub, children }) {
  const A = useTheme();  return (<div className="flex items-center justify-between py-3 gap-3" style={{ borderBottom: `1px solid ${A.border}` }}><div><p className="text-xs" style={{ color: A.bright }}>{label}</p>{sub && <p className="text-[11px]" style={{ color: A.dim }}>{sub}</p>}</div>{children}</div>);
}
// Segmented button group (Top / Center / Bottom etc.)
function Seg({ value, options, on }) {
  const A = useTheme();
  return (
    <div className="flex gap-1 flex-wrap justify-end">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => on(v)} className="text-[11px] px-2.5 py-1.5 rounded-lg" style={{ background: value === v ? A.accent : "transparent", color: value === v ? A.onAccent : A.dim, border: `1px solid ${value === v ? A.accent : A.border}` }}>{l}</button>
      ))}
    </div>
  );
}
// Reading-window position controls — shared by the per-letter Experience tab and
// the workspace "Defaults for new letters" panel. `layout` is the current value,
// `on(patch)` merges a partial update.
function LayoutControls({ layout, on }) {
  const A = useTheme();
  const L = layout || {};
  return (
    <div className="rounded-xl p-5" style={{ background: A.card, border: `1px solid ${A.border}` }}>
      <Row label="Vertical position" sub="Where the letter sits on the reader's screen">
        <Seg value={L.vAlign || "center"} on={v => on({ vAlign: v })} options={[["top", "Top"], ["center", "Center"], ["bottom", "Bottom"]]} />
      </Row>
      <Row label="Width" sub="How wide the reading column is">
        <Seg value={L.width || "normal"} on={v => on({ width: v })} options={[["narrow", "Narrow"], ["normal", "Normal"], ["wide", "Wide"]]} />
      </Row>
      <details className="mt-3">
        <summary className="text-[11px] cursor-pointer" style={{ color: A.dim }}>Fine-tune (optional)</summary>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <NumField label="Content width px" val={L.contentWidth ?? undefined} on={v => on({ contentWidth: v ?? null })} />
          <NumField label="Top offset px" val={L.topOffset ?? undefined} on={v => on({ topOffset: v ?? null })} />
          <NumField label="Side padding px" val={L.sidePadding ?? undefined} on={v => on({ sidePadding: v ?? null })} />
        </div>
        <p className="text-[10px] mt-2" style={{ color: A.dim }}>Blank = use the preset. Content width overrides the Width buttons.</p>
      </details>
    </div>
  );
}
function ltag(type) {
  const colors = { open: "#34d399", name_submitted: "#22d3ee", start: "#d8a24a", next: "#e0b86a", page_view: "#caa05a", click: "#c9a06a", scroll_milestone: "#60a5fa", idle: "#fbbf24", tab_blur: "#e04040", finish: "#d4903a", screenshot_attempt: "#e04040", copy_attempt: "#e04040" };
  return { background: (colors[type] || "#5a5d6e") + "18", color: colors[type] || "#5a5d6e" };
}
function Toggle({ val, toggle }) {
  const A = useTheme();
  return (<div onClick={toggle} className="cursor-pointer flex items-center" style={{ width: 40, height: 22, borderRadius: 11, background: val ? "#34d399" : A.border, padding: 2, justifyContent: val ? "flex-end" : "flex-start" }}><div style={{ width: 18, height: 18, borderRadius: 9, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transition: "all .25s" }} /></div>);
}

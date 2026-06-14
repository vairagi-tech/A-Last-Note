"use client";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";

const CLERK_ON = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

// Branded hero landing. The photo (landscape for desktop, portrait for phones)
// is the backdrop; the letter is rendered as REAL text on top so it stays crisp
// at every size, with the "Begin Reading" button placed in the same amber style.
export default function Home() {
  return (
    <main style={{ position: "relative", minHeight: "100svh", width: "100%", overflow: "hidden", background: "#0b0805" }}>
      {/* Responsive backdrop */}
      <img src="/landscape.jpg" alt="" aria-hidden className="hidden md:block"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      <img src="/portrait.jpg" alt="" aria-hidden className="block md:hidden"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      {/* Legibility wash — dark at the top where the text sits, clear over the desk */}
      <div aria-hidden style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(8,5,3,.72) 0%, rgba(8,5,3,.45) 30%, rgba(8,5,3,.12) 52%, transparent 70%)" }} />

      {/* Account control */}
      {CLERK_ON && (
        <div style={{ position: "absolute", top: 16, right: 18, zIndex: 4 }}>
          <SignedOut>
            <SignInButton mode="modal">
              <button style={{ fontSize: 11, letterSpacing: 1, padding: "6px 12px", borderRadius: 999, color: "#e8d9bf", background: "rgba(0,0,0,.35)", border: "1px solid rgba(216,162,74,.35)", backdropFilter: "blur(4px)", cursor: "pointer" }}>Admin sign in</button>
            </SignInButton>
          </SignedOut>
          <SignedIn><UserButton afterSignOutUrl="/" /></SignedIn>
        </div>
      )}

      {/* The letter, as real text */}
      <div className="lp-hero" style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        {/* feather */}
        <svg className="lp-quill" viewBox="0 0 24 24" fill="none" stroke="#d8a24a" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
          <line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" />
        </svg>

        <div className="lp-eyebrow" style={{ display: "flex", alignItems: "center", gap: 12, color: "#c2a472", fontSize: 11, letterSpacing: 5, textTransform: "uppercase" }}>
          <span style={{ width: 26, height: 1, background: "rgba(194,164,114,.5)" }} />A message, just for you<span style={{ width: 26, height: 1, background: "rgba(194,164,114,.5)" }} />
        </div>

        <h1 className="lp-head" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontWeight: 500, color: "#efe6d4", lineHeight: 1.16, margin: 0 }}>
          Some things are<br />hard to say out loud,<br />
          <span style={{ color: "#e0a445", fontStyle: "italic" }}>so I wrote them here.</span>
        </h1>

        <p className="lp-sub" style={{ color: "#bca990", lineHeight: 1.95, margin: 0, fontFamily: "'Cormorant Garamond', Georgia, serif" }}>
          This is a message from the heart.<br />Take your time. Read when you’re ready.<br />Every word is meant for you.
        </p>

        <Link href="/admin" aria-label="Begin reading" className="lp-begin"
          style={{ display: "inline-flex", alignItems: "center", gap: 12, fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 15, letterSpacing: 4, textTransform: "uppercase", color: "#e9b85b", textDecoration: "none", padding: "13px 32px", borderRadius: 4, border: "1px solid rgba(220,170,90,.55)", background: "rgba(20,12,6,.4)", backdropFilter: "blur(2px)", whiteSpace: "nowrap", transition: "background .25s, border-color .25s, transform .25s" }}>
          Begin Reading <span aria-hidden style={{ fontSize: 17 }}>→</span>
        </Link>

        <div className="lp-lock" style={{ display: "flex", alignItems: "center", gap: 7, color: "#8c7a60", fontSize: 11, letterSpacing: 1 }}>
          <span aria-hidden>🔒</span> This is a private message. It’s just between us.
        </div>
      </div>

      <style>{`
        .lp-hero { justify-content: flex-start; padding: 16vh 24px 0; gap: 20px; }
        .lp-quill { width: 30px; height: 30px; transform: rotate(-8deg); }
        .lp-head { font-size: 30px; }
        .lp-sub { font-size: 15px; }
        .lp-lock { margin-top: 4px; }
        @media (min-width: 768px) {
          .lp-hero { padding: 9vh 24px 0; gap: 26px; }
          .lp-head { font-size: 40px; }
          .lp-sub { font-size: 16px; }
        }
        .lp-begin:hover { background: rgba(233,184,91,.16) !important; border-color: rgba(233,184,91,.9) !important; transform: translateY(-2px) !important; }
      `}</style>
    </main>
  );
}

"use client";

// Shared prose styling for the editor (.lp-prose) and the read-only reader (.lp-read).
// All values pull from the theme CSS variables set on the container.
export function LetterProseStyles() {
  return (
    <style>{`
      .lp-prose, .lp-read { color: var(--lp-text,#e8eaf0); font-family: var(--lp-body-font, serif); font-size: var(--lp-base-size,19px); line-height: 1.9; outline: none; }
      .lp-prose:focus { outline: none; }
      .lp-prose h1, .lp-read h1 { font-family: var(--lp-heading-font, serif); font-size: 2em; font-weight: 600; margin: 10px 0 14px; line-height: 1.25; }
      .lp-prose h2, .lp-read h2 { font-family: var(--lp-heading-font, serif); font-size: 1.5em; font-weight: 600; margin: 10px 0 12px; line-height: 1.3; }
      .lp-prose h3, .lp-read h3 { font-family: var(--lp-heading-font, serif); font-size: 1.2em; font-weight: 600; margin: 8px 0 10px; }
      .lp-prose p, .lp-read p { margin: 0 0 0.4em; }
      .lp-prose ul, .lp-read ul, .lp-prose ol, .lp-read ol { padding-left: 24px; margin: 0 0 0.6em; }
      .lp-prose li, .lp-read li { margin-bottom: 6px; }
      .lp-prose blockquote, .lp-read blockquote { border-left: 3px solid var(--lp-accent,#6366f1); background: var(--lp-quote-bg,transparent); padding: 10px 16px; border-radius: 0 8px 8px 0; margin: 0 0 16px; font-style: italic; }
      .lp-prose pre, .lp-read pre { background: var(--lp-code-bg,#0a0a0a); border: 1px solid var(--lp-divider,#222); border-radius: 8px; padding: 14px; overflow: auto; font-family: var(--lp-code-font, monospace); font-size: 0.8em; }
      .lp-prose code, .lp-read code { font-family: var(--lp-code-font, monospace); font-size: 0.88em; }
      .lp-prose img, .lp-read img { max-width: 100%; border-radius: 8px; border: 1px solid var(--lp-divider,#222); }
      /* Imported designs: full-width, no card chrome — reads as the page itself. */
      .lp-prose img[data-bleed="true"], .lp-read img[data-bleed="true"] { width: 100%; display: block; border: none; border-radius: 0; margin: 0; }
      .lp-prose hr, .lp-read hr { border: none; height: 1px; background: linear-gradient(to right, transparent, var(--lp-divider,#444), transparent); margin: 24px 0; }
      .lp-prose a, .lp-read a { color: var(--lp-accent,#818cf8); text-decoration: underline; }
      .lp-prose mark, .lp-read mark { border-radius: 3px; padding: 0 2px; }
    `}</style>
  );
}

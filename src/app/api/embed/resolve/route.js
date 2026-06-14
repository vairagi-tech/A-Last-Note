export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth";

// Resolve a Canva SHORT link (canva.link/xxxx) to an embeddable iframe URL.
// A short link is a redirect to canva.com/design/<id>/<token>/view — which only
// allows framing when ?embed is present. We follow the redirect server-side and
// rebuild the proper embed URL. Owner-only + host-allowlisted (no open SSRF).
const ALLOWED = /(^|\.)canva\.(link|com)$/i;

export async function GET(req) {
  try {
    const o = await requireOwner();
    if (!o.ok) return o.res;

    const url = new URL(req.url).searchParams.get("url") || "";
    let host;
    try { host = new URL(url).hostname; } catch { return NextResponse.json({ error: "Bad URL" }, { status: 400 }); }
    if (!ALLOWED.test(host)) return NextResponse.json({ error: "Unsupported link" }, { status: 400 });

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    let finalUrl = url;
    try {
      const res = await fetch(url, { redirect: "follow", signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; letter-platform)" } });
      finalUrl = res.url || url;
    } finally { clearTimeout(timer); }

    const m = finalUrl.match(/canva\.com\/design\/([^/]+)\/([^/?#]+)/);
    if (m) return NextResponse.json({ src: `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed`, ratio: 75 });

    // Resolved somewhere we don't recognize — hand back the final URL as-is.
    return NextResponse.json({ src: finalUrl });
  } catch (e) {
    console.error("[embed/resolve]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

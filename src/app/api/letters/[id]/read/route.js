export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getLetters, getReaders, getUserSettings } from "@/lib/mongodb";
import { evaluateAccess } from "@/lib/gate";
import { verifyPassword } from "@/lib/password";
import { requireOwner, ownsLetter } from "@/lib/auth";

function publicLetter(letter) {
  const { settings, ownerId, ...rest } = letter;
  const { password, ...safe } = settings || {};
  return { ...rest, settings: { ...safe, hasPassword: !!password } };
}

// Reading-window layout cascade: a letter's own layout fields win; any field the
// letter leaves unset inherits the owner's workspace default. The reader then
// fills remaining gaps with the system default. Returns the letter with a fully
// merged settings.layout so existing letters follow the workspace default live.
const LAYOUT_KEYS = ["vAlign", "width", "contentWidth", "topOffset", "sidePadding"];
async function withWorkspaceLayout(letter) {
  try {
    if (!letter?.ownerId) return letter;
    const us = await getUserSettings();
    const doc = await us.findOne({ ownerId: letter.ownerId });
    const dflt = doc?.defaults?.layout;
    if (!dflt) return letter;
    const own = letter.settings?.layout || {};
    const merged = {};
    for (const k of LAYOUT_KEYS) {
      const v = own[k];
      merged[k] = (v !== undefined && v !== null && v !== "") ? v : (dflt[k] ?? null);
    }
    return { ...letter, settings: { ...(letter.settings || {}), layout: merged } };
  } catch {
    return letter; // never let the default lookup break a read
  }
}
const blocked = (reason, status, extra = {}) => NextResponse.json({ blocked: true, reason, ...extra }, { status });

function clientIp(req) {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "local";
}

// Identify a returning reader for the per-reader cap. Prefers the browser
// fingerprint (survives incognito on the same browser); falls back to IP, then
// the localStorage token. This is what makes the per-reader cap incognito-proof
// on the same device — see the honesty note in the UI.
function readerKeyOf(body, req) {
  let basis;
  if (body.fingerprint) basis = `fp:${body.fingerprint}|ip:${clientIp(req)}`;
  else if (body.readerToken) basis = `tk:${body.readerToken}`;
  else basis = `ip:${clientIp(req)}`;
  return crypto.createHash("sha1").update(basis).digest("hex");
}

export async function POST(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json().catch(() => ({}));
    const { readerToken, name, password, device, browser, probe } = body;

    const col = await getLetters();
    const letter = await col.findOne({ linkId: id });
    if (!letter) return blocked("notfound", 404);

    // Owner preview: returns the letter as the reader would see it, but bypasses
    // every gate and — crucially — never increments stats.totalReads or logs a
    // read. Owner-only, so adding ?preview=1 as a stranger gets nothing.
    if (body.preview) {
      const o = await requireOwner();
      if (!o.ok || !ownsLetter(letter, o.userId, o.enabled)) return blocked("notfound", 404);
      return NextResponse.json({ blocked: false, preview: true, letter: publicLetter(await withWorkspaceLayout(letter)) });
    }

    const s = letter.settings || {};
    const readers = await getReaders();
    const readerKey = readerKeyOf(body, req);
    const readerDoc = await readers.findOne({ letterId: id, readerKey });

    // Hard gates (enabled / expiry / total cap / per-reader cap / sealed)
    const access = evaluateAccess(letter, readerDoc?.count || 0);
    if (access.blocked) return blocked(access.reason, access.status, access.opensAt ? { opensAt: access.opensAt } : {});

    if (probe) return NextResponse.json({ blocked: false, probe: true, needsPassword: access.needsPassword, nameMode: access.nameMode, title: letter.title || "" });

    // Soft gates
    if (s.nameMode === "required" && !(name && name.trim())) return blocked("name", 403, { nameMode: s.nameMode });
    if (!(await verifyPassword(password, s.password))) return blocked("password", 401);

    // Atomic total-cap commit
    let fresh;
    if (s.totalLimit != null) {
      fresh = await col.findOneAndUpdate(
        { linkId: id, $or: [{ "stats.totalReads": { $exists: false } }, { "stats.totalReads": { $lt: s.totalLimit } }] },
        { $inc: { "stats.totalReads": 1 }, $set: { "stats.lastReadAt": new Date() } },
        { returnDocument: "after" }
      );
      if (!fresh) return blocked("total", 410);
    } else {
      await col.updateOne({ linkId: id }, { $inc: { "stats.totalReads": 1 }, $set: { "stats.lastReadAt": new Date() } });
      fresh = await col.findOne({ linkId: id });
    }

    // Per-reader record keyed by the incognito-resistant readerKey
    await readers.updateOne(
      { letterId: id, readerKey },
      { $inc: { count: 1 }, $set: { readerToken: readerToken || readerDoc?.readerToken || null, name: name || readerDoc?.name || null, device: device || null, browser: browser || null, ip: clientIp(req), lastAt: new Date() }, $setOnInsert: { letterId: id, readerKey, firstAt: new Date() } },
      { upsert: true }
    );

    return NextResponse.json({ blocked: false, letter: publicLetter(await withWorkspaceLayout(fresh)) });
  } catch (e) {
    console.error("[read]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

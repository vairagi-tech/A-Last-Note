export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getSessions, getLetters } from "@/lib/mongodb";
import { requireOwner } from "@/lib/auth";

// linkIds of letters this user owns (legacy ownerless letters are claimable).
async function ownedLinks(a) {
  const col = await getLetters();
  const filter = a.enabled ? { $or: [{ ownerId: a.userId }, { ownerId: { $exists: false } }] } : {};
  const docs = await col.find(filter, { projection: { linkId: 1 } }).toArray();
  return docs.map(d => d.linkId);
}

// GET — analytics, scoped to the owner's letters (multi-tenant safe).
export async function GET(req) {
  try {
    const a = await requireOwner();
    if (!a.ok) return a.res;
    const { searchParams } = new URL(req.url);
    const letterId = searchParams.get("letterId");
    const links = await ownedLinks(a);
    const col = await getSessions();
    let filter;
    if (letterId) {
      if (a.enabled && !links.includes(letterId)) return NextResponse.json([]);
      filter = { letterId };
    } else {
      filter = { letterId: { $in: links } };
    }
    const sessions = await col.find(filter).sort({ startedAt: -1 }).toArray();
    return NextResponse.json(sessions);
  } catch (e) {
    console.error("[sessions GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — reader telemetry ping (PUBLIC, no auth — readers aren't signed in).
export async function POST(req) {
  try {
    const body = await req.json();
    if (!body.sessionId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const col = await getSessions();
    const sessionData = {
      sessionId: body.sessionId,
      letterId: body.letterId,
      readerToken: body.readerToken || null,
      name: body.name || null,
      status: body.status || "reading",
      currentSection: body.currentSection || 0,
      sectionTime: body.sectionTime || 0,
      totalTime: body.totalTime || 0,
      device: body.device || "Unknown",
      browser: body.browser || "Unknown",
      timezone: body.timezone || "",
      language: body.language || "",
      screen: body.screen || "",
      pageTimes: Array.isArray(body.pageTimes) ? body.pageTimes.slice(0, 50) : [],
      scrollDepthByPage: body.scrollDepthByPage || {},
      clicks: body.clicks || 0,
      idleSeconds: body.idleSeconds || 0,
      tabSwitches: body.tabSwitches || 0,
      completed: body.completed || false,
      startedAt: body.startedAt ? new Date(body.startedAt) : new Date(),
      lastPing: new Date(),
    };
    await col.updateOne({ sessionId: body.sessionId }, { $set: sessionData }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[sessions POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE — clear analytics for an owned letter (admin only).
export async function DELETE(req) {
  try {
    const a = await requireOwner();
    if (!a.ok) return a.res;
    const { searchParams } = new URL(req.url);
    const letterId = searchParams.get("letterId");
    const links = await ownedLinks(a);
    const col = await getSessions();
    if (letterId) {
      if (a.enabled && !links.includes(letterId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      await col.deleteMany({ letterId });
    } else {
      await col.deleteMany({ letterId: { $in: links } });
    }
    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error("[sessions DELETE]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

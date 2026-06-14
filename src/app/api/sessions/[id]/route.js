import { NextResponse } from "next/server";
import { getSessions } from "@/lib/mongodb";
import { requireOwner } from "@/lib/auth";

// GET — a session's event log (admin only).
export async function GET(req, { params }) {
  try {
    const a = await requireOwner();
    if (!a.ok) return a.res;
    const col = await getSessions();
    const session = await col.findOne({ sessionId: params.id });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(session);
  } catch (e) {
    console.error("[session GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — append an event from the reader (PUBLIC). Capped to the last 200 events
// so a single session can never grow toward Mongo's 16MB document limit.
export async function POST(req, { params }) {
  try {
    const { id } = params;
    const body = await req.json();
    if (!body.type) return NextResponse.json({ error: "Bad request" }, { status: 400 });
    const col = await getSessions();
    const logEntry = { type: String(body.type).slice(0, 40), detail: String(body.detail || "").slice(0, 200), page: body.page ?? null, ts: new Date() };
    await col.updateOne(
      { sessionId: id },
      { $push: { logs: { $each: [logEntry], $slice: -200 } }, $setOnInsert: { sessionId: id, startedAt: new Date() } },
      { upsert: true }
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[session POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

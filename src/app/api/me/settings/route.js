export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getUserSettings } from "@/lib/mongodb";
import { requireOwner } from "@/lib/auth";

// Per-owner workspace defaults (default theme + default experience for new letters).
export async function GET() {
  try {
    const a = await requireOwner();
    if (!a.ok) return a.res;
    const col = await getUserSettings();
    const doc = await col.findOne({ ownerId: a.userId });
    return NextResponse.json(doc?.defaults || {});
  } catch (e) {
    console.error("[me/settings GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const a = await requireOwner();
    if (!a.ok) return a.res;
    const body = await req.json();
    const col = await getUserSettings();
    await col.updateOne({ ownerId: a.userId }, { $set: { defaults: body, updatedAt: new Date() } }, { upsert: true });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[me/settings PUT]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

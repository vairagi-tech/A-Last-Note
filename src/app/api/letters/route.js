export const dynamic = "force-dynamic";
import { NextResponse } from "next/server";
import { getLetters } from "@/lib/mongodb";
import { requireOwner, ownsLetter } from "@/lib/auth";
import { resolvePassword } from "@/lib/password";

// Hide the password hash from any admin response too.
function strip(letter) {
  if (!letter) return letter;
  const { settings, ...rest } = letter;
  return { ...rest, settings: { ...settings, password: settings?.password ? "__KEEP__" : null } };
}

// GET — list the signed-in owner's letters (admin).
export async function GET() {
  try {
    const a = await requireOwner();
    if (!a.ok) return a.res;
    const col = await getLetters();
    const filter = a.enabled ? { $or: [{ ownerId: a.userId }, { ownerId: { $exists: false } }] } : {};
    const letters = await col.find(filter).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(letters.map(strip));
  } catch (e) {
    console.error("[letters GET]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST — create or update a letter (admin, owner-scoped).
export async function POST(req) {
  try {
    const a = await requireOwner();
    if (!a.ok) return a.res;
    const body = await req.json();
    const col = await getLetters();

    if (body.linkId) {
      const existing = await col.findOne({ linkId: body.linkId });
      if (existing && !ownsLetter(existing, a.userId, a.enabled)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

      // Strip _id/ownerId AND createdAt/updatedAt: createdAt is set via
      // $setOnInsert below, so leaving it in $set would conflict (same path) and
      // make MongoDB throw — the cause of the save 500.
      const { _id, ownerId, createdAt, updatedAt, ...updateData } = body;
      if (updateData.settings) {
        updateData.settings = { ...updateData.settings, password: await resolvePassword(updateData.settings.password, existing?.settings?.password) };
      }
      await col.updateOne(
        { linkId: body.linkId },
        { $set: { ...updateData, updatedAt: new Date() }, $setOnInsert: { ownerId: a.userId, createdAt: new Date() } },
        { upsert: true }
      );
      const letter = await col.findOne({ linkId: body.linkId });
      return NextResponse.json(strip(letter));
    }

    // Create new
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let linkId = "";
    for (let i = 0; i < 8; i++) linkId += chars[Math.floor(Math.random() * chars.length)];

    const letter = {
      linkId,
      ownerId: a.userId,
      title: body.title || "Untitled Letter",
      opening: body.opening || "",
      theme: body.theme || "darkAmber",
      customTheme: body.customTheme || null,
      blocks: body.blocks || [],
      doc: body.doc || null,
      buttons: body.buttons || null,
      settings: {
        enabled: body.settings?.enabled !== false,
        expiryEnabled: body.settings?.expiryEnabled !== false,
        expiryValue: body.settings?.expiryValue ?? 24,
        expiryUnit: body.settings?.expiryUnit || "hours",
        expiryHours: body.settings?.expiryHours || 24,
        perReaderLimit: body.settings?.perReaderLimit ?? null,
        totalLimit: body.settings?.totalLimit ?? null,
        nameMode: body.settings?.nameMode || "off",
        password: await resolvePassword(body.settings?.password, null),
        drm: body.settings?.drm || false,
        holdToReveal: body.settings?.holdToReveal || false,
        endMessage: body.settings?.endMessage || "",
        experience: {
          breathPace: body.settings?.experience?.breathPace || 0,
          emberDissolve: body.settings?.experience?.emberDissolve || false,
          sealedFrom: body.settings?.experience?.sealedFrom || null,
          minimalAnalytics: body.settings?.experience?.minimalAnalytics || false,
          blockReveal: body.settings?.experience?.blockReveal || "none",
          revealStagger: body.settings?.experience?.revealStagger ?? null,
          wordAnim: body.settings?.experience?.wordAnim || "none",
          wordStagger: body.settings?.experience?.wordStagger ?? 0.04,
        },
      },
      stats: { totalReads: 0, lastReadAt: null },
      publishedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await col.insertOne(letter);
    return NextResponse.json(strip(letter), { status: 201 });
  } catch (e) {
    console.error("[letters POST]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

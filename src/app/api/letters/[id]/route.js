import { NextResponse } from "next/server";
import { getLetters } from "@/lib/mongodb";
import { requireOwner, ownsLetter } from "@/lib/auth";
import { resolvePassword } from "@/lib/password";

// Never expose the password hash; signal "set" with the KEEP sentinel.
function strip(letter) {
  if (!letter) return letter;
  const { settings, ...rest } = letter;
  return { ...rest, settings: { ...settings, password: settings?.password ? "__KEEP__" : null } };
}

async function loadOwned(id) {
  const a = await requireOwner();
  if (!a.ok) return { error: a.res };
  const col = await getLetters();
  const letter = await col.findOne({ linkId: id });
  if (!letter) return { error: NextResponse.json({ error: "Not found" }, { status: 404 }) };
  if (!ownsLetter(letter, a.userId, a.enabled)) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { a, col, letter };
}

// GET — admin editor fetch (owner only). Readers use POST .../read.
export async function GET(req, { params }) {
  try {
    const r = await loadOwned(params.id);
    if (r.error) return r.error;
    return NextResponse.json(strip(r.letter));
  } catch (e) { console.error("[letter GET]", e); return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

// PUT — full content update.
export async function PUT(req, { params }) {
  try {
    const r = await loadOwned(params.id);
    if (r.error) return r.error;
    const body = await req.json();
    const { _id, ownerId, ...updateData } = body;
    if (updateData.settings) updateData.settings = { ...updateData.settings, password: await resolvePassword(updateData.settings.password, r.letter.settings?.password) };
    await r.col.updateOne({ linkId: params.id }, { $set: { ...updateData, updatedAt: new Date() } });
    return NextResponse.json(strip(await r.col.findOne({ linkId: params.id })));
  } catch (e) { console.error("[letter PUT]", e); return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

// PATCH — partial update (dashboard quick toggles).
export async function PATCH(req, { params }) {
  try {
    const r = await loadOwned(params.id);
    if (r.error) return r.error;
    const body = await req.json();
    const set = { updatedAt: new Date() };
    if (body.settings && typeof body.settings === "object") {
      for (const [k, v] of Object.entries(body.settings)) {
        set[`settings.${k}`] = k === "password" ? await resolvePassword(v, r.letter.settings?.password) : v;
      }
    }
    for (const k of ["title", "theme", "customTheme", "buttons", "opening"]) if (k in body) set[k] = body[k];
    await r.col.updateOne({ linkId: params.id }, { $set: set });
    return NextResponse.json(strip(await r.col.findOne({ linkId: params.id })));
  } catch (e) { console.error("[letter PATCH]", e); return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

// DELETE — owner only.
export async function DELETE(req, { params }) {
  try {
    const r = await loadOwned(params.id);
    if (r.error) return r.error;
    await r.col.deleteOne({ linkId: params.id });
    return NextResponse.json({ deleted: true });
  } catch (e) { console.error("[letter DELETE]", e); return NextResponse.json({ error: "Server error" }, { status: 500 }); }
}

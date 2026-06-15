// One-time migration: move inline base64 images out of existing letters and into
// Cloudinary, replacing each `data:image/...` with its hosted URL. This is what
// makes image-heavy letters open fast (a 1.3 MB letter becomes a few KB of JSON +
// CDN images the browser can cache and load progressively).
//
// New uploads already go to Cloudinary automatically once the keys are set — this
// only fixes letters created BEFORE that. Safe to run repeatedly (idempotent: a
// letter with no remaining data: URLs is skipped).
//
// Usage (from the project root, with .env.local present):
//   node --env-file=.env.local scripts/migrate-base64-to-cloudinary.mjs --dry   # report only
//   node --env-file=.env.local scripts/migrate-base64-to-cloudinary.mjs         # do it
//
// Requires in the environment:
//   MONGODB_URI, NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET

import crypto from "node:crypto";
import { MongoClient } from "mongodb";

const DRY = process.argv.includes("--dry");
const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;
const URI = process.env.MONGODB_URI;

if (!URI) { console.error("✗ MONGODB_URI not set"); process.exit(1); }
if (!DRY && (!CLOUD || !API_KEY || !API_SECRET)) {
  console.error("✗ Cloudinary keys missing. Set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (or run with --dry).");
  process.exit(1);
}

const isDataUrl = (v) => typeof v === "string" && v.startsWith("data:image/");

// Upload a single base64 data URL to Cloudinary (signed). Returns secure_url.
const uploadCache = new Map(); // dedupe identical images within/across letters
async function uploadDataUrl(dataUrl) {
  if (uploadCache.has(dataUrl)) return uploadCache.get(dataUrl);
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "letter-platform";
  const toSign = `folder=${folder}&timestamp=${timestamp}`;
  const signature = crypto.createHash("sha1").update(toSign + API_SECRET).digest("hex");
  const fd = new FormData();
  fd.append("file", dataUrl);
  fd.append("api_key", API_KEY);
  fd.append("timestamp", String(timestamp));
  fd.append("folder", folder);
  fd.append("signature", signature);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`, { method: "POST", body: fd });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || "upload failed");
  uploadCache.set(dataUrl, d.secure_url);
  return d.secure_url;
}

// Deep-walk any JSON value, replacing data: URLs. Returns {value, count}.
async function walk(value) {
  let count = 0;
  if (isDataUrl(value)) {
    if (DRY) return { value, count: 1 };
    const url = await uploadDataUrl(value);
    return { value: url, count: 1 };
  }
  if (Array.isArray(value)) {
    const out = [];
    for (const item of value) { const r = await walk(item); out.push(r.value); count += r.count; }
    return { value: out, count };
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) { const r = await walk(v); out[k] = r.value; count += r.count; }
    return { value: out, count };
  }
  return { value, count };
}

async function main() {
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db("letter-platform");
  const col = db.collection("letters");
  const letters = await col.find({}).toArray();

  let totalImgs = 0, touched = 0;
  for (const letter of letters) {
    // Only walk the content-bearing fields (skip _id/ownerId/etc).
    const fields = ["doc", "blocks"];
    let changed = false, imgs = 0;
    const update = {};
    for (const f of fields) {
      if (letter[f] == null) continue;
      const r = await walk(letter[f]);
      imgs += r.count;
      if (r.count > 0 && !DRY) { update[f] = r.value; changed = true; }
    }
    if (imgs > 0) {
      totalImgs += imgs;
      console.log(`${DRY ? "[dry] would migrate" : "migrated"} ${letter.linkId}: ${imgs} image(s)`);
      if (changed) { await col.updateOne({ _id: letter._id }, { $set: { ...update, updatedAt: new Date() } }); touched++; }
    }
  }
  console.log(`\n${DRY ? "DRY RUN — " : ""}${totalImgs} base64 image(s) across ${letters.length} letters${DRY ? " (nothing written)" : `; updated ${touched} letter(s)`}.`);
  await client.close();
}

main().catch(e => { console.error("✗", e.message); process.exit(1); });

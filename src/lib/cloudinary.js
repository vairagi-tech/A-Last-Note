// Client-side Cloudinary uploads. Prefers SIGNED uploads (server holds the
// secret, admin-only) and falls back to an unsigned preset if that's all that's
// configured. Configure in .env.local — see .env.local.example.
export const CLOUD = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "";
export const PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || "";

export const cloudinaryEnabled = () => !!CLOUD;

export async function uploadToCloudinary(file, resourceType = "image") {
  if (!CLOUD) throw new Error("Cloudinary not configured — set NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME in .env.local");

  // Try a signed upload first (no public preset exposed).
  let sign = null;
  try {
    const r = await fetch("/api/cloudinary/sign", { method: "POST" });
    if (r.ok) sign = await r.json();
  } catch { /* fall through to unsigned */ }

  const fd = new FormData();
  fd.append("file", file);
  if (sign) {
    fd.append("api_key", sign.apiKey);
    fd.append("timestamp", sign.timestamp);
    fd.append("signature", sign.signature);
    fd.append("folder", sign.folder);
  } else if (PRESET) {
    fd.append("upload_preset", PRESET);
  } else {
    throw new Error("No upload credentials — add CLOUDINARY_API_KEY/SECRET (signed) or an unsigned preset");
  }

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/${resourceType}/upload`, { method: "POST", body: fd });
  const d = await res.json();
  if (!res.ok) throw new Error(d.error?.message || "Upload failed");
  return d.secure_url;
}

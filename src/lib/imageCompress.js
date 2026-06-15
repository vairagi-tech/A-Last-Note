"use client";

// Downscale + recompress an image in the browser BEFORE it's stored in a letter.
// Images pasted/imported into a letter are otherwise embedded as full-size base64
// (a single screenshot is easily 100s of KB–MB, and base64 adds ~33% on top). This
// caps the dimensions and re-encodes to WebP/JPEG so letters stay small even
// without Cloudinary. When Cloudinary IS on, we shrink the original before upload.

import { fileToDataUrl } from "@/lib/pdfSplit";

export { fileToDataUrl };

const DEFAULTS = { maxWidth: 1600, maxHeight: 1600, quality: 0.82 };

// Don't rasterize animated GIFs (canvas flattens them to a single frame) or SVGs
// (vector, already tiny). Those pass through untouched.
export function isCompressibleImage(file) {
  return !!file && typeof file.type === "string" && file.type.startsWith("image/")
    && file.type !== "image/gif" && file.type !== "image/svg+xml";
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    img.src = url;
  });
}

// Returns a data URL string, recompressed when worthwhile, else the original bytes.
export async function compressToDataUrl(file, opts = {}) {
  const { maxWidth, maxHeight, quality } = { ...DEFAULTS, ...opts };
  if (!isCompressibleImage(file)) return fileToDataUrl(file);
  try {
    const img = await loadImage(file);
    const scale = Math.min(1, maxWidth / img.width, maxHeight / img.height);
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);
    // Prefer WebP (smaller, keeps alpha); fall back to JPEG if the browser can't.
    let out = canvas.toDataURL("image/webp", quality);
    if (!out.startsWith("data:image/webp")) out = canvas.toDataURL("image/jpeg", quality);
    const orig = await fileToDataUrl(file);
    // Only keep the recompressed version if it actually came out smaller.
    return out.length < orig.length ? out : orig;
  } catch {
    return fileToDataUrl(file); // never block an insert on a compression failure
  }
}

// Like compressToDataUrl but returns a File — for uploading a smaller original to
// Cloudinary. Falls back to the original File when compression didn't help.
export async function compressToFile(file, opts = {}) {
  try {
    if (!isCompressibleImage(file)) return file;
    const dataUrl = await compressToDataUrl(file, opts);
    if (!dataUrl.startsWith("data:image/webp") && !dataUrl.startsWith("data:image/jpeg")) return file;
    const blob = await (await fetch(dataUrl)).blob();
    if (blob.size >= file.size) return file;
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const base = (file.name || "image").replace(/\.\w+$/, "");
    return new File([blob], `${base}.${ext}`, { type: blob.type });
  } catch {
    return file;
  }
}

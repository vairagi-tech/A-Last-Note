"use client";

// Turn a multi-page PDF into one image per page, so an imported design flows
// across SEPARATE reader pages (with a Read More break between each) instead of
// living inside a single interactive embed box. pdfjs is heavy, so it's loaded
// lazily the first time someone imports a PDF.
let _pdfjs;
async function getPdfjs() {
  if (_pdfjs) return _pdfjs;
  const pdfjs = await import("pdfjs-dist");
  // Worker is served from the CDN at the exact installed version.
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
  _pdfjs = pdfjs;
  return pdfjs;
}

// `source` may be a File/Blob, an ArrayBuffer, or a URL string (URL fetch can
// fail on cross-origin PDFs — Canva/Drive — so a downloaded file is preferred).
// Returns [{ dataUrl, w, h }] — one JPEG per page.
export async function pdfToPages(source, { maxWidth = 1400, quality = 0.82, onProgress } = {}) {
  const pdfjs = await getPdfjs();

  let data;
  if (typeof source === "string") {
    const res = await fetch(source);
    if (!res.ok) throw new Error("Couldn't fetch that PDF link — download it and choose the file instead.");
    data = await res.arrayBuffer();
  } else if (source instanceof Blob) {
    data = await source.arrayBuffer();
  } else {
    data = source;
  }

  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2, maxWidth / base.width);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport }).promise;
    pages.push({ dataUrl: canvas.toDataURL("image/jpeg", quality), w: canvas.width, h: canvas.height });
    onProgress?.(i, pdf.numPages);
  }
  return pages;
}

// Read a File as a data URL (for an image when Cloudinary isn't configured).
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error("Couldn't read that file."));
    fr.readAsDataURL(file);
  });
}

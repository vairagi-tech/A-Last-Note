// Turn a pasted link into how the "Import a design" feature should insert it.
// The whole point: a Canva *share* link, a PDF, or a Google Drive file is NOT an
// image — dropping it in an <img> shows a broken icon. Those go in an <iframe>
// (the `embed` node) instead; only real image links become an `image` node.
//
// Returns one of:
//   { type: "image", src }                       — a direct image URL
//   { type: "embed", src, ratio, label }         — PDF / Canva / Drive → iframe
//   { type: "embed", needsResolve: true, … }     — short link to resolve server-side
//   { type: "invalid" }                          — empty

const IMG_RE = /\.(png|jpe?g|gif|webp|avif|svg)(\?|#|$)/i;

export function resolveImport(raw) {
  const url = (raw || "").trim();
  if (!url) return { type: "invalid" };

  // Google Drive file → its built-in /preview page (works for PDF, images, docs)
  let m = url.match(/drive\.google\.com\/file\/d\/([^/]+)/) || url.match(/drive\.google\.com\/open\?id=([^&]+)/);
  if (m) return { type: "embed", src: `https://drive.google.com/file/d/${m[1]}/preview`, ratio: 130, label: "Google Drive file" };

  // Canva design link → Canva's own embed URL (the design must be shared/public).
  // Share link looks like canva.com/design/<id>/<token>/view|edit?...
  m = url.match(/canva\.com\/design\/([^/]+)\/([^/?#]+)/);
  if (m) return { type: "embed", src: `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed`, ratio: 75, label: "Canva design" };

  // Canva SHORT link (canva.link/xxxx) — a redirect, not the design URL. We can't
  // build the ?embed URL from it, so flag it to be resolved on the server first.
  if (/(^|\/\/)([\w.-]*\.)?canva\.link\//i.test(url)) return { type: "embed", src: url, ratio: 75, label: "Canva design", needsResolve: true };

  // A direct PDF link → embed it (taller aspect for a page).
  if (/\.pdf(\?|#|$)/i.test(url)) return { type: "embed", src: url, ratio: 130, label: "PDF" };

  // A direct image link → image node.
  if (IMG_RE.test(url)) return { type: "image", src: url };

  // Unknown shape (e.g. a CDN image with no extension). Treat as an image but
  // flag it so the UI can preview-and-verify rather than silently embed.
  return { type: "image", src: url, uncertain: true };
}

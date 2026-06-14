const UNIT_MIN = { minutes: 1, hours: 60, days: 1440 };

// How many minutes after publish a letter expires. Prefers the value+unit model;
// falls back to the legacy expiryHours. null/0 ⇒ no auto-expiry.
export function expiryMinutes(s) {
  if (!s) return null;
  if (s.expiryValue != null && s.expiryValue !== "") {
    return Number(s.expiryValue) * (UNIT_MIN[s.expiryUnit] || UNIT_MIN.hours);
  }
  if (s.expiryHours != null) return Number(s.expiryHours) * 60;
  return null;
}

// Pure reader-access gate (no DB / no crypto) so it can be unit-tested.
// Password verification & the atomic read-count commit happen in the route.
export function evaluateAccess(letter, readerCount, now = Date.now()) {
  if (!letter) return { blocked: true, reason: "notfound", status: 404 };
  const s = letter.settings || {};

  if (s.enabled === false) return { blocked: true, reason: "disabled", status: 403 };

  const mins = s.expiryEnabled !== false ? expiryMinutes(s) : null;
  if (mins && letter.publishedAt) {
    const expiry = new Date(letter.publishedAt).getTime() + mins * 60000;
    if (now > expiry) return { blocked: true, reason: "expired", status: 410 };
  }

  if (s.totalLimit != null && (letter.stats?.totalReads || 0) >= s.totalLimit) {
    return { blocked: true, reason: "total", status: 410 };
  }

  if (s.perReaderLimit != null && (readerCount || 0) >= s.perReaderLimit) {
    return { blocked: true, reason: "perReader", status: 403 };
  }

  // Sealed until a moment (experience toggle): not yet openable.
  const sealedFrom = s.experience?.sealedFrom;
  if (sealedFrom && now < new Date(sealedFrom).getTime()) {
    return { blocked: true, reason: "sealed", status: 403, opensAt: sealedFrom };
  }

  return { blocked: false, needsPassword: !!s.password, nameMode: s.nameMode || "off" };
}

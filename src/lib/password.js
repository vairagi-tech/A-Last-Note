import bcrypt from "bcryptjs";

// Sentinel the admin UI sends to mean "keep the existing password unchanged".
export const KEEP = "__KEEP__";

export function isHash(v) { return typeof v === "string" && v.startsWith("$2"); }

// Resolve what to store given the incoming value and the existing hash.
export async function resolvePassword(incoming, existingHash) {
  if (incoming === undefined || incoming === KEEP) return existingHash ?? null;
  if (!incoming) return null;                 // cleared
  if (isHash(incoming)) return incoming;      // already hashed
  return bcrypt.hash(incoming, 10);           // new plaintext → hash
}

// Constant-time compare via bcrypt. No password set ⇒ always allowed.
export async function verifyPassword(plain, hash) {
  if (!hash) return true;
  if (!plain) return false;
  try { return await bcrypt.compare(plain, hash); } catch { return false; }
}

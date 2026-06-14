import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

// Clerk is active only when both keys are present. Without them the app still
// runs (admin is open) — but we log a loud warning so it's never a silent hole.
export const clerkEnabled = () =>
  !!process.env.CLERK_SECRET_KEY && !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

let warned = false;
function warnOnce() {
  if (!warned && !clerkEnabled()) {
    warned = true;
    console.warn("[auth] Clerk keys not set — admin endpoints are UNPROTECTED. Set CLERK_SECRET_KEY + NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY to enable auth.");
  }
}

// Guard an admin (owner) endpoint. Returns { ok, userId } or { ok:false, res }.
export async function requireOwner() {
  warnOnce();
  if (!clerkEnabled()) return { ok: true, userId: "public-dev", enabled: false };
  const { userId } = await auth();
  if (!userId) return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { ok: true, userId, enabled: true };
}

// Does this user own this letter? Legacy letters (no ownerId) are claimable.
export function ownsLetter(letter, userId, enabled) {
  if (!enabled) return true;
  if (!letter) return false;
  return !letter.ownerId || letter.ownerId === userId;
}

import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

// Protect the admin UI. Reader routes (/, /read/*) and the public reader APIs
// (/api/letters/[id]/read, session ping) stay open.
const isAdminPage = createRouteMatcher(["/admin(.*)"]);
const enabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

let _clerk;
function runClerk(req, ev) {
  if (!_clerk) _clerk = clerkMiddleware((auth, request) => { if (isAdminPage(request)) auth().protect(); });
  return _clerk(req, ev);
}

// When Clerk isn't configured, pass through (app still runs, admin open + warned).
export default function middleware(req, ev) {
  if (!enabled) return;
  return runClerk(req, ev);
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)", "/api/(.*)"],
};

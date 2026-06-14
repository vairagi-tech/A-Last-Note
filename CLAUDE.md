# Letter Platform — Agent Instructions

> Read automatically at the start of every session. This file — not the one in the
> parent directory (that one is for an unrelated project) — describes THIS app.

## What this is

A platform for writing **intimate, self-destructing letters** and sharing them by link.
You author a richly-styled letter in an admin studio, send a `/read/<linkId>` link, and
the recipient reads it page-by-page; it can gate on a password / name, cap how many times
it's read, expire, and fade to black when finished. The admin owns the letter forever and
controls everything; "self-destruct" is purely the **reader's** experience.

**Stack:** Next.js 14 (App Router, JS) · MongoDB · Tiptap (rich text) + react-moveable
(freestyle "Canva" placement) · Clerk (admin auth) · Cloudinary (media) · Tailwind.

## Architecture in one line

> One Next.js app. Admin (Clerk-protected) authors a **Tiptap JSON doc**; the reader
> renders it read-only, gated by a single public endpoint.

## Core model

- A letter's content is a **Tiptap doc** (`letter.doc`). Legacy letters used `blocks[]`
  and auto-convert via `getLetterDoc()` ([src/lib/letterDoc.js](src/lib/letterDoc.js)).
- **Read More** = a `pagebreak` node; the reader splits the doc into pages on it.
- **Canva mode** = every block carries an optional `pos` `{x,y,w,h,rotate,z}` (a global
  Tiptap attribute). A page with positions renders freestyle; otherwise it flows.
- Money/counters: `stats.totalReads` is the only counter; reads are committed atomically.

## Non-negotiable rules

### Auth boundary (the important one)
```
ADMIN endpoints (list/create/edit/delete letters, analytics) → requireOwner() in
  src/lib/auth.js. Owner-scoped by ownerId. NEVER make these public.
READER endpoints (POST /api/letters/[id]/read, session ping POST) → PUBLIC by design.
If you add an admin endpoint, it MUST call requireOwner() first.
```

### Secrets & gating
```
Passwords: hashed with bcrypt (src/lib/password.js). NEVER store/return plaintext or the
  hash. Admin sees "__KEEP__" sentinel; reader sends plaintext, server bcrypt-compares.
Read caps: the total cap is committed with an atomic conditional $inc — do NOT regress to
  check-then-increment (it races). See src/app/api/letters/[id]/read/route.js.
API errors: return generic { error: "Server error" } + console.error. Never echo e.message.
```

### Honesty about "protection"
```
DRM/anti-capture (blur, blackout, watermark) is a DETERRENT, not real DRM. Browsers cannot
force OS screenshots of DOM text to be black. The per-reader cap uses a localStorage token
and is bypassable in incognito. Do not describe these as guarantees in UI or docs.
```

## Layout

```
src/
├── middleware.js                 ← Clerk: protects /admin (no-op if keys absent)
├── app/
│   ├── layout.js                 ← conditional <ClerkProvider>
│   ├── admin/page.js             ← dashboard + editor + analytics (Clerk-gated)
│   ├── read/[linkId]/page.js     ← public reader (gated, paged, themed, tracked)
│   └── api/
│       ├── letters/route.js               ← list/create (owner)
│       ├── letters/[id]/route.js          ← get/put/patch/delete (owner)
│       ├── letters/[id]/read/route.js     ← PUBLIC gated read + atomic counter
│       ├── sessions/route.js              ← GET/DELETE owner · POST public ping
│       ├── sessions/[id]/route.js         ← GET owner · POST public (capped logs)
│       └── cloudinary/sign/route.js       ← signed-upload signature (owner)
├── components/tiptap/            ← LetterEditor, FreestyleBoard, NodeCard, LetterPage…
└── lib/                          ← auth, gate, password, letterDoc, themes, mongodb…
tests/                            ← vitest: gate, password, letterDoc
```

## Running locally

```bash
npm install
docker start letter-mongo || docker run -d --name letter-mongo -p 27017:27017 mongo:7
npm run dev        # :3000
npm test           # vitest (pure logic: gate, password, doc migration)
```

`.env.local` (see `.env.local.example`): `MONGODB_URI` required. Clerk + Cloudinary keys
optional — without Clerk the app runs but admin is OPEN (a warning is logged).

## Stop and ask when

- Making a reader endpoint owner-scoped, or an admin endpoint public.
- Changing the read-count commit (atomicity), password hashing, or the gate order.
- Describing DRM / read caps as guarantees rather than deterrents.
```

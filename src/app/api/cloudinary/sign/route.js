import { NextResponse } from "next/server";
import crypto from "crypto";
import { requireOwner } from "@/lib/auth";

// Returns a short-lived upload signature. Admin-only, so the API secret never
// ships to the browser and randoms can't dump media into your Cloudinary.
export async function POST(req) {
  try {
    const a = await requireOwner();
    if (!a.ok) return a.res;

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ error: "Signed uploads not configured" }, { status: 501 });
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "letter-platform";
    const toSign = `folder=${folder}&timestamp=${timestamp}`;
    const signature = crypto.createHash("sha1").update(toSign + apiSecret).digest("hex");

    return NextResponse.json({ cloudName, apiKey, timestamp, folder, signature });
  } catch (e) {
    console.error("[cloudinary sign]", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

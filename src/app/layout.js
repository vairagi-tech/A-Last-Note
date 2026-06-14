import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Letter Platform",
  description: "Interactive reading platform with live tracking",
};

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({ children }) {
  const tree = (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
  // Only mount Clerk when configured, so the app still runs without keys.
  return clerkEnabled ? <ClerkProvider>{tree}</ClerkProvider> : tree;
}

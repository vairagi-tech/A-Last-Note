import "./globals.css";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "A Last Note",
  description: "Intimate, self-destructing letters — written to be read once.",
};

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function RootLayout({ children }) {
  const tree = (
    <html lang="en">
      <head>
        {/* Warm the font connections, then load fonts non-blockingly with swap so
            text paints immediately in the system fallback. Weights trimmed to what
            the reader/editor actually use. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=Noto+Serif+Devanagari:wght@400;700&family=JetBrains+Mono:wght@400;500&family=Crimson+Pro:ital,wght@0,400;1,400&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
  // Only mount Clerk when configured, so the app still runs without keys.
  return clerkEnabled ? <ClerkProvider>{tree}</ClerkProvider> : tree;
}

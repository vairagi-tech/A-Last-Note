# Letter Platform v2

Interactive reading platform with live tracking, themes, block-based content, and self-destructing messages.

## Features

- **Block-based content editor** — Text, Image, Code, Quote, Divider, Video (YouTube)
- **7 theme presets + custom theme editor** — Dark Amber, Minimal, Ancient, Midnight, Sakura, Neon, Vedic
- **Freeform block positioning** — Place blocks anywhere with X/Y coordinates
- **Live reader tracking** — Real-time analytics dashboard
- **Event logs** — Timestamped log of every reader action
- **Self-destructing content** — "Finish Reading" destroys the letter
- **Shareable links** — Unique URL per letter (e.g., `/read/abc123`)
- **Screenshot detection** — Keyboard shortcut detection with warning overlay
- **Tab switch tracking** — Knows when reader leaves the tab
- **CSV export** — Download analytics data
- **Video embeds** — YouTube and direct video URLs
- **Device/browser detection** — Track reader's device info

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier: https://www.mongodb.com/cloud/atlas)

### 2. Setup MongoDB Atlas
1. Create a free account at MongoDB Atlas
2. Create a new cluster (free M0 tier)
3. Create a database user with password
4. Whitelist your IP (or use 0.0.0.0/0 for all IPs)
5. Get the connection string

### 3. Configure Environment
```bash
cp .env.local.example .env.local
```
Edit `.env.local` and add your MongoDB connection string:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/letter-platform
NEXT_PUBLIC_APP_URL=http://localhost:3000
ADMIN_PASSWORD=your-secure-password
```

### 4. Install & Run
```bash
npm install
npm run dev
```
Open http://localhost:3000

## Deploy to Vercel (Production)

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Letter Platform v2"
git remote add origin https://github.com/YOUR_USERNAME/letter-platform.git
git push -u origin main
```

### 2. Deploy on Vercel
1. Go to https://vercel.com
2. Import your GitHub repository
3. Add environment variables:
   - `MONGODB_URI` — your MongoDB Atlas connection string
   - `NEXT_PUBLIC_APP_URL` — your Vercel URL (e.g., https://your-app.vercel.app)
   - `ADMIN_PASSWORD` — your admin password
4. Click Deploy

### 3. Share Reader Links
After creating a letter in Admin, you get a shareable link like:
```
https://your-app.vercel.app/read/abc123
```
Send this to anyone. They'll see the themed reading experience.

## Usage

### Admin Panel (`/admin`)
1. **Content tab** — Write opening message, create sections with blocks
2. **Themes tab** — Choose preset or create custom theme
3. **Analytics tab** — See live reader tracking
4. **Logs tab** — View detailed event logs per reader session
5. **Share tab** — Get shareable link, configure settings

### Reader Experience (`/read/[linkId]`)
1. Reader opens the shared link
2. Sees opening message → "Start Reading"
3. Reads section by section → "Read More"
4. Last section → "Finish Reading"
5. Content self-destructs → blank screen

### Block Types
- **Text** — Rich paragraphs with italic styling
- **Image** — URL-based images with captions and alignment
- **Code** — Syntax-highlighted code blocks
- **Quote** — Styled quotation blocks with author attribution
- **Divider** — Decorative section separators
- **Video** — YouTube embeds or direct video URLs

### Freeform Positioning
In any section, toggle "Freeform" mode to position blocks with X/Y coordinates.
Blocks in freeform mode use absolute positioning within the section container.

## Architecture

```
src/
├── app/
│   ├── page.js                 # Home (role selection)
│   ├── admin/page.js           # Full admin panel
│   ├── read/[linkId]/page.js   # Reader experience
│   └── api/
│       ├── letters/            # Letter CRUD
│       └── sessions/           # Session tracking
├── components/
│   └── BlockRenderer.js        # Renders content blocks
└── lib/
    ├── mongodb.js              # Database connection
    ├── themes.js               # Theme definitions
    └── utils.js                # Utility functions
```

## Future Enhancements

To add more features, consider:
- **Cloudinary/Vercel Blob** for image uploads (currently URL-based)
- **Socket.IO/Pusher** for real-time WebSocket updates (currently polling)
- **NextAuth.js** for proper admin authentication
- **react-dnd-kit** for visual drag-and-drop block positioning
- **Fabric.js** for canvas-based freeform layout
- **Password protection** for reader pages
- **Multiple letters** management in admin
- **Read receipts** via email notifications

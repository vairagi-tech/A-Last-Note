// Ready-made, designed letters. Each template is a full starting point:
// theme + Tiptap doc (+ freestyle positions & decorations) + button styles +
// story-animation settings. Picked in the "New letter" gallery.
import { DEFAULT_CUSTOM_THEME } from "@/lib/themes";

const head = (text, level, pos) => ({ type: "heading", attrs: { level, ...(pos ? { pos } : {}) }, content: text ? [{ type: "text", text }] : [] });
const para = (text, pos) => ({ type: "paragraph", attrs: pos ? { pos } : {}, content: text ? [{ type: "text", text }] : [] });
const deco = (kind, variant, color, content, x, y, w, h, rotate = 0) => ({ type: "decoration", attrs: { kind, variant, color, content, pos: { x, y, w, h, rotate, z: 1 } } });
const li = (text) => ({ type: "listItem", content: [para(text)] });
const bullets = (items) => ({ type: "bulletList", content: items.map(li) });
const pagebreak = () => ({ type: "pagebreak" });

export const TEMPLATES = [
  {
    key: "blank", name: "Blank", emoji: "📄", theme: "darkAmber",
    blurb: "Start from nothing.",
    doc: { type: "doc", content: [para("")] },
  },

  {
    key: "custom", name: "Custom", emoji: "🎨", theme: "custom",
    customTheme: { ...DEFAULT_CUSTOM_THEME },
    blurb: "Your own colors & fonts.",
    doc: { type: "doc", content: [para("")] },
  },

  {
    key: "future-self", name: "To My Future Self", emoji: "🌟", theme: "midnight",
    blurb: "A letter to open one day.",
    experience: { blockReveal: "slideUp", revealStagger: 0.18, wordAnim: "none", emberDissolve: false },
    buttons: { start: { label: "Open it", style: { radius: 22 } }, readMore: { label: "Keep going →", style: { radius: 22 } }, finish: { label: "Seal it", style: { radius: 22 } } },
    opening: "Dear future me…",
    doc: {
      type: "doc", content: [
        head("A letter to my future self", 1, { x: 50, y: 44, w: 500, z: 3 }),
        para("Right now, life feels uncertain. But you’re building something — one quiet step at a time.", { x: 50, y: 150, w: 360, z: 2 }),
        head("What I hope for you", 3, { x: 50, y: 280, w: 340, z: 2 }),
        bulletsPos(["Keep learning every day", "Be kind to yourself", "Build a life that feels like freedom"], { x: 60, y: 330, w: 360, z: 2 }),
        deco("doodle", "sparkle", "#7c6cf0", "", 470, 60, 90, 90, 12),
        deco("shape", "star", "#e0a83a", "", 70, 470, 70, 70, -10),
        deco("washi", "mint", "#9ad8bc", "", 360, 300, 170, 42, -4),
      ],
    },
  },

  {
    key: "love", name: "For Someone I Love", emoji: "💌", theme: "rose",
    blurb: "The things you never said.",
    experience: { blockReveal: "fade", revealStagger: 0.3, emberDissolve: true },
    buttons: { start: { label: "Read it", style: { radius: 20 } }, finish: { label: "Let it go", style: { radius: 20 } } },
    opening: "Some words I could never say out loud.",
    doc: {
      type: "doc", content: [
        head("There’s something I never said", 2, { x: 50, y: 50, w: 420, z: 3 }),
        para("…but always felt, every single day.", { x: 50, y: 130, w: 320, z: 2 }),
        para("You made the ordinary feel like something worth keeping. I hope, wherever this finds you, you feel it too.", { x: 50, y: 210, w: 360, z: 2 }),
        deco("shape", "heart", "#e06a86", "", 440, 60, 110, 100, 8),
        deco("emoji", "emoji", "", "🦋", 460, 300, 84, 84),
        deco("washi", "pink", "#e8a0b4", "", 70, 340, 170, 42, -3),
      ],
    },
  },

  {
    key: "goodbye", name: "A Goodbye", emoji: "🕯️", theme: "noir",
    blurb: "Slow, quiet, and final.",
    experience: { wordAnim: "fade", wordStagger: 0.09, blockReveal: "none", emberDissolve: true },
    buttons: { start: { label: "Begin", style: { radius: 0, letterSpacing: 5 } }, finish: { label: "Goodbye", style: { radius: 0, letterSpacing: 5 } } },
    opening: "Before the moment passes.",
    doc: {
      type: "doc", content: [
        head("Some things are easier", 2),
        para("to write than to say. So I’m setting them down here, where they can finally be still."),
        para("Thank you — for the part of me that’s better because of you."),
        pagebreak(),
        para("Read this slowly. Then let it dissolve."),
      ],
    },
  },

  {
    key: "thanks", name: "Thank You", emoji: "🌻", theme: "paper",
    blurb: "A warm note of gratitude.",
    experience: { wordAnim: "slideUp", wordStagger: 0.05, blockReveal: "none", emberDissolve: false },
    opening: "A small thank-you, properly said.",
    doc: {
      type: "doc", content: [
        head("Thank you", 1),
        para("I don’t say it enough, so I’m saying it here — fully, and on purpose."),
        para("For these, especially:"),
        bullets(["For showing up when it mattered", "For the patience I didn’t always deserve", "For making me believe it was possible"]),
        para("It mattered. You mattered. Thank you."),
      ],
    },
  },

  {
    key: "birthday", name: "Happy Birthday", emoji: "🎉", theme: "sakura",
    blurb: "A bright little celebration.",
    experience: { blockReveal: "bounce", revealStagger: 0.12, wordAnim: "none", emberDissolve: false },
    buttons: { start: { label: "Open your gift 🎁", style: { radius: 24 } }, finish: { label: "🎂", style: { radius: 24 } } },
    opening: "Made you something ✨",
    doc: {
      type: "doc", content: [
        head("Happy Birthday!", 1, { x: 60, y: 70, w: 440, z: 3 }),
        para("Another year of you — the world’s genuinely luckier for it.", { x: 60, y: 160, w: 360, z: 2 }),
        para("Here’s to more laughing, more wandering, and more of whatever makes you, you.", { x: 60, y: 240, w: 360, z: 2 }),
        deco("shape", "star", "#e0a83a", "", 460, 70, 80, 80, 14),
        deco("emoji", "emoji", "", "🎈", 470, 230, 80, 80),
        deco("doodle", "sparkle", "#e06a86", "", 70, 350, 70, 70),
        deco("shape", "circle", "#7aa8e0", "", 300, 340, 56, 56),
      ],
    },
  },
];

// bulletList with a freestyle position on the list node.
function bulletsPos(items, pos) {
  return { type: "bulletList", attrs: { pos }, content: items.map(li) };
}

export const getTemplate = (key) => TEMPLATES.find(t => t.key === key) || TEMPLATES[0];

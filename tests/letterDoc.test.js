import { describe, it, expect } from "vitest";
import { splitDocIntoPages, blocksToDoc, getLetterDoc, ensureFreestyle, isFreestylePage, clearFreestyle } from "@/lib/letterDoc";

describe("splitDocIntoPages", () => {
  it("splits on pagebreak nodes", () => {
    const doc = { type: "doc", content: [
      { type: "paragraph" }, { type: "pagebreak" }, { type: "paragraph" }, { type: "paragraph" },
    ] };
    const pages = splitDocIntoPages(doc);
    expect(pages.length).toBe(2);
    expect(pages[1].content.length).toBe(2);
  });
  it("always returns at least one page", () => {
    expect(splitDocIntoPages({ type: "doc", content: [] }).length).toBe(1);
  });
});

describe("blocksToDoc (legacy migration)", () => {
  it("maps block types to Tiptap nodes", () => {
    const doc = blocksToDoc([
      { type: "heading", content: "Hi" },
      { type: "pagebreak" },
      { type: "text", content: "body" },
      { type: "divider" },
    ]);
    const types = doc.content.map(n => n.type);
    expect(types).toEqual(["heading", "pagebreak", "paragraph", "horizontalRule"]);
  });
});

describe("getLetterDoc sanitizing", () => {
  it("drops removed legacy node types (drawing / freeform)", () => {
    const letter = { doc: { type: "doc", content: [
      { type: "paragraph" }, { type: "drawing" }, { type: "freeform" }, { type: "paragraph" },
    ] } };
    const doc = getLetterDoc(letter);
    expect(doc.content.every(n => n.type === "paragraph")).toBe(true);
    expect(doc.content.length).toBe(2);
  });
});

describe("freestyle helpers", () => {
  const doc = { type: "doc", content: [
    { type: "heading", content: [] }, { type: "paragraph" }, { type: "pagebreak" }, { type: "paragraph" },
  ] };

  it("ensureFreestyle gives every non-break node a position", () => {
    const fs = ensureFreestyle(doc);
    const positioned = fs.content.filter(n => n.type !== "pagebreak").every(n => n.attrs?.pos);
    expect(positioned).toBe(true);
    expect(fs.content.find(n => n.type === "pagebreak").attrs?.pos).toBeUndefined();
  });

  it("isFreestylePage detects positioned pages", () => {
    const fs = ensureFreestyle(doc);
    const pages = splitDocIntoPages(fs);
    expect(isFreestylePage(pages[0])).toBe(true);
  });

  it("clearFreestyle strips all positions", () => {
    const fs = ensureFreestyle(doc);
    const cleared = clearFreestyle(fs);
    expect(cleared.content.every(n => !n.attrs?.pos)).toBe(true);
  });
});

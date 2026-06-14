import { describe, it, expect } from "vitest";
import { evaluateAccess } from "@/lib/gate";

const base = (over = {}) => ({ publishedAt: new Date("2026-01-01").toISOString(), stats: { totalReads: 0 }, settings: { enabled: true, expiryEnabled: false, ...over } });

describe("evaluateAccess", () => {
  it("blocks a missing letter", () => {
    expect(evaluateAccess(null, 0).reason).toBe("notfound");
  });

  it("blocks a disabled letter", () => {
    expect(evaluateAccess(base({ enabled: false }), 0)).toMatchObject({ blocked: true, reason: "disabled", status: 403 });
  });

  it("blocks when expired (legacy expiryHours)", () => {
    const l = { publishedAt: new Date("2026-01-01").toISOString(), settings: { enabled: true, expiryEnabled: true, expiryHours: 1 } };
    const after = new Date("2026-01-02").getTime();
    expect(evaluateAccess(l, 0, after)).toMatchObject({ blocked: true, reason: "expired" });
  });

  it("supports minute-granularity expiry (value + unit)", () => {
    const published = new Date("2026-01-01T00:00:00Z");
    const l = { publishedAt: published.toISOString(), settings: { enabled: true, expiryEnabled: true, expiryValue: 10, expiryUnit: "minutes" } };
    // 9 minutes later → still open; 11 minutes later → expired
    expect(evaluateAccess(l, 0, published.getTime() + 9 * 60000).blocked).toBe(false);
    expect(evaluateAccess(l, 0, published.getTime() + 11 * 60000)).toMatchObject({ blocked: true, reason: "expired" });
  });

  it("does not expire when expiry disabled", () => {
    const l = { publishedAt: new Date("2026-01-01").toISOString(), settings: { enabled: true, expiryEnabled: false, expiryHours: 1 } };
    expect(evaluateAccess(l, 0, new Date("2030-01-01").getTime()).blocked).toBe(false);
  });

  it("blocks at the total cap", () => {
    const l = base({ totalLimit: 2 }); l.stats.totalReads = 2;
    expect(evaluateAccess(l, 0)).toMatchObject({ blocked: true, reason: "total", status: 410 });
  });

  it("allows under the total cap", () => {
    const l = base({ totalLimit: 2 }); l.stats.totalReads = 1;
    expect(evaluateAccess(l, 0).blocked).toBe(false);
  });

  it("blocks at the per-reader cap", () => {
    expect(evaluateAccess(base({ perReaderLimit: 1 }), 1)).toMatchObject({ blocked: true, reason: "perReader" });
  });

  it("reports soft gates when access is allowed", () => {
    const r = evaluateAccess(base({ password: "$2hash", nameMode: "required" }), 0);
    expect(r).toMatchObject({ blocked: false, needsPassword: true, nameMode: "required" });
  });

  it("defaults nameMode to off and no password", () => {
    expect(evaluateAccess(base(), 0)).toMatchObject({ blocked: false, needsPassword: false, nameMode: "off" });
  });

  it("blocks a sealed letter before its open time, with opensAt", () => {
    const opensAt = new Date("2027-01-01").toISOString();
    const r = evaluateAccess(base({ experience: { sealedFrom: opensAt } }), 0, new Date("2026-06-01").getTime());
    expect(r).toMatchObject({ blocked: true, reason: "sealed", opensAt });
  });

  it("allows a sealed letter after its open time", () => {
    const opensAt = new Date("2026-01-01").toISOString();
    expect(evaluateAccess(base({ experience: { sealedFrom: opensAt } }), 0, new Date("2026-06-01").getTime()).blocked).toBe(false);
  });
});

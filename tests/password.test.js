import { describe, it, expect } from "vitest";
import { resolvePassword, verifyPassword, isHash, KEEP } from "@/lib/password";

describe("resolvePassword", () => {
  it("keeps the existing hash on KEEP sentinel", async () => {
    expect(await resolvePassword(KEEP, "$2existing")).toBe("$2existing");
  });
  it("keeps the existing hash when undefined", async () => {
    expect(await resolvePassword(undefined, "$2existing")).toBe("$2existing");
  });
  it("clears the password on empty/null", async () => {
    expect(await resolvePassword("", "$2existing")).toBe(null);
    expect(await resolvePassword(null, "$2existing")).toBe(null);
  });
  it("hashes a new plaintext password", async () => {
    const h = await resolvePassword("hunter2", null);
    expect(isHash(h)).toBe(true);
    expect(h).not.toBe("hunter2");
  });
  it("passes an already-hashed value through unchanged", async () => {
    const h = await resolvePassword("hunter2", null);
    expect(await resolvePassword(h, null)).toBe(h);
  });
});

describe("verifyPassword", () => {
  it("accepts the correct password", async () => {
    const h = await resolvePassword("hunter2", null);
    expect(await verifyPassword("hunter2", h)).toBe(true);
  });
  it("rejects the wrong password", async () => {
    const h = await resolvePassword("hunter2", null);
    expect(await verifyPassword("nope", h)).toBe(false);
  });
  it("allows when no password is set", async () => {
    expect(await verifyPassword(undefined, null)).toBe(true);
  });
  it("rejects an empty attempt when a password is set", async () => {
    const h = await resolvePassword("hunter2", null);
    expect(await verifyPassword("", h)).toBe(false);
  });
});

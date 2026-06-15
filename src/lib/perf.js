// Device performance profile — one place to decide whether the reader may run
// expensive visual effects. Heavy effects (DRM watermark drift, embers, per-word
// animation, large glows) are gated behind these so they can never silently
// regress mobile scrolling again: if you add a costly effect, gate it on a flag
// from getDeviceProfile() rather than running it everywhere by default.
//
// All helpers are SSR-safe (return the "cheap" assumption when there is no
// window/matchMedia) and never throw.

function mq(query) {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(query).matches
      : false;
  } catch {
    return false;
  }
}

// Coarse pointer = touch-first device (phone/tablet). These have the smallest
// CPU/GPU budget and are exactly where the lag was reported.
export function isCoarsePointer() {
  return mq("(pointer: coarse)");
}

// Respect the OS "reduce motion" accessibility setting.
export function prefersReducedMotion() {
  return mq("(prefers-reduced-motion: reduce)");
}

// Small viewport — used to scale down decorative layers (e.g. the glow).
export function isSmallScreen() {
  return mq("(max-width: 640px)");
}

// One resolved snapshot the reader reads once on mount. `lite` is the single
// switch most effects check: true → render the cheap/static variant.
export function getDeviceProfile() {
  const coarse = isCoarsePointer();
  const reduced = prefersReducedMotion();
  const small = isSmallScreen();
  return {
    coarse,
    reducedMotion: reduced,
    smallScreen: small,
    // Animate decorative chrome only on a capable, motion-OK device.
    animate: !coarse && !reduced,
    // Cheap-render mode for anything heavy.
    lite: coarse || reduced,
  };
}

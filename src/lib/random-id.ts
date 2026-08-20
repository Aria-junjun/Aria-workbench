/**
 * Generate a RFC 4122 v4 UUID.
 *
 * Falls back to `crypto.getRandomValues` (or `Math.random` as a last resort)
 * when the browser/runtime does not expose `crypto.randomUUID()` directly
 * (e.g. older Chromium, Safari, or some server runtimes).
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const buf = new Uint8Array(16);
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < 16; i += 1) {
      buf[i] = Math.floor(Math.random() * 256);
    }
  }
  // version 4
  buf[6] = (buf[6] & 0x0f) | 0x40;
  // variant bits 10xx
  buf[8] = (buf[8] & 0x3f) | 0x80;

  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

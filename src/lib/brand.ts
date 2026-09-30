/**
 * The Gelbien mark: an 11-sided gold coin (the loonie's shape) with a squared G stamped into it,
 * on a dark tile. One source for the app's <LogoMark> and the icon files that
 * scripts/generate-icons.mjs writes (favicon, PWA and Apple icons, brand PNGs).
 * Drawn on a 64×64 grid.
 */
export const BRAND = { gold: "#d9b45f", ink: "#131316" } as const;

export const MARK = {
  /** the coin: a regular 11-gon, radius 18, a corner at the top */
  coin: "32,14 41.73,16.86 48.37,24.52 49.82,34.56 45.6,43.79 37.07,49.27 26.93,49.27 18.4,43.79 14.18,34.56 15.63,24.52 22.27,16.86",
  /** the coin's rim, radius 15 */
  rim: "32,17 40.11,19.38 45.64,25.77 46.85,34.13 43.33,41.83 36.22,46.39 27.78,46.39 20.67,41.83 17.15,34.13 18.36,25.77 23.89,19.38",
  /** the stamped G */
  g: "M37.5 25H28A4 4 0 0 0 24 29V36A4 4 0 0 0 28 40H36A4 4 0 0 0 40 36V32.5H33.5",
} as const;

/**
 * The mark as a standalone SVG document.
 * - "rounded": the app icon (rounded tile, transparent corners)
 * - "square": full-bleed tile, for icons the OS masks itself (iOS, Android maskable)
 * - "coin": just the coin, transparent, cropped to it
 */
export function markSvg(variant: "rounded" | "square" | "coin"): string {
  const { gold, ink } = BRAND;
  const tile = variant === "coin" ? "" : `<rect width="64" height="64" rx="${variant === "rounded" ? 16 : 0}" fill="${ink}"/>`;
  const viewBox = variant === "coin" ? "11 11 42 42" : "0 0 64 64";
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">`,
    tile,
    `<polygon points="${MARK.coin}" fill="${gold}" stroke="${gold}" stroke-width="2" stroke-linejoin="round"/>`,
    `<polygon points="${MARK.rim}" fill="none" stroke="${ink}" stroke-opacity="0.3" stroke-width="1"/>`,
    `<path d="${MARK.g}" fill="none" stroke="${ink}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `</svg>`,
  ].join("");
}

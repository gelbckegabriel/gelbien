// Writes every icon file from the mark in src/lib/brand.ts. Run after changing the logo:
//   npm run icons
import { mkdir, writeFile } from "node:fs/promises";
import sharp from "sharp";
import { markSvg } from "../src/lib/brand.ts";

const png = async (variant, size, file) => {
  await sharp(Buffer.from(markSvg(variant)), { density: 72 * (size / 64) * 2 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(file);
  console.log(`${file} (${size}×${size})`);
};

await mkdir("public/icons", { recursive: true });
await mkdir("public/brand", { recursive: true });

// favicon — Next serves src/app/icon.svg as /icon.svg and links it
await writeFile("src/app/icon.svg", `${markSvg("rounded")}\n`);
console.log("src/app/icon.svg");

// iOS home screen: full-bleed, iOS rounds the corners itself (Next links src/app/apple-icon.png)
await png("square", 180, "src/app/apple-icon.png");
// installable web app (manifest): regular icons, plus a full-bleed one Android can mask to any shape
await png("rounded", 192, "public/icons/icon-192.png");
await png("rounded", 512, "public/icons/icon-512.png");
await png("square", 512, "public/icons/maskable-512.png");
// for use outside the app
await png("rounded", 1024, "public/brand/gelbien-icon-1024.png");
await png("coin", 1024, "public/brand/gelbien-coin-1024.png");

#!/usr/bin/env node
/**
 * Generate iOS / Android asset files (icon, adaptive-icon, splash) from the
 * canonical T2W logo at the repo root. Idempotent — overwrites the same
 * three files every time. Run after pulling a new logo:
 *
 *   node mobile/scripts/generate-assets.mjs
 *
 * Outputs:
 *   mobile/assets/icon.png           1024×1024, opaque #1a1a2e bg
 *   mobile/assets/adaptive-icon.png  1024×1024, transparent (Android sets bg)
 *   mobile/assets/splash.png         1242×2436 (9:19.5), opaque bg
 */
import sharp from "sharp";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../..");
const outDir = path.join(__dirname, "..", "assets");
const logoPath = path.join(repoRoot, "TalesOn2Wheels_One_White.Trnsprnt.png");

const BRAND_BG = { r: 26, g: 26, b: 46, alpha: 1 };

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function buildIcon() {
  // App icon: opaque background, logo 70% of the square.
  const target = 1024;
  const logoSize = Math.round(target * 0.7);
  const logo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width: target, height: target, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(outDir, "icon.png"));
}

async function buildAdaptiveIcon() {
  // Adaptive icon foreground: transparent canvas, logo at 60% inside the
  // 1024 square (Android applies its own mask/bg).
  const target = 1024;
  const logoSize = Math.round(target * 0.6);
  const logo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: target,
      height: target,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(outDir, "adaptive-icon.png"));
}

async function buildSplash() {
  const width = 1242;
  const height = 2436;
  const logoSize = Math.round(Math.min(width, height) * 0.45);
  const logo = await sharp(logoPath)
    .resize(logoSize, logoSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({
    create: { width, height, channels: 4, background: BRAND_BG },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(path.join(outDir, "splash.png"));
}

async function main() {
  if (!(await fs.stat(logoPath).catch(() => null))) {
    console.error(`[T2W] Logo not found at ${logoPath}. Expected the file at the repo root.`);
    process.exit(1);
  }
  await ensureDir(outDir);
  await Promise.all([buildIcon(), buildAdaptiveIcon(), buildSplash()]);
  console.log(`[T2W] Wrote assets to ${outDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

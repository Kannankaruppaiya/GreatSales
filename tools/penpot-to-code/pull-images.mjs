/**
 * Downloads the images a Penpot file uses, so generated screens show the real
 * photographs instead of placeholders.
 *
 * FigmaToCode cannot reach Penpot's media, so it leaves a placeholder token per
 * image fill; render-core rewrites those to `<images>/<name>.<ext>`, and this
 * fetches exactly those files.
 *
 * Cloudflare challenges plain HTTP clients on Penpot's /api/ paths, but not on
 * /assets/by-file-media-id/<id>, which is why the file itself has to come out
 * of a browser tab while its images can be pulled straight from Node.
 *
 * Needs PENPOT_TOKEN (Penpot → Settings → Access tokens), read from the
 * environment or from .env.local.
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ASSET_URL = "https://design.penpot.app/assets/by-file-media-id/";

export const penpotToken = () => {
  if (process.env.PENPOT_TOKEN) return process.env.PENPOT_TOKEN;
  for (const file of [".env.local", ".env"]) {
    if (!fs.existsSync(file)) continue;
    const match = /^PENPOT_TOKEN=(.+)$/m.exec(fs.readFileSync(file, "utf8"));
    if (match) return match[1].trim();
  }
  return null;
};

/** Collects { id, name, ext } for every image fill in a loaded Penpot file. */
export const imagesOf = (file) => {
  const found = new Map();
  const EXT = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/svg+xml": "svg",
  };
  for (const page of file.pages) {
    for (const shape of Object.values(page.objects)) {
      for (const fill of shape.fills || []) {
        const image = fill.fillImage;
        if (!image) continue;
        found.set(image.id, {
          id: image.id,
          name: image.name || image.id,
          ext: EXT[image.mtype] || "png",
        });
      }
    }
  }
  return [...found.values()];
};

export const pullImages = async (images, outDir, token) => {
  fs.mkdirSync(outDir, { recursive: true });
  const written = [];
  for (const image of images) {
    const target = path.join(outDir, `${image.name}.${image.ext}`);
    if (fs.existsSync(target)) continue;
    const res = await fetch(ASSET_URL + image.id, {
      headers: { Authorization: `Token ${token}` },
    });
    if (!res.ok) {
      console.warn(`  image ${image.name}: HTTP ${res.status}`);
      continue;
    }
    fs.writeFileSync(target, Buffer.from(await res.arrayBuffer()));
    written.push(target);
  }
  return written;
};

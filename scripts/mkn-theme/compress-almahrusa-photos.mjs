import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = path.resolve("public", "almahrusa");
const keep = new Set([
  "hero.jpg",
  "garden.jpg",
  "royal.jpg",
  "standard.jpg",
  "family.jpg",
  "living.jpg",
  "kitchen.jpg",
  "exterior.jpg",
  "gallery-01.jpg",
  "gallery-02.jpg",
  "gallery-03.jpg",
  "gallery-04.jpg",
  "gallery-05.jpg",
  "gallery-06.jpg",
]);

for (const name of fs.readdirSync(dir)) {
  if (!keep.has(name)) {
    fs.unlinkSync(path.join(dir, name));
    console.log("removed", name);
  }
}

for (const name of [...keep]) {
  const file = path.join(dir, name);
  if (!fs.existsSync(file)) continue;
  const buf = await sharp(file)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const out = path.join(dir, name.replace(/\.jpg$/i, ".web.jpg"));
  fs.writeFileSync(out, buf);
  console.log(path.basename(out), Math.round(buf.length / 1024), "KB");
}

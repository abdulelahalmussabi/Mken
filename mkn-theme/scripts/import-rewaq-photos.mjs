import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public", "rewaq");
fs.mkdirSync(destDir, { recursive: true });

const photos = [
  {
    name: "hero.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmDnKQ0Yfc_HW2a6r5TRqz_KbwsKhzmqRq5ljetajXz9izxrYKNCcVLJCa1VqEUuKFNLgtMq5h1Havho8vn9__VBEwmHHQuR3CC2ENd14Wm9UrNvczBK8HQ2swW2fuz-iCVo35yujapWfdw=s1600",
  },
  {
    name: "deluxe.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWnG6fb8aN1CyFvLcCXVpyfo1_iPqbSoY9r3jKSqS2kKpK2P8Sy1galji5dVABIUTtcEeS6Msn0TYuDvX1X6aH5FqgIjuaYlaFM9plCPISnXVT5Jie_MVNFJlGvPpo8S_VHckbm1dWb_EjQ=s1600",
  },
  {
    name: "suite.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlA_xRZ31KvZ-jYsG88QfF5ehO1rttADMUp8LHIDJnhGrdSzH2KkRcBWh-0LmlHUJGTdKX5JQTTsomfkYQdVtI9D28RZDLdhP4hfsUz1l_5WOoaPXRaQNnka4KxsYo13Y0XoSwfu-OL74Mp=s1600",
  },
  {
    name: "standard.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmuo36cc71kNBemKhMKSFXPJlYx2XmFSLjLU_qcHVj9F7UwhfEXra83EHDGUdzsTzfBXXx84jJauDAq-Ibj5MxyneYPZ0nDIAJ2Yxyg988QpZy454VVRu04JGBbjetvmKFo0ieYtKVUtskd=s1600",
  },
  {
    name: "family.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWnoobQcdEaYSgINwEIVKYRHTIIMhQ5qpeF7WCFY43SM3KNnl3JXGRSeN8d5ArERSFpl_d93ylTxeIh0VdJPyt7RIuuAStqWPrThLq3QD_pUswQQgVRarQqXE_0yjBYS1J0eRiiCoPc4KnE=s1600",
  },
];

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4000) throw new Error(`too small ${buf.length}`);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

for (const photo of photos) {
  const dest = path.join(destDir, photo.name);
  const bytes = await download(photo.url, dest);
  const web = await sharp(dest)
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true })
    .toBuffer();
  const webName = photo.name.replace(/\.jpg$/i, ".web.jpg");
  fs.writeFileSync(path.join(destDir, webName), web);
  console.log(photo.name, bytes, "->", webName, Math.round(web.length / 1024), "KB");
}

console.log("files", fs.readdirSync(destDir).join(", "));

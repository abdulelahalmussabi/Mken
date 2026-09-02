import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destDir = path.join(root, "public", "almahrusa");
fs.mkdirSync(destDir, { recursive: true });

const localCandidates = [
  String.raw`C:\Users\B A R A\Downloads\المحروسة 17-01-2026 ماجد حافظ-20260723T070424Z-1-001\المحروسة 17-01-2026 ماجد حافظ`,
  String.raw`C:\Users\B A R A\Downloads`,
];

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".JPG", ".JPEG", ".PNG", ".WEBP"]);

function listImages(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) listImages(full, acc);
    else if (IMAGE_EXT.has(path.extname(entry.name))) acc.push(full);
  }
  return acc;
}

function findLocalFolder() {
  const exact = localCandidates[0];
  if (fs.existsSync(exact)) return exact;
  const downloads = localCandidates[1];
  if (!fs.existsSync(downloads)) return "";
  const hits = fs
    .readdirSync(downloads, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /محروس|mahrousa|almahrusa/i.test(entry.name))
    .map((entry) => path.join(downloads, entry.name));
  for (const hit of hits) {
    const nested = listImages(hit);
    if (nested.length) return hit;
  }
  return "";
}

const mapsPhotos = [
  {
    name: "hero.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWk8DZi2mPpvLjP5tQAVSTk_8EEBTI5bmlEhV3yNrn02wwD7lL_5mAvYW1mZlcZeKeOdJ48liDnHQPYf2lpglaIzYmwI2Wa9onhHieHn-Cgdyubvw7ULEA6GzYAouFd5Jnlc6ZZlP_QId7b0=s1600",
  },
  {
    name: "room-1.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWnuudLe98KuIbxEBEkHfRwe4uoXKIjs67rpgzX3Rwj15WLmcC-5zXA8By1bJC-PRe5I5T_yEWwIeb6O_LilMh9os_XaPVVexAaPLP-vhgL86DpRCNHo7V3OOytXjI8lyI9kNgXDCjAhQAQ=s1600",
  },
  {
    name: "room-2.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWmmQPPvofWgtngaOqvR4elPEA6tUjEvtQ9muHfE5dBR8_HJReYB7MAZ___0O5SU9lK-33uuJZD3xb8x476mzDx3WiiLmu7tgB5MYS7-7yxR3aIFK-kLJwCRmCXm8YAbrfsYrA1K7xOrmRIC=s1600",
  },
  {
    name: "room-3.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlYN7vDJKw9yH6DsKDuMJYEggOeSjZJmNksyv-CTyWBIf6TwdltyYthZZLj_JkCAoDPmHsIk5F25cW10YA-oqwAJpf84_kEQTAKlzkL74zLoa6O-5cbuI1OBMlFSC8i2KG9wS-5PjFiGSA=s1600",
  },
  {
    name: "room-4.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWkEDrrg6MwEI7qHvZME45Cjmwl36bHMcCSSXz5woAtOu2KyfF9f9-zrEuthbOoqw_pf4_8SnW82i6hRYbAqMk64NgYnVfEQ-sIeR6S5vbC4UbC0u_eT2z5OmX-LYl9cPl_DMqG0q0fgMsHE=s1600",
  },
  {
    name: "room-5.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWl8lPzpQvegaAnskhUb3rk86qQlirsDumAO6ClPntJX8rZmrKfz_yQnBxcaIm0akTR_9bllenujOiFfG9eDnH1N20SBAHTmZxaFypnzi-IUXr7vqlbywr25R2Khrjv4a6VJNNl-zLbCU0o2=s1600",
  },
  {
    name: "room-6.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWkdXL0atHqlGRLVAffnxmaYcUD29cSJNTlHkx2_VHkHU21daGJkV7pnWaIQp1uPDqDJg8vTksPJ3EyQ7Pu3kBwlpVikEhV_o34BNdbCKZ6n24IUlB86T-uBJTM4n6oCPaEF0Ft7JLIs1pOu=s1600",
  },
  {
    name: "room-7.jpg",
    url: "https://lh3.googleusercontent.com/gps-cs-s/AHRPTWlxIYwlrauiZOedEOm0yuk7V-7NGa1z0m3SgmOR0mwdeWAxdl5swLDam_2STGz0FhM9UlohACgir4Wo6kYgkk_cLUULstLcUeSc1ehpmFeU-fOoNwSH222QvlIY84RJ2p16gk6HjA=s1600",
  },
];

async function download(url, dest) {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 4000) throw new Error(`too small ${buf.length} ${url}`);
  fs.writeFileSync(dest, buf);
  return buf.length;
}

const localFolder = findLocalFolder();
const localImages = localFolder ? listImages(localFolder).sort((a, b) => fs.statSync(b).size - fs.statSync(a).size) : [];
console.log("local folder:", localFolder || "(not found)");
console.log("local images:", localImages.length);

const names = ["hero.jpg", "garden.jpg", "royal.jpg", "standard.jpg", "family.jpg", "living.jpg", "kitchen.jpg", "exterior.jpg"];

if (localImages.length >= 4) {
  names.forEach((name, i) => {
    const src = localImages[i % localImages.length];
    fs.copyFileSync(src, path.join(destDir, name));
    console.log("copied", path.basename(src), "->", name);
  });
  localImages.slice(0, 12).forEach((src, i) => {
    const name = `gallery-${String(i + 1).padStart(2, "0")}${path.extname(src).toLowerCase() || ".jpg"}`;
    fs.copyFileSync(src, path.join(destDir, name));
  });
} else {
  for (const photo of mapsPhotos) {
    const dest = path.join(destDir, photo.name);
    try {
      const bytes = await download(photo.url, dest);
      console.log("downloaded", photo.name, bytes);
    } catch (err) {
      console.warn("failed", photo.name, err.message);
    }
  }
}

console.log("dest files:", fs.readdirSync(destDir).join(", "));

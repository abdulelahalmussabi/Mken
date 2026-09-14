import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", shell: true });
  if (result.status) process.exit(result.status);
}

if (!existsSync(path.join(root, "node_modules", "next"))) {
  run("npm", ["ci"], root);
}
run("npm", ["run", "build"], root);

for (const name of [".next", "public"]) {
  const from = path.join(root, name);
  const to = path.join(here, name);
  if (!existsSync(from)) {
    console.error(`Missing ${from} after root build`);
    process.exit(1);
  }
  rmSync(to, { recursive: true, force: true });
  cpSync(from, to, { recursive: true });
}

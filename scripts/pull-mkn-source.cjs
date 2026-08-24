/**
 * Pull the source files of the `mkn` (Next.js theme) Vercel deployment
 * into ./mkn-theme, using the local Vercel CLI token (never printed).
 *
 * Usage: node scripts/pull-mkn-source.cjs [deploymentUrlOrId]
 */
const fs = require('fs');
const path = require('path');

const AUTH_PATH = path.join(
  process.env.APPDATA,
  'xdg.data',
  'com.vercel.cli',
  'auth.json'
);
const DEST = path.join(__dirname, '..', 'mkn-theme');
const DEPLOYMENT = process.argv[2] || 'mkn-po4t8br9b-mken-s-projects.vercel.app';

const token = JSON.parse(fs.readFileSync(AUTH_PATH, 'utf8')).token;
if (!token) {
  console.error('No token found in Vercel CLI auth.json');
  process.exit(1);
}

async function api(pathname) {
  const res = await fetch(`https://api.vercel.com${pathname}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`${pathname} -> HTTP ${res.status}: ${await res.text()}`);
  }
  return res;
}

function flatten(nodes, prefix, out) {
  for (const node of nodes) {
    const p = prefix ? `${prefix}/${node.name}` : node.name;
    if (node.type === 'directory' && node.children) {
      flatten(node.children, p, out);
    } else if (node.type === 'file') {
      out.push({ path: p, uid: node.uid, link: node.link });
    }
  }
  return out;
}

(async () => {
  // Resolve team id
  const teams = await (await api('/v2/teams')).json();
  const team = teams.teams.find((t) => t.slug === 'mken-s-projects');
  const teamQ = team ? `?teamId=${team.id}` : '';
  console.log('team:', team ? team.slug : '(personal)');

  // Resolve deployment id
  const dep = await (
    await api(`/v13/deployments/${DEPLOYMENT}${teamQ}`)
  ).json();
  console.log('deployment:', dep.id, '| created:', new Date(dep.createdAt).toISOString());

  // File tree (source files uploaded by CLI deploy)
  const tree = await (
    await api(`/v6/deployments/${dep.id}/files${teamQ}`)
  ).json();
  const files = flatten(tree, '', []);
  const skip = /^(node_modules|\.next|\.git)\//;
  const wanted = files.filter((f) => !skip.test(f.path));
  console.log(`files in tree: ${files.length}, downloading: ${wanted.length}`);

  let ok = 0;
  for (const f of wanted) {
    // Tree paths start with "src/" for CLI-uploaded sources
    const rel = f.path.replace(/^src\//, '');
    const abs = path.join(DEST, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const res = await api(`/v7/deployments/${dep.id}/files/${f.uid}${teamQ}`);
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await res.json();
      fs.writeFileSync(abs, Buffer.from(body.data, 'base64'));
    } else {
      fs.writeFileSync(abs, Buffer.from(await res.arrayBuffer()));
    }
    ok++;
    if (ok % 25 === 0) console.log(`  ${ok}/${wanted.length}`);
  }
  console.log(`done: ${ok}/${wanted.length} files -> ${DEST}`);
})().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Validates that every workspace package is listed in the changeset
 * `fixed` group (or explicitly ignored).
 *
 * Run:  node scripts/check-changeset-fixed.mjs
 * Exit: 0 = OK, 1 = packages are missing from the fixed group
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { resolve, dirname, join } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── Load changeset config ─────────────────────────────────────────────────────
const config = JSON.parse(
  readFileSync(resolve(root, ".changeset/config.json"), "utf8")
);

const fixedSet = new Set(config.fixed?.flat() ?? []);
const ignoredSet = new Set(config.ignore ?? []);

// ── Collect all workspace package names ──────────────────────────────────────
function findPackageJsons(dirs) {
  const results = [];
  for (const dir of dirs) {
    const abs = resolve(root, dir);
    try {
      for (const entry of readdirSync(abs)) {
        const pkgFile = join(abs, entry, "package.json");
        try {
          statSync(pkgFile);
          results.push(join(dir, entry, "package.json"));
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return results;
}

const manifests = findPackageJsons(["packages", "apps"]);

const missing = [];

for (const rel of manifests) {
  const pkg = JSON.parse(readFileSync(resolve(root, rel), "utf8"));
  const name = pkg.name;
  if (!name) continue;
  if (!fixedSet.has(name) && !ignoredSet.has(name)) {
    missing.push({ name, path: rel });
  }
}

// ── Report ────────────────────────────────────────────────────────────────────
if (missing.length === 0) {
  console.log("✅  All workspace packages are in the changeset fixed group.");
  process.exit(0);
} else {
  console.error(
    "❌  The following packages are missing from the changeset fixed group in .changeset/config.json:\n"
  );
  for (const { name, path } of missing) {
    console.error(`    • ${name}  (${path})`);
  }
  console.error(
    "\nAdd them to the `fixed` array in .changeset/config.json to keep versions in sync."
  );
  process.exit(1);
}

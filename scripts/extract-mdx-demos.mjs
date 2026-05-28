#!/usr/bin/env node
/**
 * extract-mdx-demos.mjs
 *
 * Scans an MDX file for `<InteractiveDemo ... />` blocks, evaluates each
 * `schema={{ ... }}` JS-object literal, and:
 *
 *   1. Writes the schema to `examples/schema-catalog/src/schemas/<category>/<slug>.json`
 *   2. Emits a draft MDX replacement to `<file>.migrated` that uses
 *      `<SchemaExample id="<category>/<slug>" />` instead.
 *   3. Prints a registry-entry snippet to stdout that should be pasted into
 *      `examples/schema-catalog/src/index.ts`.
 *
 * The MDX `<file>` is NOT modified in place; you review `.migrated` then `mv`.
 *
 * Usage:
 *   node scripts/extract-mdx-demos.mjs <category> <file.mdx>
 *
 * Example:
 *   node scripts/extract-mdx-demos.mjs dashboard content/docs/blocks/dashboard.mdx
 *
 * Limitations:
 *   - Schemas must be pure JS object literals (no JSX expressions, no fn calls).
 *   - title/description must be string literals on the same component opening tag.
 *   - `<InteractiveDemo>` self-closing only (`/>`); paired tags are skipped.
 */

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const CATALOG_DIR = path.join(ROOT, 'examples/schema-catalog/src/schemas');

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

/**
 * Given the source of a single `<InteractiveDemo ... />` block, extract:
 *   { title, description, schemaSource }
 *
 * Title/description are string-literal props on the opening tag.
 * `schemaSource` is the *text* between `schema={` and the matching `}` (one
 * level of `{}` nesting, so we strip the outer one).
 */
function parseDemoBlock(blockSrc) {
  // title="..."
  const titleMatch = blockSrc.match(/title=["']([^"']+)["']/);
  const descMatch = blockSrc.match(/description=["']([^"']+)["']/);

  const schemaIdx = blockSrc.indexOf('schema={');
  if (schemaIdx === -1) return null;

  // Walk the brace tree starting at the outer `{` after `schema=`.
  const start = schemaIdx + 'schema='.length; // points at first `{`
  let depth = 0;
  let end = -1;
  let inStr = null;
  for (let i = start; i < blockSrc.length; i++) {
    const c = blockSrc[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      inStr = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  if (end === -1) return null;

  // The schema= prop value is `{ <object literal> }`. Strip the outer braces
  // to get a bare object literal; we'll add `(` `)` around it for `vm`.
  const inner = blockSrc.slice(start + 1, end).trim();

  return {
    title: titleMatch?.[1] ?? null,
    description: descMatch?.[1] ?? null,
    schemaSource: inner,
  };
}

function evaluateObjectLiteral(src) {
  // Wrap in parens so the parser treats it as an expression.
  // Strip trailing commas after the last property (lenient JS, but vm may not
  // care — keep them, they're valid in modern JS).
  return vm.runInNewContext(`(${src})`, {}, { timeout: 1000 });
}

function findInteractiveDemoBlocks(mdx) {
  const blocks = [];
  const openTag = /<InteractiveDemo\b/g;
  let m;
  while ((m = openTag.exec(mdx)) !== null) {
    const start = m.index;
    // Find the matching `/>` accounting for `{}` nesting (schemas contain `>`!)
    let depth = 0;
    let inStr = null;
    let i = start + openTag.lastIndex - openTag.lastIndex + '<InteractiveDemo'.length;
    let end = -1;
    for (; i < mdx.length; i++) {
      const c = mdx[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') {
        inStr = c;
        continue;
      }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (depth === 0 && c === '/' && mdx[i + 1] === '>') {
        end = i + 2;
        break;
      }
    }
    if (end === -1) {
      console.warn(`[skip] couldn't find /> for <InteractiveDemo at offset ${start}`);
      continue;
    }
    blocks.push({ start, end, src: mdx.slice(start, end) });
    openTag.lastIndex = end;
  }
  return blocks;
}

function main() {
  const [category, mdxPath] = process.argv.slice(2);
  if (!category || !mdxPath) {
    console.error('Usage: node scripts/extract-mdx-demos.mjs <category> <file.mdx>');
    process.exit(1);
  }
  const abs = path.resolve(ROOT, mdxPath);
  const mdx = fs.readFileSync(abs, 'utf8');

  const outDir = path.join(CATALOG_DIR, category);
  fs.mkdirSync(outDir, { recursive: true });

  const blocks = findInteractiveDemoBlocks(mdx);
  if (blocks.length === 0) {
    console.error('No <InteractiveDemo /> blocks found.');
    process.exit(0);
  }

  const entries = [];
  const usedSlugs = new Set();
  let newMdx = '';
  let cursor = 0;

  for (const [i, b] of blocks.entries()) {
    const parsed = parseDemoBlock(b.src);
    if (!parsed) {
      console.warn(`[skip] block #${i}: couldn't parse`);
      continue;
    }
    const { title, description, schemaSource } = parsed;
    let schema;
    try {
      schema = evaluateObjectLiteral(schemaSource);
    } catch (err) {
      console.error(`[fail] block #${i} ("${title ?? '?'}"): ${err.message}`);
      continue;
    }
    let slug = title ? slugify(title) : `demo-${i + 1}`;
    let n = 2;
    const baseSlug = slug;
    while (usedSlugs.has(slug)) slug = `${baseSlug}-${n++}`;
    usedSlugs.add(slug);

    const id = `${category}/${slug}`;
    const jsonPath = path.join(outDir, `${slug}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(schema, null, 2) + '\n');

    entries.push({ id, slug, title, description });

    // Build replacement in the new MDX.
    newMdx += mdx.slice(cursor, b.start);
    newMdx += `<SchemaExample id="${id}" />`;
    cursor = b.end;
  }
  newMdx += mdx.slice(cursor);

  // Swap the import (if present) so the file uses SchemaExample.
  newMdx = newMdx.replace(
    /import\s*\{\s*InteractiveDemo[^}]*\}\s*from\s*['"]@\/app\/components\/ComponentDemo['"];?/,
    `import { SchemaExample } from '@/app/components/ComponentDemo';`,
  );

  const outMdx = abs + '.migrated';
  fs.writeFileSync(outMdx, newMdx);

  console.log(`\nWrote ${entries.length} schema file(s) to ${path.relative(ROOT, outDir)}`);
  console.log(`Wrote draft MDX to ${path.relative(ROOT, outMdx)}\n`);
  console.log('--- Registry entries (paste into examples/schema-catalog/src/index.ts) ---\n');
  for (const e of entries) {
    const importIdent = `${category}_${e.slug.replace(/-/g, '_')}`;
    console.log(
      `import ${importIdent} from './schemas/${category}/${e.slug}.json' with { type: 'json' };`,
    );
  }
  console.log();
  for (const e of entries) {
    const importIdent = `${category}_${e.slug.replace(/-/g, '_')}`;
    console.log(`  '${e.id}': {`);
    console.log(`    id: '${e.id}',`);
    console.log(`    meta: {`);
    console.log(`      title: ${JSON.stringify(e.title ?? e.slug)},`);
    console.log(`      description: ${JSON.stringify(e.description ?? '')},`);
    console.log(`      category: '${category}',`);
    console.log(`    },`);
    console.log(`    schema: ${importIdent},`);
    console.log(`  },`);
  }
}

main();

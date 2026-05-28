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
 *   { title, description, schemaSource } for single-schema demos, OR
 *   { title, description, examplesSource } for multi-example galleries.
 *
 * Title/description are string-literal props on the opening tag.
 * `schemaSource` is the *text* between `schema={` and the matching `}` (one
 * level of `{}` nesting, so we strip the outer one).
 * `examplesSource` is the *text* between `examples={[` and the matching `]}`.
 */
function parseDemoBlock(blockSrc) {
  const titleMatch = blockSrc.match(/title=["']([^"']+)["']/);
  const descMatch = blockSrc.match(/description=["']([^"']+)["']/);

  const findBalanced = (anchor, open, close) => {
    const a = blockSrc.indexOf(anchor);
    if (a === -1) return null;
    // Locate the first `open` bracket at or after the end of the anchor.
    let openIdx = -1;
    for (let i = a + anchor.length - 1; i < blockSrc.length; i++) {
      if (blockSrc[i] === open) { openIdx = i; break; }
    }
    if (openIdx === -1) return null;
    let depth = 0;
    let inStr = null;
    for (let i = openIdx; i < blockSrc.length; i++) {
      const c = blockSrc[i];
      if (inStr) {
        if (c === '\\') i++;
        else if (c === inStr) inStr = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return blockSrc.slice(openIdx + 1, i).trim();
      }
    }
    return null;
  };

  const schemaInner = findBalanced('schema={', '{', '}');
  if (schemaInner !== null) {
    return {
      kind: 'single',
      title: titleMatch?.[1] ?? null,
      description: descMatch?.[1] ?? null,
      schemaSource: schemaInner,
    };
  }

  // Fall back to multi-example gallery.
  const examplesInner = findBalanced('examples={', '[', ']');
  if (examplesInner !== null) {
    return {
      kind: 'multi',
      title: titleMatch?.[1] ?? null,
      description: descMatch?.[1] ?? null,
      examplesSource: examplesInner,
    };
  }
  return null;
}

function evaluateObjectLiteral(src) {
  // Wrap in parens so the parser treats it as an expression.
  // Strip trailing commas after the last property (lenient JS, but vm may not
  // care — keep them, they're valid in modern JS).
  return vm.runInNewContext(`(${src})`, {}, { timeout: 1000 });
}

function findInteractiveDemoBlocks(mdx, tagNames = ['InteractiveDemo', 'ComponentDemo']) {
  const blocks = [];
  for (const tagName of tagNames) {
    const openTag = new RegExp(`<${tagName}\\b`, 'g');
    let m;
    while ((m = openTag.exec(mdx)) !== null) {
      const start = m.index;
      let depth = 0;
      let inStr = null;
      let i = start + `<${tagName}`.length;
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
        console.warn(`[skip] couldn't find /> for <${tagName} at offset ${start}`);
        continue;
      }
      blocks.push({ start, end, src: mdx.slice(start, end), tagName });
      openTag.lastIndex = end;
    }
  }
  // Sort by document order so replacement offsets stay monotonic.
  blocks.sort((a, b) => a.start - b.start);
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
    const { title, description, kind } = parsed;
    const baseTitleSlug = title ? slugify(title) : `demo-${i + 1}`;

    if (kind === 'single') {
      let schema;
      try {
        schema = evaluateObjectLiteral(parsed.schemaSource);
      } catch (err) {
        console.error(`[fail] block #${i} ("${title ?? '?'}"): ${err.message}`);
        continue;
      }
      let slug = baseTitleSlug;
      let n = 2;
      while (usedSlugs.has(slug)) slug = `${baseTitleSlug}-${n++}`;
      usedSlugs.add(slug);
      const id = `${category}/${slug}`;
      fs.writeFileSync(
        path.join(outDir, `${slug}.json`),
        JSON.stringify(schema, null, 2) + '\n',
      );
      entries.push({ id, slug, title, description, multi: false });

      newMdx += mdx.slice(cursor, b.start);
      newMdx += `<SchemaExample id="${id}" />`;
      cursor = b.end;
    } else {
      // kind === 'multi'
      let examplesArr;
      try {
        examplesArr = evaluateObjectLiteral(`[${parsed.examplesSource}]`);
      } catch (err) {
        console.error(`[fail] block #${i} ("${title ?? '?'}") multi: ${err.message}`);
        continue;
      }
      const childIds = [];
      for (const child of examplesArr) {
        const childTitle = child.label ?? child.title ?? `${title} item`;
        let slug = slugify(`${baseTitleSlug}-${childTitle}`);
        let n = 2;
        const base = slug;
        while (usedSlugs.has(slug)) slug = `${base}-${n++}`;
        usedSlugs.add(slug);
        const id = `${category}/${slug}`;
        fs.writeFileSync(
          path.join(outDir, `${slug}.json`),
          JSON.stringify(child.schema, null, 2) + '\n',
        );
        entries.push({
          id,
          slug,
          title: childTitle,
          description: child.description ?? '',
          multi: true,
        });
        childIds.push(id);
      }
      // Replace the whole <InteractiveDemo examples={...} /> block with a
      // gallery: heading + one <SchemaExample/> per child.
      const gallery = childIds
        .map((cid) => `<SchemaExample id="${cid}" />`)
        .join('\n\n');
      newMdx += mdx.slice(cursor, b.start);
      newMdx += gallery;
      cursor = b.end;
    }
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

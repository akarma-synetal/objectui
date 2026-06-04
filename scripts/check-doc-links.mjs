import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const DOCS_ROOT = path.resolve('content/docs');
const DOCS_ROUTE_PREFIX = '/docs';
const MARKDOWN_LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, files);
      continue;
    }
    if (/\.(md|mdx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function routeExists(href) {
  const cleanHref = href.split('#')[0].split('?')[0].trim();

  if (!cleanHref || !cleanHref.startsWith(DOCS_ROUTE_PREFIX)) {
    return true;
  }

  const routePath = cleanHref.replace(/^\/docs\/?/, '');
  if (!routePath) {
    return existsSync(path.join(DOCS_ROOT, 'index.md')) || existsSync(path.join(DOCS_ROOT, 'index.mdx'));
  }

  const candidates = [
    path.join(DOCS_ROOT, `${routePath}.md`),
    path.join(DOCS_ROOT, `${routePath}.mdx`),
    path.join(DOCS_ROOT, routePath, 'index.md'),
    path.join(DOCS_ROOT, routePath, 'index.mdx'),
  ];

  return candidates.some((candidate) => existsSync(candidate));
}

const broken = [];

for (const file of walk(DOCS_ROOT)) {
  const source = readFileSync(file, 'utf8');
  let match;

  while ((match = MARKDOWN_LINK_RE.exec(source)) !== null) {
    const href = match[1].trim();
    if (
      href.startsWith('http://') ||
      href.startsWith('https://') ||
      href.startsWith('mailto:') ||
      href.startsWith('#')
    ) {
      continue;
    }

    if (!routeExists(href)) {
      broken.push({ file, href });
    }
  }
}

if (broken.length > 0) {
  console.error(`Found ${broken.length} broken docs link${broken.length === 1 ? '' : 's'}:`);
  for (const item of broken) {
    console.error(`- ${path.relative(process.cwd(), item.file)} -> ${item.href}`);
  }
  process.exit(1);
}

console.log('Docs links are valid.');

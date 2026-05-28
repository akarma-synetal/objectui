#!/usr/bin/env python3
"""
Regenerate examples/schema-catalog/src/index.ts from the JSON files on disk.

Reads every src/schemas/<category>/<slug>.json file and emits a typed registry
indexed by `<category>/<slug>`. Metadata (title, description, tags) for the
hand-curated auth category is preserved from a small in-file table; everything
else gets a title/description derived from /tmp/all-entries.txt (produced by
the extractor) when available, otherwise from the slug.

Run from repo root: python3 scripts/regenerate-catalog-index.py
"""
import json
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMAS = ROOT / 'examples/schema-catalog/src/schemas'
OUT = ROOT / 'examples/schema-catalog/src/index.ts'
ENTRIES_FILE = Path('/tmp/all-entries.txt')

# Hand-curated metadata for categories migrated before tagging support.
HANDCRAFTED = {
    'auth/login-simple': {
        'title': 'Simple Login Form',
        'description': 'Email + password sign-in with "remember me" and a social provider button.',
        'tags': ['login', 'form', 'card', 'oauth'],
    },
    'auth/signup': {
        'title': 'Sign Up Form',
        'description': 'Two-column registration form with terms acceptance.',
        'tags': ['signup', 'register', 'form', 'grid'],
    },
    'auth/forgot-password': {
        'title': 'Forgot Password',
        'description': 'Request a password reset email.',
        'tags': ['password', 'reset', 'form'],
    },
    'auth/two-factor': {
        'title': 'Two-Factor Authentication',
        'description': '6-digit code verification with resend.',
        'tags': ['2fa', 'otp', 'verification'],
    },
}


def ident(category: str, slug: str) -> str:
    """JS-identifier-safe variable name."""
    base = f"{category}_{slug}"
    return re.sub(r'[^A-Za-z0-9_$]', '_', base)


def slug_to_title(slug: str) -> str:
    return ' '.join(w.capitalize() for w in slug.split('-'))


def parse_extracted_meta() -> dict:
    """Read /tmp/all-entries.txt produced by extract-mdx-demos.mjs and return
    a map of id -> {title, description}. Best-effort; missing entries fall back
    to slug-derived titles."""
    out: dict[str, dict] = {}
    if not ENTRIES_FILE.exists():
        return out
    txt = ENTRIES_FILE.read_text()
    pattern = re.compile(
        r"'([^']+)':\s*\{\s*id:\s*'[^']+',\s*meta:\s*\{\s*"
        r"title:\s*(\"[^\"]*\"|'[^']*'),\s*"
        r"description:\s*(\"[^\"]*\"|'[^']*'),\s*"
        r"category:\s*'[^']+'",
    )
    for m in pattern.finditer(txt):
        out[m.group(1)] = {
            'title': m.group(2)[1:-1],
            'description': m.group(3)[1:-1],
        }
    return out


def collect_examples() -> list[dict]:
    examples = []
    for category_dir in sorted(SCHEMAS.iterdir()):
        if not category_dir.is_dir():
            continue
        category = category_dir.name
        for json_file in sorted(category_dir.glob('*.json')):
            slug = json_file.stem
            examples.append({'category': category, 'slug': slug, 'id': f'{category}/{slug}'})
    return examples


def main():
    extracted = parse_extracted_meta()
    examples = collect_examples()

    lines = []
    lines.append("import type { Example, ExampleMeta } from './types.js';")
    lines.append("")

    for e in examples:
        var = ident(e['category'], e['slug'])
        lines.append(
            f"import {var} from './schemas/{e['category']}/{e['slug']}.json' with {{ type: 'json' }};",
        )

    lines.append("")
    lines.append("export type { Example, ExampleMeta } from './types.js';")
    lines.append("")
    lines.append("/**")
    lines.append(" * Registry of all examples shipped by ObjectUI.")
    lines.append(" *")
    lines.append(" * Keys are stable IDs of the shape `<category>/<slug>` and are used by:")
    lines.append(" *   - The docs site's <SchemaExample id=\"...\" /> MDX component")
    lines.append(" *   - The smoke test that mounts every example")
    lines.append(" *   - AI agents performing few-shot retrieval")
    lines.append(" *")
    lines.append(" * To add an example: drop a JSON file under src/schemas/<cat>/<slug>.json,")
    lines.append(" * then re-run `python3 scripts/regenerate-catalog-index.py`.")
    lines.append(" */")
    lines.append("const REGISTRY: Record<string, Example> = {")

    for e in examples:
        var = ident(e['category'], e['slug'])
        meta = HANDCRAFTED.get(e['id'], {})
        title = meta.get('title') or extracted.get(e['id'], {}).get('title') or slug_to_title(e['slug'])
        desc = meta.get('description', '')
        if not desc:
            desc = extracted.get(e['id'], {}).get('description', '')
        lines.append(f"  '{e['id']}': {{")
        lines.append(f"    id: '{e['id']}',")
        lines.append("    meta: {")
        lines.append(f"      title: {json.dumps(title)},")
        lines.append(f"      description: {json.dumps(desc)},")
        lines.append(f"      category: '{e['category']}',")
        if 'tags' in meta:
            lines.append(f"      tags: {json.dumps(meta['tags'])},")
        lines.append("    },")
        lines.append(f"    schema: {var},")
        lines.append("  },")

    lines.append("};")
    lines.append("")
    lines.append("/** Look up an example by id. Throws if the id is unknown. */")
    lines.append("export function getExample(id: string): Example {")
    lines.append("  const entry = REGISTRY[id];")
    lines.append("  if (!entry) {")
    lines.append("    throw new Error(")
    lines.append("      `Unknown example id: \"${id}\". Known ids: ${Object.keys(REGISTRY).join(', ')}`,")
    lines.append("    );")
    lines.append("  }")
    lines.append("  return entry;")
    lines.append("}")
    lines.append("")
    lines.append("/** Returns all examples in registry order. */")
    lines.append("export function allExamples(): Example[] {")
    lines.append("  return Object.values(REGISTRY);")
    lines.append("}")
    lines.append("")
    lines.append("/** Returns examples filtered by category. */")
    lines.append("export function examplesByCategory(category: string): Example[] {")
    lines.append("  return allExamples().filter((e) => e.meta.category === category);")
    lines.append("}")
    lines.append("")
    lines.append("/** Convenience: list all known ids (for debugging / tooling). */")
    lines.append("export function allExampleIds(): string[] {")
    lines.append("  return Object.keys(REGISTRY);")
    lines.append("}")

    OUT.write_text("\n".join(lines) + "\n")
    print(f"Wrote {OUT.relative_to(ROOT)} with {len(examples)} entries.")


if __name__ == '__main__':
    main()

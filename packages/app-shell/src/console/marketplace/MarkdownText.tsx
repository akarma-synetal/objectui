/**
 * Tiny CommonMark-subset renderer for marketplace READMEs.
 *
 * Covers what app authors actually write in their README field:
 *   • `#`, `##`, `###` headings
 *   • Blank-line-separated paragraphs
 *   • `- ` / `* ` bulleted lists (single level)
 *   • `1. ` numbered lists (single level)
 *   • `**bold**`, `*italic*`, `` `code` ``, `[text](url)` inline
 *   • Triple-backtick fenced code blocks
 *
 * Deliberately NOT a full Markdown engine — we want zero new deps and
 * predictable output. If a README really needs tables or images, the
 * publisher can host their own docs and link via `homepage_url`.
 */

import { Fragment } from 'react';

interface Block {
  type: 'h1' | 'h2' | 'h3' | 'p' | 'ul' | 'ol' | 'code';
  text?: string;
  items?: string[];
  lang?: string;
}

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      i++;
      const buf: string[] = [];
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i++;
      }
      i++; // closing fence
      blocks.push({ type: 'code', text: buf.join('\n'), lang });
      continue;
    }

    // Headings
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      blocks.push({ type: (`h${level}` as 'h1' | 'h2' | 'h3'), text: h[2].trim() });
      i++;
      continue;
    }

    // Bullet list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ul', items });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''));
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Blank line → flush
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph (collect until blank / heading / list)
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,3}\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !lines[i].startsWith('```')
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'p', text: buf.join(' ') });
  }
  return blocks;
}

// Inline pass: **bold**, *italic*, `code`, [text](url). Order matters
// so we tokenize once and replace by position.
function renderInline(input: string): React.ReactNode {
  const out: React.ReactNode[] = [];
  let remaining = input;
  let key = 0;
  const patterns: { re: RegExp; render: (m: RegExpExecArray) => React.ReactNode }[] = [
    { re: /`([^`]+)`/, render: (m) => <code key={`k${key++}`} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{m[1]}</code> },
    { re: /\*\*([^*]+)\*\*/, render: (m) => <strong key={`k${key++}`} className="font-semibold text-foreground">{m[1]}</strong> },
    { re: /\*([^*]+)\*/, render: (m) => <em key={`k${key++}`}>{m[1]}</em> },
    { re: /\[([^\]]+)\]\(([^)]+)\)/, render: (m) => (
      <a key={`k${key++}`} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-violet-600 underline-offset-2 hover:underline dark:text-violet-400">{m[1]}</a>
    ) },
  ];

  while (remaining) {
    let bestIdx = -1;
    let bestMatch: RegExpExecArray | null = null;
    let bestPattern: typeof patterns[number] | null = null;
    for (const p of patterns) {
      const m = p.re.exec(remaining);
      if (m && (bestIdx === -1 || m.index < bestIdx)) {
        bestIdx = m.index;
        bestMatch = m;
        bestPattern = p;
      }
    }
    if (!bestMatch || !bestPattern) {
      out.push(remaining);
      break;
    }
    if (bestIdx > 0) out.push(remaining.slice(0, bestIdx));
    out.push(bestPattern.render(bestMatch));
    remaining = remaining.slice(bestIdx + bestMatch[0].length);
  }
  return <>{out.map((n, i) => <Fragment key={i}>{n}</Fragment>)}</>;
}

export function MarkdownText({ source, className }: { source: string; className?: string }) {
  const blocks = parseBlocks(source);
  return (
    <div className={`flex flex-col gap-4 text-sm leading-relaxed text-foreground/90 ${className ?? ''}`}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'h1':
            return <h2 key={i} className="mt-2 text-xl font-bold tracking-tight">{renderInline(b.text ?? '')}</h2>;
          case 'h2':
            return <h3 key={i} className="mt-3 text-base font-semibold tracking-tight">{renderInline(b.text ?? '')}</h3>;
          case 'h3':
            return <h4 key={i} className="mt-2 text-sm font-semibold tracking-tight text-foreground/80">{renderInline(b.text ?? '')}</h4>;
          case 'p':
            return <p key={i}>{renderInline(b.text ?? '')}</p>;
          case 'ul':
            return (
              <ul key={i} className="ml-1 flex list-none flex-col gap-1.5">
                {(b.items ?? []).map((it, j) => (
                  <li key={j} className="flex gap-2">
                    <span aria-hidden="true" className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500/70" />
                    <span>{renderInline(it)}</span>
                  </li>
                ))}
              </ul>
            );
          case 'ol':
            return (
              <ol key={i} className="ml-5 flex list-decimal flex-col gap-1.5 marker:text-muted-foreground">
                {(b.items ?? []).map((it, j) => (
                  <li key={j} className="pl-1">{renderInline(it)}</li>
                ))}
              </ol>
            );
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-lg border bg-muted/40 p-3 text-xs leading-relaxed">
                <code className="font-mono">{b.text}</code>
              </pre>
            );
        }
        return null;
      })}
    </div>
  );
}

/**
 * Smoke tests for the @object-ui/cli bin.
 *
 * These tests invoke the built `dist/cli.js` as a child process to verify
 * that the public CLI surface (commands, flags, exit codes) matches what
 * is documented in the README and content/docs/utilities/cli.mdx.
 *
 * If you change a flag or command name, update both this test file AND the
 * docs in the same PR (Rule #2: Documentation Driven Development).
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_BIN = resolve(__dirname, '../../dist/cli.js');
const PKG_PATH = resolve(__dirname, '../../package.json');

const SUBCOMMANDS = [
  'serve',
  'dev',
  'build',
  'start',
  'init',
  'lint',
  'test',
  'generate',
  'doctor',
  'add',
  'studio',
  'check',
  'validate',
  'create',
  'analyze',
] as const;

function run(args: string[], opts: { cwd?: string } = {}) {
  const res = spawnSync('node', [CLI_BIN, ...args], {
    cwd: opts.cwd ?? process.cwd(),
    encoding: 'utf-8',
  });
  return {
    code: res.status ?? -1,
    stdout: res.stdout ?? '',
    stderr: res.stderr ?? '',
  };
}

describe('@object-ui/cli bin', () => {
  beforeAll(() => {
    if (!existsSync(CLI_BIN)) {
      throw new Error(
        `dist/cli.js not found. Run "pnpm --filter @object-ui/cli build" first.\n` +
          `Looked at: ${CLI_BIN}`,
      );
    }
  });

  describe('package metadata', () => {
    it('package.json declares the standalone @object-ui/cli identity', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      expect(pkg.name).toBe('@object-ui/cli');
      expect(pkg.bin).toEqual({ objectui: './dist/cli.js' });
      expect(pkg.oclif).toBeUndefined();
      expect(pkg.dependencies?.['@oclif/core']).toBeUndefined();
    });
  });

  describe('--version', () => {
    it('matches the version in package.json', () => {
      const pkg = JSON.parse(readFileSync(PKG_PATH, 'utf-8'));
      const res = run(['--version']);
      expect(res.code).toBe(0);
      expect(res.stdout.trim()).toBe(pkg.version);
    });
  });

  describe('--help', () => {
    it('lists all 15 documented commands', () => {
      const res = run(['--help']);
      expect(res.code).toBe(0);
      const out = res.stdout;
      for (const cmd of SUBCOMMANDS) {
        expect(out, `command "${cmd}" should appear in --help output`).toContain(cmd);
      }
    });

    it('uses the "objectui" bin name (not "os ui")', () => {
      const res = run(['--help']);
      expect(res.stdout).toMatch(/Usage:\s+objectui/);
      expect(res.stdout).not.toContain('os ui');
    });
  });

  describe.each(SUBCOMMANDS)('subcommand "%s"', (cmd) => {
    it('exits 0 on --help', () => {
      const res = run([cmd, '--help']);
      expect(res.code, res.stderr || res.stdout).toBe(0);
      expect(res.stdout).toContain(`objectui ${cmd}`);
    });
  });

  describe('flag contracts (locked-in by docs)', () => {
    const cases: Array<[string, RegExp[]]> = [
      ['dev',      [/-p, --port <port>/, /-h, --host <host>/, /--no-open/]],
      ['serve',    [/-p, --port <port>/, /-h, --host <host>/]],
      ['build',    [/-o, --out-dir <dir>/, /--clean/]],
      ['start',    [/-p, --port <port>/, /-h, --host <host>/, /-d, --dir <dir>/]],
      ['init',     [/-t, --template <template>/]],
      ['lint',     [/--fix/]],
      ['test',     [/-w, --watch/, /-c, --coverage/, /--ui/]],
      ['generate', [/--from <source>/, /--output <dir>/]],
      ['analyze',  [/--bundle-size/, /--render-performance/]],
      ['validate', [/\[schema\]/]],
    ];
    it.each(cases)('%s exposes the documented flags', (cmd, patterns) => {
      const res = run([cmd, '--help']);
      expect(res.code).toBe(0);
      for (const re of patterns) {
        expect(res.stdout).toMatch(re);
      }
    });
  });

  describe('validate', () => {
    let work: string;
    beforeAll(() => {
      work = mkdtempSync(join(tmpdir(), 'objectui-cli-validate-'));
      writeFileSync(
        join(work, 'good.json'),
        JSON.stringify({
          type: 'div',
          className: 'p-4',
          body: { type: 'text', content: 'ok' },
        }),
      );
      writeFileSync(join(work, 'bad.json'), JSON.stringify({ no_type_field: true }));
    });

    it('exits 0 for a valid schema', () => {
      const res = run(['validate', 'good.json'], { cwd: work });
      expect(res.code, res.stdout + res.stderr).toBe(0);
      expect(res.stdout).toMatch(/Schema is valid/i);
    });

    it('exits non-zero for an invalid schema', () => {
      const res = run(['validate', 'bad.json'], { cwd: work });
      expect(res.code).not.toBe(0);
    });

    it('exits non-zero when the file is missing', () => {
      const res = run(['validate', 'does-not-exist.json'], { cwd: work });
      expect(res.code).not.toBe(0);
      expect(res.stdout + res.stderr).toMatch(/not found/i);
    });
  });

  describe('init', () => {
    let work: string;
    beforeAll(() => {
      work = mkdtempSync(join(tmpdir(), 'objectui-cli-init-'));
    });

    it('scaffolds a project with the simple template', () => {
      const res = run(['init', 'sample-app', '-t', 'simple'], { cwd: work });
      expect(res.code, res.stdout + res.stderr).toBe(0);
      const appDir = join(work, 'sample-app');
      for (const f of [
        'app.json',
        'package.json',
        'index.html',
        'vite.config.ts',
        'tsconfig.json',
        'src/App.tsx',
        'src/main.tsx',
        'src/index.css',
      ]) {
        expect(existsSync(join(appDir, f)), `expected ${f} to exist`).toBe(true);
      }
      const schema = JSON.parse(readFileSync(join(appDir, 'app.json'), 'utf-8'));
      expect(schema).toHaveProperty('type');
    });
  });
});

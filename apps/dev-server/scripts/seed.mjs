#!/usr/bin/env node
/**
 * Dev-server fixture seeder.
 *
 * Logs in as a previously-created user (via /_account/setup) and inserts
 * a handful of Customer / Order / Task rows so the console has data to
 * render after a fresh boot.
 *
 * Usage:
 *   pnpm --filter @object-ui/dev-server seed
 *
 * Environment overrides:
 *   OS_API_URL      Base URL of the dev backend (default: http://localhost:3000)
 *   SEED_EMAIL      Account email      (default: dev@example.com)
 *   SEED_PASSWORD   Account password   (default: Password1!)
 *
 * Prerequisites:
 *   1. `pnpm dev:full` is running.
 *   2. You have visited http://localhost:5180/_account/setup and created
 *      an owner account whose email/password match SEED_EMAIL / SEED_PASSWORD
 *      (or set the env vars to match the account you actually created).
 *
 * This script is deliberately fetch-based (no @objectstack/client) so it
 * has zero compile step and works against any locally running backend.
 */

const API = process.env.OS_API_URL || 'http://localhost:3000';
const EMAIL = process.env.SEED_EMAIL || 'dev@example.com';
const PASSWORD = process.env.SEED_PASSWORD || 'Password1!';

const COOKIE_JAR = new Map();

function captureCookies(res) {
  const list = typeof res.headers.getSetCookie === 'function'
    ? res.headers.getSetCookie()
    : [res.headers.get('set-cookie')].filter(Boolean);
  for (const raw of list) {
    const [pair] = raw.split(';');
    const eq = pair.indexOf('=');
    if (eq > 0) COOKIE_JAR.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
}

function cookieHeader() {
  return [...COOKIE_JAR.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
}

async function jsonFetch(path, init = {}) {
  const headers = {
    'content-type': 'application/json',
    // better-auth requires an Origin header that matches the server's
    // trusted-origins list (OS_TRUSTED_ORIGINS in the dev-server config).
    origin: API,
    ...(init.headers || {}),
  };
  const cookie = cookieHeader();
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${API}${path}`, { ...init, headers });
  captureCookies(res);
  const text = await res.text();
  const body = text ? (() => { try { return JSON.parse(text); } catch { return text; } })() : null;
  if (!res.ok) {
    throw new Error(`${init.method || 'GET'} ${path} -> ${res.status}\n${text}`);
  }
  return body;
}

async function login() {
  console.log(`-> Logging in ${EMAIL} @ ${API}`);
  try {
    await jsonFetch('/api/v1/auth/sign-in/email', {
      method: 'POST',
      body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
    });
  } catch (err) {
    console.error('\nx Login failed. Make sure you have:');
    console.error('  1. Started the dev server: pnpm dev:full');
    console.error('  2. Created an owner account at http://localhost:5180/_account/setup');
    console.error(`  3. Used credentials matching SEED_EMAIL=${EMAIL} / SEED_PASSWORD=***`);
    throw err;
  }
  console.log('  ok: session cookie captured');
}

async function createMany(object, rows) {
  let ok = 0;
  for (const row of rows) {
    try {
      await jsonFetch(`/api/v1/data/${object}`, {
        method: 'POST',
        body: JSON.stringify(row),
      });
      ok += 1;
    } catch (err) {
      console.warn(`  ! skip ${object}:`, err.message.split('\n')[0]);
    }
  }
  console.log(`  ok: ${object}: inserted ${ok}/${rows.length}`);
}

const customers = [
  { name: 'Acme Industries',   email: 'ops@acme.test',      phone: '+1-555-0100', tier: 'enterprise', active: true,  notes: 'Quarterly review every Q1.' },
  { name: 'Bluefin Labs',      email: 'hello@bluefin.test', phone: '+1-555-0110', tier: 'pro',        active: true,  notes: 'Migrated from spreadsheets.' },
  { name: 'Cedar & Co',        email: 'finance@cedar.test', phone: '+1-555-0120', tier: 'pro',        active: true,  notes: '' },
  { name: 'Driftwood Studios', email: 'studio@drift.test',  phone: '+1-555-0130', tier: 'free',       active: false, notes: 'Paused account, evaluate Q3.' },
];

const orders = [
  { code: 'ORD-1001', customer_name: 'Acme Industries',   amount: 4250.00, status: 'paid',      placed_at: '2026-04-12T10:30:00.000Z' },
  { code: 'ORD-1002', customer_name: 'Bluefin Labs',      amount: 980.50,  status: 'submitted', placed_at: '2026-05-01T14:05:00.000Z' },
  { code: 'ORD-1003', customer_name: 'Cedar & Co',        amount: 1750.00, status: 'paid',      placed_at: '2026-05-10T09:15:00.000Z' },
  { code: 'ORD-1004', customer_name: 'Acme Industries',   amount: 320.00,  status: 'refunded',  placed_at: '2026-05-15T16:42:00.000Z' },
  { code: 'ORD-1005', customer_name: 'Driftwood Studios', amount: 90.00,   status: 'draft',     placed_at: '2026-05-20T08:00:00.000Z' },
];

const tasks = [
  { title: 'Onboard Acme Q3 contacts',      description: 'Import contact CSV and assign account manager.', priority: 'high',   status: 'in_progress', due_date: '2026-06-01', completed: false },
  { title: 'Review Bluefin renewal terms',  description: 'Renewal due July 15.',                          priority: 'medium', status: 'todo',        due_date: '2026-06-10', completed: false },
  { title: 'Refund follow-up for ORD-1004', description: 'Confirm refund hit customer card.',             priority: 'urgent', status: 'todo',        due_date: '2026-05-28', completed: false },
  { title: 'Quarterly newsletter',          description: 'Draft May edition with three case studies.',    priority: 'low',    status: 'done',        due_date: '2026-05-15', completed: true  },
];

async function main() {
  await login();
  console.log('-> Seeding fixtures');
  await createMany('customer', customers);
  await createMany('order',    orders);
  await createMany('task',     tasks);
  console.log('\nok: Seed complete. Open http://localhost:5180/home and select the Dev Sandbox app.');
}

main().catch((err) => {
  console.error('\nx Seed aborted:', err.message);
  process.exit(1);
});

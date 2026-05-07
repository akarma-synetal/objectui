/**
 * ObjectUI
 * Copyright (c) 2024-present ObjectStack Inc.
 *
 * Smoke / regression test: every published `@object-ui/plugin-*` MUST share
 * the single `ComponentRegistry` singleton exported from `@object-ui/core`.
 *
 * If a plugin's bundle accidentally inlines `@object-ui/core`, it ends up with
 * its own private `ComponentRegistry` — components registered by that plugin
 * become invisible to other plugins, and downstream apps see `undefined`
 * lookups across plugin boundaries.
 *
 * This test imports the **built dist** of two representative plugins via
 * explicit relative paths (bypassing vitest's source aliases) and asserts
 * that the components they register are visible on the same singleton.
 */

import path from 'node:path';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ComponentRegistry } from '../Registry.js';

const PLUGIN_GRID_DIST = path.resolve(
  __dirname,
  '../../../../plugin-grid/dist/index.js',
);
const PLUGIN_LIST_DIST = path.resolve(
  __dirname,
  '../../../../plugin-list/dist/index.js',
);

const distAvailable =
  existsSync(PLUGIN_GRID_DIST) && existsSync(PLUGIN_LIST_DIST);

describe.skipIf(!distAvailable)(
  'ComponentRegistry singleton across plugin dist bundles',
  () => {
    const baselineSize = ComponentRegistry.getAllConfigs().length;

    beforeAll(async () => {
      // Import via file URL so Node treats them as ESM modules and the
      // workspace aliases (which only apply to bare specifiers) are bypassed.
      await import(pathToFileURL(PLUGIN_GRID_DIST).href);
      await import(pathToFileURL(PLUGIN_LIST_DIST).href);
    });

    afterAll(() => {
      // Best-effort cleanup: drop registry entries the plugins added so this
      // test doesn't pollute other tests in the same vitest worker.
      const components = (ComponentRegistry as unknown as {
        components: Map<string, unknown>;
      }).components;
      for (const key of [
        'plugin-grid:object-grid',
        'object-grid',
        'view:grid',
        'plugin-grid:import-wizard',
        'import-wizard',
        'plugin-list:list-view',
        'list-view',
        'view:list',
      ]) {
        components.delete(key);
      }
    });

    it('plugin-grid registers object-grid into the shared singleton', () => {
      const cfg =
        ComponentRegistry.getConfig('plugin-grid:object-grid') ??
        ComponentRegistry.getConfig('object-grid');
      expect(cfg).toBeDefined();
      expect(cfg?.component).toBeTruthy();
    });

    it('plugin-list registers list-view into the shared singleton', () => {
      const cfg =
        ComponentRegistry.getConfig('plugin-list:list-view') ??
        ComponentRegistry.getConfig('list-view');
      expect(cfg).toBeDefined();
      expect(cfg?.component).toBeTruthy();
    });

    it('plugin-list can resolve a component registered by plugin-grid', () => {
      // Cross-plugin lookup — the actual bug scenario reported downstream.
      const fromList =
        ComponentRegistry.get('plugin-grid:object-grid') ??
        ComponentRegistry.get('object-grid');
      expect(fromList).toBeDefined();
    });

    it('importing both plugins increases registry size on the singleton', () => {
      expect(ComponentRegistry.getAllConfigs().length).toBeGreaterThan(
        baselineSize,
      );
    });
  },
);

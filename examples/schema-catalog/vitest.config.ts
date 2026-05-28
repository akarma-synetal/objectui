import { defineConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.mts';

// Inherit aliases/env from the root config, but build a *fresh* test config
// without the `projects` array — that array references the root file by a
// relative path that breaks when vitest is invoked from this package's cwd
// (`pnpm -F ... test`). Tests in this folder are also discovered by the root
// project, so running from the monorepo root works either way.
const { projects: _omit, ...rootTest } = rootConfig.test ?? {};

export default defineConfig({
  ...rootConfig,
  test: rootTest,
});

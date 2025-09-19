import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

import { createPackagePatch } from '../packagePatchFactory';

async function withTempPackage(packageJson: any, fn: (pkgPath: string) => Promise<void>) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pkg-patch-'));
  const pkgPath = path.join(dir, 'package.json');
  await fs.writeFile(pkgPath, JSON.stringify(packageJson, null, 2), 'utf8');
  try {
    await fn(pkgPath);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
}

test('createPackagePatch returns new dependencies when not present', async () => {
  await withTempPackage({ dependencies: { react: '^18.0.0' } }, async (pkgPath) => {
    const result = await createPackagePatch([
      { name: 'clsx', version: '^2.0.0' },
    ], [], { existingPackageJsonPath: pkgPath });

    assert.equal(result.addDependencies.length, 1);
    assert.equal(result.addDependencies[0].name, 'clsx');
    assert.equal(result.existingConflicts.length, 0);
  });
});

test('createPackagePatch detects satisfied range and warns', async () => {
  const pkg = { dependencies: { clsx: '^2.0.0' } };
  await withTempPackage(pkg, async (pkgPath) => {
    const result = await createPackagePatch([
      { name: 'clsx', version: '^2.0.0' },
    ], [], { existingPackageJsonPath: pkgPath });

    assert.equal(result.addDependencies.length, 0);
    assert.equal(result.existingConflicts.length, 0);
    assert.ok(result.warnings.find((msg) => msg.includes('clsx')));
  });
});

test('createPackagePatch reports conflicts for mismatched range', async () => {
  const pkg = { dependencies: { clsx: '^1.1.0' } };
  await withTempPackage(pkg, async (pkgPath) => {
    const result = await createPackagePatch([
      { name: 'clsx', version: '^2.0.0' },
    ], [], { existingPackageJsonPath: pkgPath });

    assert.equal(result.addDependencies.length, 0);
    assert.equal(result.existingConflicts.length, 1);
    assert.equal(result.existingConflicts[0].name, 'clsx');
  });
});

test('createPackagePatch deduplicates style entries', async () => {
  const styles = [
    { path: 'tailwind/plugin.css', content: '.btn { @apply px-4 }' },
    { path: 'tailwind/plugin.css', content: '.btn { @apply px-4 }' },
  ];
  const result = await createPackagePatch([], styles);
  assert.equal(result.stylePatch.length, 1);
});

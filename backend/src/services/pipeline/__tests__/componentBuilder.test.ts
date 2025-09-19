import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';

import { buildComponent } from '../componentBuilder';
import type { ParsedPrompt } from '@/shared/types';

test('buildComponent writes component, demo, styles and assets', async () => {
  const parsed: ParsedPrompt = {
    name: 'Hero Banner',
    component: {
      code: "export const HeroBanner = () => <section>Hero</section>;\n",
    },
    demo: {
      code: "import { HeroBanner } from './hero-banner';\nexport default function Demo() {\n  return <HeroBanner />;\n}\n",
    },
    dependencies: [
      {
        filename: 'utils.ts',
        content: 'export const noop = () => {};\n',
      },
    ],
    styles: [
      {
        filename: 'hero-banner.css',
        content: '.hero { color: red; }',
      },
    ],
    assets: [
      {
        filename: 'images/hero.png',
        content: Buffer.from('image-bytes').toString('base64'),
        encoding: 'base64',
      },
    ],
    npmPackages: [
      { name: 'clsx' },
    ],
  };

  const result = await buildComponent(parsed);

  assert.equal(result.slug, 'hero-banner');
  assert.ok(result.componentFile.endsWith('.tsx'));
  assert.ok(result.demoFile && result.demoFile.endsWith('.tsx'));
  assert.equal(result.styleFiles.length, 1);
  assert.equal(result.assetFiles.length, 1);
  assert.equal(result.dependencyFiles.length, 1);
  assert.equal(result.npmPackages[0].name, 'clsx');
  assert.equal(result.styleEntries.length, 1);

  const componentPath = path.join(result.outDir, result.componentFile);
  const componentSource = await fs.readFile(componentPath, 'utf8');
  assert.match(componentSource, /HeroBanner/);

  const assetPath = path.join(result.outDir, result.assetFiles[0]);
  const assetBuffer = await fs.readFile(assetPath);
  assert.equal(assetBuffer.toString(), 'image-bytes');

  const manifestKinds = new Set(result.manifest.map((item) => item.kind));
  assert.ok(manifestKinds.has('component'));
  assert.ok(manifestKinds.has('demo'));
  assert.ok(manifestKinds.has('dependency'));
  assert.ok(manifestKinds.has('style'));
  assert.ok(manifestKinds.has('asset'));
});

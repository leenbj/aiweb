import { test } from 'node:test';
import assert from 'node:assert/strict';
import AdmZip from 'adm-zip';

import { runPipelineFromPrompt } from '../pipelineOrchestrator';
import type { ParsedPrompt } from '@/shared/types';

test('runPipelineFromPrompt produces zip with schema and preview', async () => {
  const parsed: ParsedPrompt = {
    name: 'Feature Grid',
    component: { code: '<section class="grid">Features</section>' },
    demo: { code: '<FeatureGrid />' },
    styles: [{ filename: 'feature-grid.css', content: '.grid { display: grid; }' }],
    npmPackages: [{ name: 'clsx', version: '^2.0.0' }],
    notes: ['@field title: string = "Our Features"'],
  };

  const result = await runPipelineFromPrompt(parsed, {
    userId: 'u_test',
    autoImport: false,
  });

  const zip = new AdmZip(result.zipBuffer);
  const entries = zip.getEntries().map((e) => e.entryName);
  assert.ok(entries.includes('schema.json'));
  assert.ok(entries.includes('defaults.json'));
  assert.ok(entries.includes('preview.html'));
  assert.ok(entries.find((name) => name.endsWith('.tsx')));

  assert.equal(result.packagePatch.addDependencies.length, 1);
  assert.equal(result.packagePatch.addDependencies[0].name, 'clsx');
});

test('runPipelineFromPrompt invokes importer when autoImport true', async () => {
  const parsed: ParsedPrompt = {
    name: 'Stats Card',
    component: { code: '<div>Stats</div>' },
  };

  let importerCalled = false;
  const importer = async (zip: Buffer, userId: string) => {
    importerCalled = true;
    return { ok: true, length: zip.length, userId };
  };

  const result = await runPipelineFromPrompt(parsed, {
    userId: 'u_demo',
    autoImport: true,
    importer,
  });

  assert.ok(importerCalled);
  assert.deepEqual(result.importResult, { ok: true, length: result.zipBuffer.length, userId: 'u_demo' });
});

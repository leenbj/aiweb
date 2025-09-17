import path from 'path';
import os from 'os';
import fs from 'fs/promises';
import { strict as assert } from 'node:assert';

async function main() {
  const uploadsRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'zip-import-test-'));
  process.env.UPLOADS_ROOT = uploadsRoot;
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/testdb';
  }

  const { prisma } = await import('../database');
  const originalCreate = (prisma.template as any).create;
  const originalFindUnique = (prisma.template as any).findUnique;
  const createdTemplates: any[] = [];

  (prisma.template as any).create = async ({ data }: { data: any }) => {
    createdTemplates.push(data);
    return data;
  };
  (prisma.template as any).findUnique = async ({ where }: { where: { slug: string } }) => {
    return createdTemplates.find((tpl) => tpl.slug === where.slug) ?? null;
  };

  try {
    const { importZipToTemplates } = await import('../services/importer/zipImporter');

    const zipPath = path.resolve(__dirname, '../../project/sample-site.zip');
    const zipBuffer = await fs.readFile(zipPath);

    const result = await importZipToTemplates(zipBuffer, 'tester');

    assert.ok(result.importId.startsWith('imp_'), 'importId should follow imp_ prefix');
    assert.strictEqual(result.components.length, 0, 'static import should not return components');
    assert.strictEqual(result.pages.length, 1, 'sample ZIP should produce exactly one page');

    assert.strictEqual(createdTemplates.length, 1, 'template should be stored via prisma.create');
    const template = createdTemplates[0];
    assert.strictEqual(template.slug, result.pages[0], 'returned slug should match created template');
    assert.strictEqual(template.type, 'page', 'template type should be page');
    assert.strictEqual(template.name, '示例落地页', 'template name should use HTML title text');
    assert.match(template.code, /Open Lovable/, 'template code should contain imported HTML');
    assert.match(template.previewHtml, /示例落地页/, 'previewHtml should preserve original title');

    const assetsBase = `/uploads/u_tester/${result.importId}/`;
    assert.strictEqual(result.assetsBase, assetsBase, 'assetsBase should point to uploads directory for user');

    const assetPath = path.join(uploadsRoot, 'u_tester', result.importId, 'static', 'css', 'app.css');
    const assetContent = await fs.readFile(assetPath, 'utf8');
    assert.match(assetContent, /--color-primary/, 'CSS asset should be persisted to disk');

    console.log('zipImporter static import test passed', {
      importId: result.importId,
      pages: result.pages,
      assetsBase: result.assetsBase,
    });
  } finally {
    (prisma.template as any).create = originalCreate;
    (prisma.template as any).findUnique = originalFindUnique;
    await fs.rm(uploadsRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error('zipImporter static import test failed', error);
  process.exitCode = 1;
});

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  createTemplateSnapshot,
  listTemplateSnapshots,
  rollbackTemplateSnapshot,
  __testing as templateVersioningTesting,
} from '../templateVersioning';

interface TemplateRecord {
  id: string;
  slug: string;
  code: string;
  schemaJson?: Record<string, any> | null;
  previewHtml?: string | null;
  planSnapshot?: Record<string, any> | null;
  version?: string | null;
}

const baseTemplate: TemplateRecord = {
  id: 'tpl_1',
  slug: 'landing-page-basic',
  code: '<div>v1</div>',
  schemaJson: null,
  previewHtml: '<div>preview</div>',
  planSnapshot: null,
  version: '1.0.0',
};

let template: TemplateRecord;
let snapshots: any[];

const prismaStub: any = {
  template: {
    findFirst: async ({ where }: any) => {
      if (where?.OR) {
        if (where.OR.some((clause: any) => clause.id === template.id || clause.slug === template.slug)) {
          return template;
        }
      }
      if (where?.id === template.id || where?.slug === template.slug) return template;
      return null;
    },
    update: async ({ data }: any) => {
      template = { ...template, ...data };
      return template;
    },
  },
  templateSnapshot: {
    create: async ({ data }: any) => {
      const snapshot = {
        id: data.id || `snap_${snapshots.length + 1}`,
        ...data,
        createdAt: data.createdAt || new Date(),
      };
      snapshots.push(snapshot);
      return snapshot;
    },
    findMany: async ({ where, orderBy }: any) => {
      let results = snapshots.filter((snap) => snap.templateId === where.templateId);
      if (orderBy?.createdAt === 'desc') {
        results = results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      }
      return results;
    },
    findFirst: async ({ where }: any) => {
      return snapshots.find((snap) => snap.id === where.id && snap.templateId === where.templateId) || null;
    },
  },
};

beforeEach(() => {
  template = { ...baseTemplate };
  snapshots = [];
  templateVersioningTesting.setPrisma({
    ...prismaStub,
    $transaction: async (cb: any) => cb(prismaStub),
  });
});

afterEach(() => {
  templateVersioningTesting.resetPrisma();
});

test('createTemplateSnapshot stores plan and updates template preview', async () => {
  const snapshot = await createTemplateSnapshot('landing-page-basic', {
    plan: { page: { slug: 'landing-page-basic' } },
    html: '<html>v2</html>',
    css: 'body { color: red; }',
    js: 'console.log(1);',
    components: [{ slug: 'hero', html: '<section>hero</section>' }],
  }, { userId: 'user_1', requestId: 'req_1' });

  assert.equal(snapshot.templateId, template.id);
  assert.equal(template.previewHtml, '<html>v2</html>');
  assert.deepEqual(template.planSnapshot, { page: { slug: 'landing-page-basic' } });
  assert.equal(snapshots.length, 1);
});

test('listTemplateSnapshots returns most recent snapshots first', async () => {
  await createTemplateSnapshot(template.id, { plan: { a: 1 }, html: '<html>a</html>' }, {});
  await createTemplateSnapshot(template.id, { plan: { b: 2 }, html: '<html>b</html>' }, {});

  const list = await listTemplateSnapshots(template.id);
  assert.equal(list.length, 2);
  assert.equal(list[0].html, '<html>b</html>');
});

test('rollbackTemplateSnapshot restores template snapshot data', async () => {
  const snap = await createTemplateSnapshot(template.id, { plan: { foo: 'bar' }, html: '<html>snap</html>' }, {});
  template.previewHtml = '<html>modified</html>';
  template.planSnapshot = { foo: 'baz' } as any;

  const result = await rollbackTemplateSnapshot(template.id, snap.id, { userId: 'user_2' });

  assert.equal(result.template.previewHtml, '<html>snap</html>');
  assert.deepEqual(result.template.planSnapshot, { foo: 'bar' });
});

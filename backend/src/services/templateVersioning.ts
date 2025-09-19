import { logger } from '../utils/logger';

interface OperationOptions {
  requestId?: string;
  userId?: string;
  userName?: string;
}

interface SnapshotPayload {
  plan?: Record<string, any> | null;
  html?: string | null;
  css?: string | null;
  js?: string | null;
  components?: Array<{ slug: string; html: string }> | null;
  metadata?: Record<string, any> | null;
  versionId?: string | null;
}

let prismaClient: any = null;

function getPrisma() {
  if (!prismaClient) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    const { prisma } = require('../database');
    prismaClient = prisma;
  }
  return prismaClient;
}

interface SemverParts {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
}

function parseSemver(input: string): SemverParts | null {
  const version = String(input || '').trim();
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4],
  };
}

function compareSemver(a: string, b: string) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  if (pa.prerelease === pb.prerelease) return 0;
  if (!pa.prerelease) return 1;
  if (!pb.prerelease) return -1;
  return pa.prerelease.localeCompare(pb.prerelease);
}

async function resolveTemplate(client: any, identifier: string) {
  const tpl = await client.template.findFirst({
    where: { OR: [{ id: identifier }, { slug: identifier }] },
  });
  if (!tpl) {
    const err = new Error(`Template not found: ${identifier}`);
    (err as any).status = 404;
    throw err;
  }
  return tpl;
}

export async function createTemplateVersion(identifier: string, version: string, opts: OperationOptions = {}) {
  const { requestId } = opts;
  const parsed = parseSemver(version);
  if (!parsed) {
    const err = new Error('Invalid semver string');
    (err as any).status = 400;
    throw err;
  }

  const client = getPrisma();

  return client.$transaction(async (tx: any) => {
    const tpl = await resolveTemplate(tx, identifier);
    const existing = await tx.templateVersion.findUnique({
      where: { templateId_version: { templateId: tpl.id, version } },
    });
    if (existing) {
      const err = new Error('Version already exists');
      (err as any).status = 409;
      throw err;
    }

    const comparison = compareSemver(version, tpl.version || '0.0.0');
    if (comparison <= 0) {
      const err = new Error('Version must be greater than current');
      (err as any).status = 409;
      throw err;
    }

    const snapshot = await tx.templateVersion.create({
      data: {
        templateId: tpl.id,
        version,
        code: tpl.code,
        schemaJson: tpl.schemaJson as any,
      },
    });

    const updated = await tx.template.update({
      where: { id: tpl.id },
      data: { version },
    });

    logger.info('template.version.created', { requestId, templateId: tpl.id, version, userId: opts.userId });
    return { template: updated, snapshot };
  });
}

export async function rollbackTemplateVersion(identifier: string, targetVersion: string, opts: OperationOptions = {}) {
  const { requestId } = opts;
  const parsed = parseSemver(targetVersion);
  if (!parsed) {
    const err = new Error('Invalid semver string');
    (err as any).status = 400;
    throw err;
  }

  const client = getPrisma();

  return client.$transaction(async (tx: any) => {
    const tpl = await resolveTemplate(tx, identifier);
    const target = await tx.templateVersion.findUnique({
      where: { templateId_version: { templateId: tpl.id, version: targetVersion } },
    });
    if (!target) {
      const err = new Error(`Version not found: ${targetVersion}`);
      (err as any).status = 404;
      throw err;
    }

    if (tpl.version && tpl.version !== target.version) {
      const currentExists = await tx.templateVersion.findUnique({
        where: { templateId_version: { templateId: tpl.id, version: tpl.version } },
      });
      if (!currentExists) {
        await tx.templateVersion.create({
          data: {
            templateId: tpl.id,
            version: tpl.version,
            code: tpl.code,
            schemaJson: tpl.schemaJson as any,
          },
        });
      }
    }

    const updated = await tx.template.update({
      where: { id: tpl.id },
      data: {
        code: target.code,
        schemaJson: target.schemaJson as any,
        version: target.version,
      },
    });

    logger.info('template.version.rollback', { requestId, templateId: tpl.id, version: target.version, userId: opts.userId });
    return { template: updated };
  });
}

export async function createTemplateSnapshot(identifier: string, payload: SnapshotPayload, opts: OperationOptions = {}) {
  const client = getPrisma();
  const template = await resolveTemplate(client, identifier);

  const snapshot = await client.templateSnapshot.create({
    data: {
      templateId: template.id,
      versionId: payload.versionId || null,
      plan: payload.plan ?? null,
      html: payload.html ?? null,
      css: payload.css ?? null,
      js: payload.js ?? null,
      components: payload.components ? JSON.parse(JSON.stringify(payload.components)) : null,
      metadata: payload.metadata ?? null,
      createdBy: opts.userId ?? null,
      createdByName: opts.userName ?? null,
      requestId: opts.requestId ?? null,
    },
  });

  await client.template.update({
    where: { id: template.id },
    data: {
      planSnapshot: payload.plan ?? template.planSnapshot ?? null,
      previewHtml: payload.html ?? template.previewHtml ?? null,
    },
  });

  logger.info('template.snapshot.created', {
    templateId: template.id,
    snapshotId: snapshot.id,
    requestId: opts.requestId,
    userId: opts.userId,
  });

  return snapshot;
}

export async function listTemplateSnapshots(identifier: string) {
  const client = getPrisma();
  const template = await resolveTemplate(client, identifier);
  const snapshots = await client.templateSnapshot.findMany({
    where: { templateId: template.id },
    orderBy: { createdAt: 'desc' },
  });
  return snapshots;
}

export async function rollbackTemplateSnapshot(identifier: string, snapshotId: string, opts: OperationOptions = {}) {
  const client = getPrisma();
  const template = await resolveTemplate(client, identifier);

  const snapshot = await client.templateSnapshot.findFirst({
    where: { id: snapshotId, templateId: template.id },
  });

  if (!snapshot) {
    const err = new Error(`Snapshot not found: ${snapshotId}`);
    (err as any).status = 404;
    throw err;
  }

  const updated = await client.template.update({
    where: { id: template.id },
    data: {
      planSnapshot: snapshot.plan ?? template.planSnapshot ?? null,
      previewHtml: snapshot.html ?? template.previewHtml ?? null,
    },
  });

  logger.info('template.snapshot.rollback', {
    requestId: opts.requestId,
    templateId: template.id,
    snapshotId: snapshot.id,
    userId: opts.userId,
  });

  return { template: updated, snapshot };
}

export const __testing = {
  setPrisma(client: any) {
    prismaClient = client;
  },
  resetPrisma() {
    prismaClient = null;
  },
};

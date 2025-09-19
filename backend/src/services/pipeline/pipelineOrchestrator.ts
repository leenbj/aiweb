import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';

import type { ParsedPrompt } from '@/shared/types';
import { buildComponent } from './componentBuilder';
import { generateSchema } from './schemaGenerator';
import { buildPreview } from './previewBuilder';
import { createPackagePatch } from './packagePatchFactory';
import type { PackagePatchResult } from './packagePatchFactory';

export interface PipelineRunOptions {
  userId: string;
  requestId?: string;
  autoImport?: boolean;
  existingPackageJsonPath?: string;
  existingTailwindConfigPath?: string;
  importer?: (zipBuffer: Buffer, userId: string, opts?: { requestId?: string }) => Promise<any>;
}

export interface PipelineRunResult {
  slug: string;
  outDir: string;
  zipBuffer: Buffer;
  schemaPath: string;
  defaultsPath: string;
  previewPath: string;
  packagePatch: PackagePatchResult;
  importResult?: any;
  warnings: string[];
}

const SCHEMA_FILENAME = 'schema.json';
const DEFAULTS_FILENAME = 'defaults.json';

export async function runPipelineFromPrompt(parsedPrompt: ParsedPrompt, options: PipelineRunOptions): Promise<PipelineRunResult> {
  if (!options?.userId) throw new Error('userId required');

  const warnings: string[] = [];

  const component = await buildComponent(parsedPrompt);
  warnings.push(...component.warnings);

  const schemaResult = generateSchema(parsedPrompt);
  warnings.push(...schemaResult.warnings);
  const schemaPath = path.join(component.outDir, SCHEMA_FILENAME);
  const defaultsPath = path.join(component.outDir, DEFAULTS_FILENAME);
  await fs.writeFile(schemaPath, JSON.stringify(schemaResult.schema, null, 2), 'utf8');
  await fs.writeFile(defaultsPath, JSON.stringify(schemaResult.defaults, null, 2), 'utf8');

  const preview = await buildPreview({
    outDir: component.outDir,
    componentFile: component.componentFile,
    demoFile: component.demoFile,
    slug: component.slug,
  });
  warnings.push(...preview.warnings);

  const packagePatch = await createPackagePatch(
    component.npmPackages,
    component.styleEntries.map((entry) => ({ path: entry.filename || 'styles/generated.css', content: entry.content })),
    {
      existingPackageJsonPath: options.existingPackageJsonPath,
      existingTailwindConfigPath: options.existingTailwindConfigPath,
    },
  );
  warnings.push(...packagePatch.warnings);

  const zipBuffer = await zipDirectory(component.outDir);

  let importResult: any;
  if (options.autoImport) {
    const importer = options.importer;
    if (!importer) {
      throw new Error('Importer function is required for autoImport');
    }
    importResult = await importer(zipBuffer, options.userId, { requestId: options.requestId });
  }

  return {
    slug: component.slug,
    outDir: component.outDir,
    zipBuffer,
    schemaPath,
    defaultsPath,
    previewPath: preview.previewPath,
    packagePatch,
    importResult,
    warnings,
  };
}

async function zipDirectory(dir: string) {
  const zip = new AdmZip();
  const files = await collectFiles(dir);
  for (const file of files) {
    const content = await fs.readFile(file.absolute);
    const relative = path.relative(dir, file.absolute).replace(/\\/g, '/');
    zip.addFile(relative, content);
  }
  return zip.toBuffer();
}

async function collectFiles(dir: string) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const results: Array<{ absolute: string }> = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await collectFiles(absolute));
    } else {
      results.push({ absolute });
    }
  }
  return results;
}

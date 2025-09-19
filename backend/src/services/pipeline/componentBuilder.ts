import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';

import type { ParsedPrompt, ParsedPromptAsset, ParsedPromptDependency, ParsedPromptFile } from '@/shared/types';
import { ensureRelative } from '../../utils/file';

export interface ComponentBuildOptions {
  outDir?: string;
}

export interface ComponentFileArtifact {
  path: string;
  size: number;
  kind: 'component' | 'demo' | 'dependency' | 'style' | 'asset';
}

export interface ComponentBuildResult {
  outDir: string;
  slug: string;
  componentFile: string;
  demoFile?: string;
  dependencyFiles: string[];
  styleFiles: string[];
  assetFiles: string[];
  npmPackages: Array<{ name: string; version?: string }>;
  styleEntries: ParsedPromptFile[];
  manifest: ComponentFileArtifact[];
  warnings: string[];
}

const COMPONENT_DIR = 'components/ui';
const DEPENDENCY_DIR = 'components/deps';
const STYLE_DIR = 'styles';
const ASSET_DIR = 'public';

export async function buildComponent(parsed: ParsedPrompt, options: ComponentBuildOptions = {}): Promise<ComponentBuildResult> {
  if (!parsed?.component?.code) {
    throw new Error('Parsed prompt missing component code');
  }

  const outDir = options.outDir ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'prompt-component-')));
  const slug = parsed.slug || toKebabCase(parsed.name || 'component');
  const manifest: ComponentFileArtifact[] = [];
  const warnings: string[] = [];

  const componentFilename = parsed.component.filename ? sanitizeFilename(parsed.component.filename) : `${slug}.tsx`;
  const componentRelative = posixJoin(COMPONENT_DIR, componentFilename);
  await writeFile(outDir, componentRelative, parsed.component.code);
  manifest.push(await artifactFor(outDir, componentRelative, 'component'));

  let demoRelative: string | undefined;
  if (parsed.demo?.code) {
    const demoFilename = parsed.demo.filename ? sanitizeFilename(parsed.demo.filename) : `${slug}.demo.tsx`;
    demoRelative = posixJoin(COMPONENT_DIR, '__demos__', demoFilename);
    await writeFile(outDir, demoRelative, parsed.demo.code);
    manifest.push(await artifactFor(outDir, demoRelative, 'demo'));
  } else {
    warnings.push('Demo section missing in parsed prompt');
  }

  const dependencyFiles = await persistFiles(outDir, DEPENDENCY_DIR, parsed.dependencies ?? [], 'dependency', manifest);
  const styleFiles = await persistFiles(outDir, STYLE_DIR, parsed.styles ?? [], 'style', manifest);
  const assetFiles = await persistAssets(outDir, ASSET_DIR, parsed.assets ?? [], manifest);

  return {
    outDir,
    slug,
    componentFile: componentRelative,
    demoFile: demoRelative,
    dependencyFiles,
    styleFiles,
    assetFiles,
    npmPackages: parsed.npmPackages ?? [],
    styleEntries: parsed.styles ?? [],
    manifest,
    warnings,
  };
}

async function persistFiles(
  outDir: string,
  baseDir: string,
  files: ParsedPromptFile[] | ParsedPromptDependency[],
  kind: ComponentFileArtifact['kind'],
  manifest: ComponentFileArtifact[],
) {
  const written: string[] = [];
  for (const file of files) {
    if (!file?.content) continue;
    const filename = file.filename ? sanitizeFilename(file.filename) : `${contentHash(file.content)}.ts`; // deterministic fallback
    const relative = posixJoin(baseDir, filename);
    await writeFile(outDir, relative, file.content);
    manifest.push(await artifactFor(outDir, relative, kind));
    written.push(relative);
  }
  return written;
}

async function persistAssets(outDir: string, baseDir: string, assets: ParsedPromptAsset[], manifest: ComponentFileArtifact[]) {
  const written: string[] = [];
  for (const asset of assets) {
    if (!asset?.content || !asset.filename) continue;
    const filename = sanitizeFilename(asset.filename);
    const relative = posixJoin(baseDir, filename);
    const data = asset.encoding === 'base64' ? Buffer.from(asset.content, 'base64') : asset.content;
    await writeFile(outDir, relative, data);
    manifest.push(await artifactFor(outDir, relative, 'asset'));
    written.push(relative);
  }
  return written;
}

async function writeFile(outDir: string, relativePath: string, data: string | Buffer) {
  const safeRelative = ensureRelative(relativePath.replace(/\\/g, '/'));
  const absolute = path.join(outDir, safeRelative);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  await fs.writeFile(absolute, data);
}

async function artifactFor(outDir: string, relativePath: string, kind: ComponentFileArtifact['kind']): Promise<ComponentFileArtifact> {
  const absolute = path.join(outDir, relativePath);
  const stats = await fs.stat(absolute);
  return {
    path: relativePath,
    size: stats.size,
    kind,
  };
}

function toKebabCase(value: string) {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'component';
}

function sanitizeFilename(filename: string) {
  const base = filename.replace(/\\/g, '/').split('/').filter(Boolean).join('/');
  const safe = base.replace(/[^a-zA-Z0-9-_.\/]/g, '-');
  return ensureRelative(safe);
}

function posixJoin(...segments: string[]) {
  return segments
    .flatMap((segment) => segment.split(/[\\/]+/))
    .filter(Boolean)
    .join('/');
}

function contentHash(content: string) {
  return createHash('md5').update(content).digest('hex').slice(0, 8);
}

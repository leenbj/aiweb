import semver from 'semver';
import path from 'path';
import fs from 'fs/promises';
import { createHash } from 'crypto';

export interface PackagePatchOptions {
  existingPackageJsonPath?: string;
  existingTailwindConfigPath?: string;
}

export interface DependencyDescriptor {
  name: string;
  version?: string;
}

export interface StylePatchEntry {
  path: string;
  content: string;
}

export interface PackagePatchResult {
  addDependencies: DependencyDescriptor[];
  existingConflicts: DependencyDescriptor[];
  stylePatch: StylePatchEntry[];
  warnings: string[];
}

export async function createPackagePatch(
  incomingDependencies: DependencyDescriptor[],
  incomingStyles: StylePatchEntry[] = [],
  options: PackagePatchOptions = {},
): Promise<PackagePatchResult> {
  const existingDeps = await readExistingDependencies(options.existingPackageJsonPath);

  const addDependencies: DependencyDescriptor[] = [];
  const existingConflicts: DependencyDescriptor[] = [];
  const warnings: string[] = [];

  for (const dep of incomingDependencies) {
    if (!dep?.name) continue;
    const current = existingDeps.get(dep.name);
    if (!current) {
      addDependencies.push(dep);
      continue;
    }

    if (!dep.version || !current.version) {
      warnings.push(`Dependency ${dep.name} version comparison skipped`);
      continue;
    }

    if (isRangeSatisfied(current.version, dep.version)) {
      warnings.push(`Dependency ${dep.name}@${dep.version} already satisfied by ${current.version}`);
    } else {
      existingConflicts.push({ name: dep.name, version: current.version });
    }
  }

  const stylePatch = await dedupeStyles(incomingStyles, options.existingTailwindConfigPath);

  return {
    addDependencies,
    existingConflicts,
    stylePatch,
    warnings,
  };
}

interface PackageJsonSnapshot {
  version?: string;
}

async function readExistingDependencies(packageJsonPath?: string) {
  const map = new Map<string, PackageJsonSnapshot>();
  const resolvedPath = packageJsonPath ?? path.resolve(process.cwd(), 'package.json');
  try {
    const content = await fs.readFile(resolvedPath, 'utf8');
    const pkg = JSON.parse(content);
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } as Record<string, string>;
    for (const [name, version] of Object.entries(deps)) {
      map.set(name, { version });
    }
  } catch {
    // ignore if package.json cannot be read
  }
  return map;
}

function isRangeSatisfied(existingRange: string, requiredRange: string) {
  try {
    if (semver.validRange(existingRange) && semver.validRange(requiredRange)) {
      return semver.subset(requiredRange, existingRange);
    }
  } catch {
    // fall through to string compare
  }
  return existingRange === requiredRange;
}

async function dedupeStyles(styles: StylePatchEntry[], tailwindConfigPath?: string) {
  const seen = new Set<string>();
  const existing = await readTailwindConfig(tailwindConfigPath);
  const patch: StylePatchEntry[] = [];

  for (const style of styles) {
    if (!style?.content?.trim()) continue;
    const key = `${style.path}:${hashContent(style.content)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (existing.has(style.content.trim())) {
      continue;
    }

    patch.push(style);
  }

  return patch;
}

async function readTailwindConfig(configPath?: string) {
  const set = new Set<string>();
  if (!configPath) return set;
  const resolved = path.resolve(configPath);
  try {
    const content = await fs.readFile(resolved, 'utf8');
    set.add(content.trim());
  } catch {
    // ignore missing tailwind config
  }
  return set;
}

function hashContent(content: string) {
  return createHash('md5').update(content).digest('hex').slice(0, 8);
}

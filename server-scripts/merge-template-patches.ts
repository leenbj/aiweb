#!/usr/bin/env ts-node

import fs from 'fs/promises';
import path from 'path';

interface DependencyDescriptor {
  name: string;
  version?: string;
}

interface StylePatchEntry {
  path: string;
  content: string;
}

interface PackagePatchFile {
  addDependencies?: DependencyDescriptor[];
  existingConflicts?: DependencyDescriptor[];
  stylePatch?: StylePatchEntry[];
  warnings?: string[];
}

interface CliOptions {
  inputDir: string;
  targetDir: string;
  patchFile?: string;
  apply: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    inputDir: process.cwd(),
    targetDir: process.cwd(),
    apply: false,
    help: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case '--input':
      case '-i':
        options.inputDir = path.resolve(argv[index + 1] ?? '.');
        index += 1;
        break;
      case '--target':
      case '-t':
        options.targetDir = path.resolve(argv[index + 1] ?? '.');
        index += 1;
        break;
      case '--patch':
      case '-p':
        options.patchFile = argv[index + 1];
        index += 1;
        break;
      case '--apply':
      case '-a':
        options.apply = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        // ignore unknown args
        break;
    }
  }

  return options;
}

async function readPatchFile(filePath: string): Promise<PackagePatchFile> {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw) as PackagePatchFile;
}

async function applyDependencies(
  deps: DependencyDescriptor[],
  targetDir: string,
  dryRun: boolean,
): Promise<void> {
  if (!deps.length) return;
  const packageJsonPath = path.resolve(targetDir, 'package.json');
  const content = await fs.readFile(packageJsonPath, 'utf8');
  const pkg = JSON.parse(content) as Record<string, any>;
  const updated = { ...pkg.dependencies };

  const additions: DependencyDescriptor[] = [];
  for (const dep of deps) {
    if (!dep?.name) continue;
    if (updated[dep.name]) {
      continue;
    }
    additions.push(dep);
    updated[dep.name] = dep.version ?? 'latest';
  }

  if (!additions.length) {
    console.log('✔️  没有新的依赖需要合并（已存在或已满足版本范围）。');
    return;
  }

  for (const dep of additions) {
    if (dryRun) {
      console.log(`📝 [dry-run] 将添加依赖 ${dep.name}${dep.version ? `@${dep.version}` : ''}`);
    } else {
      console.log(`➕ 添加依赖 ${dep.name}${dep.version ? `@${dep.version}` : ''}`);
    }
  }

  if (!dryRun) {
    pkg.dependencies = Object.fromEntries(Object.entries(updated).sort(([a], [b]) => a.localeCompare(b)));
    await fs.writeFile(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
    console.log(`✅ package.json 已更新：${packageJsonPath}`);
  }
}

async function applyStylePatch(entries: StylePatchEntry[], targetDir: string, dryRun: boolean): Promise<void> {
  if (!entries.length) return;

  for (const entry of entries) {
    if (!entry?.path || !entry?.content) continue;
    const dest = path.resolve(targetDir, entry.path);
    if (dryRun) {
      console.log(`📝 [dry-run] 将写入样式片段 -> ${entry.path}`);
      continue;
    }

    await fs.mkdir(path.dirname(dest), { recursive: true });
    let existing = '';
    try {
      existing = await fs.readFile(dest, 'utf8');
    } catch {
      existing = '';
    }

    if (existing.includes(entry.content.trim())) {
      console.log(`⚠️  跳过 ${entry.path}：内容已存在`);
      continue;
    }

    const separator = existing && !existing.endsWith('\n') ? '\n' : '';
    const nextContent = `${existing}${separator}${entry.content.trim()}\n`;
    await fs.writeFile(dest, nextContent, 'utf8');
    console.log(`🎨 已更新样式文件 ${entry.path}`);
  }
}

function printWarnings(patch: PackagePatchFile): void {
  if (patch.warnings?.length) {
    console.log('\n⚠️  Warnings:');
    patch.warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  if (patch.existingConflicts?.length) {
    console.log('\n❗ 检测到版本冲突，需要手动处理:');
    patch.existingConflicts.forEach((conflict) => {
      console.log(`  - ${conflict.name} 当前版本 ${conflict.version ?? 'unknown'}`);
    });
  }
}

function showHelp(): void {
  console.log(`依赖合并 CLI\n\n用法：\n  ts-node server-scripts/merge-template-patches.ts --input <patch-dir> [--target <project-root>] [--apply]\n\n选项：\n  -i, --input    包含 package-patch.json 的目录，默认为当前目录\n  -t, --target   需要合并的项目根目录（包含 package.json），默认为当前目录\n  -p, --patch    自定义 patch 文件路径（默认 <input>/package-patch.json）\n  -a, --apply    执行写入操作；默认仅 dry-run 输出\n  -h, --help     查看帮助信息\n`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    showHelp();
    process.exit(0);
    return;
  }

  const patchPath = path.resolve(
    args.patchFile ? args.patchFile : path.join(args.inputDir, 'package-patch.json'),
  );

  try {
    const patch = await readPatchFile(patchPath);
    const dryRun = !args.apply;

    console.log(`📦  读取 patch 文件: ${patchPath}`);
    printWarnings(patch);

    await applyDependencies(patch.addDependencies ?? [], args.targetDir, dryRun);
    await applyStylePatch(patch.stylePatch ?? [], args.targetDir, dryRun);

    if (dryRun) {
      console.log('\n✨ dry-run 完成：未对目标项目做任何修改。使用 --apply 执行实际合并。');
    } else {
      console.log('\n✅ 合并完成。请审查变更并运行相关构建/测试。');
    }
  } catch (error) {
    console.error('❌ 合并失败：', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

void main();


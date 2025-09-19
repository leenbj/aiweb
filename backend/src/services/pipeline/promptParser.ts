import type { ParsedPrompt, ParsedPromptAsset, ParsedPromptDependency, ParsedPromptFile } from '@/shared/types';

export interface PromptParserWarning {
  section: string;
  message: string;
}

export interface PromptParserResult {
  prompt: ParsedPrompt;
  warnings: PromptParserWarning[];
}

type SectionKind =
  | 'component'
  | 'demo'
  | 'dependencies'
  | 'styles'
  | 'assets'
  | 'npm'
  | 'notes';

interface SectionEntry {
  kind: SectionKind;
  title: string;
  content: string;
}

interface FenceBlock {
  language?: string;
  attributes: Record<string, string>;
  code: string;
}

const SECTION_ALIASES: Record<SectionKind, string[]> = {
  component: ['component', '主组件', '组件', 'component source', 'main component'],
  demo: ['demo', '示例', '样例', 'demo 代码', 'demo code', '演示'],
  dependencies: ['dependencies', '依赖', '依赖文件', 'support files', 'supporting files'],
  styles: ['styles', 'style', 'css', '样式'],
  assets: ['assets', '资源', '静态资源', 'asset'],
  npm: ['npm', 'packages', 'npm packages', '依赖包', 'npm 依赖'],
  notes: ['notes', '实施指南', '指南', '说明', '备注', 'notes & guidance'],
};

export function parsePrompt(rawText: string): PromptParserResult {
  if (!rawText || !rawText.trim()) {
    throw new Error('Prompt content is empty');
  }

  const trimmed = rawText.trim();
  if (isLikelyJson(trimmed)) {
    return parseJsonPrompt(trimmed);
  }

  if (hasUnclosedFence(trimmed)) {
    throw new Error('Detected unterminated code fence in prompt markdown');
  }

  const normalized = trimmed.replace(/\r\n/g, '\n');
  const { frontMatter, sections } = splitSections(normalized);
  const metadata = extractMetadata(frontMatter);

  const name = metadata.name || extractTitle(frontMatter) || 'Untitled Prompt';
  const slugCandidate = metadata.slug || slugify(name);
  const slug = slugCandidate || undefined;
  const description = metadata.description || extractDescription(frontMatter, metadata.rawLines);

  const componentSection = sections.find((entry) => entry.kind === 'component');
  if (!componentSection) {
    throw new Error('Prompt missing component section');
  }

  const componentBlock = extractFirstFence(componentSection.content);
  if (!componentBlock) {
    throw new Error('Component section missing code fence');
  }

  const component = buildComponent(componentBlock, slug, name);

  const warnings: PromptParserWarning[] = [];

  const demoSection = sections.find((entry) => entry.kind === 'demo');
  const demo = demoSection ? buildDemo(demoSection.content, slug, warnings) : undefined;
  if (!demoSection) {
    warnings.push({ section: 'demo', message: 'Demo section missing; downstream preview will rely on auto-generated example.' });
  }

  const dependencySection = sections.find((entry) => entry.kind === 'dependencies');
  const dependencies = dependencySection ? buildDependencies(dependencySection.content, warnings) : [];
  if (!dependencySection) {
    warnings.push({ section: 'dependencies', message: 'No dependency section provided; assuming component is self-contained.' });
  }

  const styleSection = sections.find((entry) => entry.kind === 'styles');
  const styles = styleSection ? buildStyles(styleSection.content, warnings) : [];
  if (!styleSection) {
    warnings.push({ section: 'styles', message: 'No styles section provided; theme defaults will be used.' });
  }

  const assetSection = sections.find((entry) => entry.kind === 'assets');
  const assets = assetSection ? buildAssets(assetSection.content, warnings) : [];
  if (!assetSection) {
    warnings.push({ section: 'assets', message: 'No assets section provided; skipping static asset extraction.' });
  }

  const npmSection = sections.find((entry) => entry.kind === 'npm');
  const npmPackages = npmSection ? buildNpmPackages(npmSection.content, warnings) : [];
  if (!npmSection) {
    warnings.push({ section: 'npm', message: 'No npm dependency section provided; dependency merge step will be skipped.' });
  }

  const notesSection = sections.find((entry) => entry.kind === 'notes');
  const notes = notesSection ? buildNotes(notesSection.content) : [];

  const prompt: ParsedPrompt = {
    name,
    slug,
    description,
    component,
    demo,
    dependencies: dependencies.length ? dependencies : undefined,
    styles: styles.length ? styles : undefined,
    assets: assets.length ? assets : undefined,
    npmPackages: npmPackages.length ? npmPackages : undefined,
    notes: notes.length ? notes : undefined,
  };

  return { prompt, warnings };
}

function parseJsonPrompt(jsonText: string): PromptParserResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (error) {
    throw new Error('Unable to parse prompt JSON');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Prompt JSON must be an object describing ParsedPrompt');
  }

  const candidate = parsed as ParsedPrompt;
  if (!candidate.component?.code) {
    throw new Error('Prompt JSON missing component code');
  }

  const name = candidate.name || 'Untitled Prompt';
  const slugCandidate = candidate.slug || slugify(name);
  const slug = slugCandidate || undefined;

  const prompt: ParsedPrompt = {
    ...candidate,
    name,
    slug,
  };

  return { prompt, warnings: [] };
}

function splitSections(markdown: string): { frontMatter: string; sections: SectionEntry[] } {
  const headingRegex = /^#{2,}\s+(.+?)\s*$/gm;
  const sections: SectionEntry[] = [];
  const matches = Array.from(markdown.matchAll(headingRegex));

  if (!matches.length) {
    return {
      frontMatter: markdown.trim(),
      sections,
    };
  }

  let frontMatterEnd = matches[0].index ?? 0;
  const frontMatter = markdown.slice(0, frontMatterEnd).trim();

  matches.forEach((match, index) => {
    const title = match[1]?.trim() ?? '';
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < matches.length ? (matches[index + 1].index ?? markdown.length) : markdown.length;
    const content = markdown.slice(start, end).trim();
    const kind = resolveSectionKind(title);
    if (kind) {
      sections.push({ kind, title, content });
    }
  });

  return { frontMatter, sections };
}

function resolveSectionKind(title: string): SectionKind | undefined {
  const normalized = title
    .toLowerCase()
    .replace(/[`*_~]/g, '')
    .replace(/[\s\-_/|]+/g, ' ')
    .trim();
  let bestMatch: { kind: SectionKind; score: number } | undefined;

  for (const [kind, aliases] of Object.entries(SECTION_ALIASES) as Array<[SectionKind, string[]]>) {
    for (const alias of aliases) {
      const aliasNormalized = alias.toLowerCase();
      let score = 0;
      if (normalized === aliasNormalized) {
        score = aliasNormalized.length * 2 + 100; // exact match wins strongly
      } else if (normalized.includes(aliasNormalized)) {
        score = aliasNormalized.length;
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = { kind, score };
      }
    }
  }

  return bestMatch?.kind;
}

function extractMetadata(text: string) {
  const metaLines: string[] = [];
  const result: { slug?: string; description?: string; name?: string; rawLines: string[] } = {
    rawLines: metaLines,
  };
  const lines = text.split(/\n+/).map((line) => line.trim()).filter((line) => line.length);

  for (const line of lines) {
    const metaMatch = line.match(/^(?<key>[\w\u4e00-\u9fa5]+)\s*[:：]\s*(?<value>.+)$/);
    if (!metaMatch?.groups) continue;
    const key = metaMatch.groups.key.toLowerCase();
    const value = metaMatch.groups.value.trim();
    metaLines.push(line);

    switch (key) {
      case 'slug':
      case '别名':
      case '标识':
        result.slug = value;
        break;
      case 'description':
      case '描述':
      case '简介':
        result.description = value;
        break;
      case 'name':
      case '名称':
        result.name = value;
        break;
      default:
        break;
    }
  }

  return result;
}

function extractTitle(frontMatter: string): string | undefined {
  const titleMatch = frontMatter.match(/^#\s+(.+)$/m);
  return titleMatch ? titleMatch[1].trim() : undefined;
}

function extractDescription(frontMatter: string, rawLines: string[]): string | undefined {
  if (!frontMatter) return undefined;
  const lines = frontMatter
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length && !/^#/.test(line));

  const filtered = lines.filter((line) => !rawLines.includes(line));
  if (!filtered.length) {
    return undefined;
  }

  return filtered[0];
}

function buildComponent(block: FenceBlock, slug?: string, name?: string) {
  const filename = block.attributes.filename || deriveComponentFilename(slug, name, block.language);
  const exportName = block.attributes.export || block.attributes.exportname;

  return {
    code: block.code,
    filename,
    exportName,
  };
}

function buildDemo(content: string, slug: string | undefined, warnings: PromptParserWarning[]) {
  const block = extractFirstFence(content);
  if (!block) {
    warnings.push({ section: 'demo', message: 'Demo section present but no code fence found.' });
    return undefined;
  }
  const filename = block.attributes.filename || `${slug || 'component-demo'}.demo.${guessExtension(block.language)}`;
  return {
    code: block.code,
    filename,
  };
}

function buildDependencies(content: string, warnings: PromptParserWarning[]): ParsedPromptDependency[] {
  const blocks = extractAllFences(content);
  if (!blocks.length) {
    warnings.push({ section: 'dependencies', message: 'Dependency section present but no code fence found.' });
    return [];
  }
  return blocks.map((block, index) => {
    const filename = block.attributes.filename || `dependency-${index + 1}.${guessExtension(block.language)}`;
    const kind = block.attributes.kind as ParsedPromptDependency['kind'];
    return {
      filename,
      content: block.code,
      kind,
    };
  });
}

function buildStyles(content: string, warnings: PromptParserWarning[]): ParsedPromptFile[] {
  const blocks = extractAllFences(content);
  if (!blocks.length) {
    warnings.push({ section: 'styles', message: 'Styles section present but no code fence found.' });
    return [];
  }
  return blocks.map((block, index) => {
    const filename = block.attributes.filename || `style-${index + 1}.${guessExtension(block.language, 'css')}`;
    return {
      filename,
      content: block.code,
    };
  });
}

function buildAssets(content: string, warnings: PromptParserWarning[]): ParsedPromptAsset[] {
  const blocks = extractAllFences(content);
  if (!blocks.length) {
    warnings.push({ section: 'assets', message: 'Assets section present but no code fence found.' });
    return [];
  }
  return blocks.map((block, index) => {
    const filename = block.attributes.filename || `asset-${index + 1}`;
    const encoding = block.attributes.encoding as ParsedPromptAsset['encoding'];
    const contentType = block.attributes['content-type'] || block.attributes.contenttype;
    return {
      filename,
      content: block.code,
      encoding,
      contentType,
    };
  });
}

function buildNpmPackages(content: string, warnings: PromptParserWarning[]) {
  const withoutFences = content.replace(/```[\s\S]*?```/g, '').trim();
  const lines = withoutFences
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length);

  const packages: Array<{ name: string; version?: string }> = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-*+\d.\s]+/, '').replace(/\s{2,}/g, ' ').trim();
    if (!cleaned) continue;

    let name = cleaned;
    let version: string | undefined;

    const colonIndex = cleaned.indexOf(':');
    if (colonIndex > -1) {
      name = cleaned.slice(0, colonIndex).trim();
      version = cleaned.slice(colonIndex + 1).trim();
    } else {
      const parts = cleaned.split(/\s+/);
      if (parts.length > 1) {
        name = parts[0].trim();
        version = parts.slice(1).join(' ').trim();
      } else {
        const atIndex = cleaned.lastIndexOf('@');
        if (atIndex > 0) {
          name = cleaned.slice(0, atIndex).trim();
          version = cleaned.slice(atIndex + 1).trim();
        }
      }
    }

    name = name.replace(/[,;]$/, '');
    version = version?.replace(/^v/, '').replace(/[,;]$/, '');

    if (name) {
      packages.push({ name, version: version || undefined });
    }
  }

  if (!packages.length) {
    warnings.push({ section: 'npm', message: 'Unable to parse npm dependencies; ensure lines follow `package@version` format.' });
  }

  return packages;
}

function buildNotes(content: string): string[] {
  const withoutFences = content.replace(/```[\s\S]*?```/g, '').trim();
  const lines = withoutFences
    .split('\n')
    .map((line) => line.trim())
    .map(stripListMarker)
    .filter((line) => line.length);

  return lines;
}

function stripListMarker(line: string) {
  const listPattern = /^(?:[-*+]|\d+[.)])\s+/;
  if (listPattern.test(line)) {
    return line.replace(listPattern, '').trim();
  }
  return line;
}

function extractFirstFence(content: string): FenceBlock | undefined {
  const blocks = extractAllFences(content);
  return blocks[0];
}

function extractAllFences(content: string): FenceBlock[] {
  const fenceRegex = /```([^\n]*)\n([\s\S]*?)```/g;
  const blocks: FenceBlock[] = [];
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(content)) !== null) {
    const infoString = match[1]?.trim() ?? '';
    const code = match[2] ?? '';
    const { language, attributes } = parseFenceInfo(infoString);
    blocks.push({ language, attributes, code: code.replace(/\s+$/, '') });
  }

  return blocks;
}

function parseFenceInfo(infoString: string) {
  if (!infoString) {
    return { language: undefined, attributes: {} as Record<string, string> };
  }
  const parts = infoString.split(/\s+/).filter(Boolean);
  let language: string | undefined;
  const attributes: Record<string, string> = {};

  for (const part of parts) {
    if (!language && !part.includes('=')) {
      language = part;
      continue;
    }

    const [rawKey, ...rawValue] = part.split('=');
    if (!rawKey || !rawValue.length) continue;
    const key = rawKey.toLowerCase();
    const value = rawValue.join('=').replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    attributes[key] = value;
  }

  return { language, attributes };
}

function deriveComponentFilename(slug?: string, name?: string, language?: string) {
  const base = slug || slugify(name || 'component');
  const ext = guessExtension(language, 'tsx');
  return `${base}.${ext}`;
}

function guessExtension(language?: string, fallback: string = 'ts') {
  if (!language) return fallback;
  const lower = language.toLowerCase();
  if (['ts', 'tsx', 'typescript'].includes(lower)) return lower.startsWith('tsx') ? 'tsx' : 'ts';
  if (['js', 'jsx', 'javascript'].includes(lower)) return lower.startsWith('jsx') ? 'jsx' : 'js';
  if (['css', 'scss', 'less'].includes(lower)) return lower;
  if (['json'].includes(lower)) return 'json';
  if (['md', 'markdown'].includes(lower)) return 'md';
  if (['html'].includes(lower)) return 'html';
  if (['asset', 'binary'].includes(lower)) return 'bin';
  return fallback;
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function isLikelyJson(input: string) {
  return input.startsWith('{') || input.startsWith('[');
}

function hasUnclosedFence(input: string) {
  const matches = input.match(/```/g);
  return !!matches && matches.length % 2 !== 0;
}

export default parsePrompt;

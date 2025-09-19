import type { IZipEntry } from 'adm-zip';

export interface ZipValidationDetail {
  code: 'missing-file';
  file: string;
  message: string;
  description?: string;
}

export class TemplateZipValidationError extends Error {
  readonly status = 400;
  readonly details: ZipValidationDetail[];

  constructor(details: ZipValidationDetail[]) {
    super('Template ZIP validation failed');
    this.name = 'TemplateZipValidationError';
    this.details = details;
  }
}

interface RequiredFile {
  name: string;
  description: string;
}

const DEFAULT_REQUIRED_FILES: RequiredFile[] = [
  { name: 'template.json', description: '模板元数据 template.json 缺失' },
  { name: 'schema.json', description: '模板 schema.json 缺失' },
  { name: 'preview.html', description: '模板预览 preview.html 缺失' },
];

export interface ValidateTemplateZipOptions {
  requiredFiles?: RequiredFile[];
}

export function validateTemplateZip(entries: IZipEntry[], options: ValidateTemplateZipOptions = {}): void {
  const required = options.requiredFiles ?? DEFAULT_REQUIRED_FILES;
  const files = new Set(entries.filter((entry) => !entry.isDirectory).map((entry) => normalizeEntryName(entry.entryName)));

  const missing: ZipValidationDetail[] = [];
  for (const requirement of required) {
    if (!hasFile(files, requirement.name)) {
      missing.push({
        code: 'missing-file',
        file: requirement.name,
        message: `Required file \"${requirement.name}\" not found in archive`,
        description: requirement.description,
      });
    }
  }

  if (missing.length) {
    throw new TemplateZipValidationError(missing);
  }
}

function hasFile(existing: Set<string>, required: string): boolean {
  const normalized = normalizeEntryName(required);
  if (existing.has(normalized)) return true;
  // allow required files to exist under root-level directory
  for (const file of existing) {
    if (file.endsWith(`/${normalized}`)) return true;
  }
  return false;
}

function normalizeEntryName(raw: string): string {
  return raw
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter((segment) => segment && segment !== '.')
    .join('/')
    .toLowerCase();
}

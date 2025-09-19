import type { ParsedPrompt } from '@/shared/types';

export interface SchemaGeneratorResult {
  schema: Record<string, any>;
  defaults: Record<string, any>;
  warnings: string[];
}

export function generateSchema(parsed: ParsedPrompt): SchemaGeneratorResult {
  const warnings: string[] = [];
  if (!parsed || !parsed.component) {
    throw new Error('Parsed prompt missing component section');
  }

  const schema = {
    title: parsed.name || 'Component',
    type: 'object',
    properties: {} as Record<string, any>,
    required: [] as string[],
  };

  const defaults: Record<string, any> = {};

  const notes = parsed.notes || [];
  const fieldPattern = /@field\s+(?<name>[\w.-]+)\s*:\s*(?<type>\w+)(\s*=\s*(?<default>.+))?/i;
  for (const note of notes) {
    const match = note.match(fieldPattern);
    if (!match || !match.groups?.name) continue;
    const fieldName = match.groups.name;
    const type = (match.groups.type || 'string').toLowerCase();
    const defaultValue = match.groups.default?.trim();

    schema.properties[fieldName] = mapType(type);
    if (type !== 'boolean') {
      schema.properties[fieldName].nullable = true;
    }
    if (defaultValue !== undefined) {
      defaults[fieldName] = coerceDefault(type, defaultValue);
    } else {
      defaults[fieldName] = type === 'boolean' ? false : null;
    }
  }

  if (!Object.keys(schema.properties).length) {
    warnings.push('No @field metadata found; schema contains no configurable properties');
  }

  return { schema, defaults, warnings };
}

function mapType(type: string) {
  switch (type) {
    case 'number':
      return { type: 'number' };
    case 'boolean':
      return { type: 'boolean' };
    case 'array':
      return { type: 'array', items: { type: 'string' } };
    case 'string':
    default:
      return { type: 'string' };
  }
}

function coerceDefault(type: string, value: string) {
  switch (type) {
    case 'number':
      return Number(value);
    case 'boolean':
      return /true/i.test(value);
    case 'array':
      try {
        const arr = JSON.parse(value);
        return Array.isArray(arr) ? arr : [value];
      } catch {
        return [value];
      }
    case 'string':
    default:
      return value;
  }
}

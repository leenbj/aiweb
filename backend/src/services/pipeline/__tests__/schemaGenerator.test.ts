import { test } from 'node:test';
import assert from 'node:assert/strict';

import { generateSchema } from '../schemaGenerator';
import type { ParsedPrompt } from '@shared/types';

test('generateSchema extracts fields from notes', () => {
  const parsed: ParsedPrompt = {
    name: 'Pricing Table',
    component: { code: '<div />' },
    notes: [
      '@field heading: string = "Pricing"',
      '@field items: array = ["Basic", "Pro"]',
      '@field highlight: boolean = true',
    ],
  };

  const result = generateSchema(parsed);
  assert.equal(Object.keys(result.schema.properties).length, 3);
  assert.equal(result.defaults.heading, 'Pricing');
  assert.deepEqual(result.defaults.items, ['Basic', 'Pro']);
  assert.equal(result.defaults.highlight, true);
});

test('generateSchema warns when no fields defined', () => {
  const parsed: ParsedPrompt = {
    name: 'Hero Banner',
    component: { code: '<div />' },
    notes: ['No fields here'],
  };
  const result = generateSchema(parsed);
  assert.equal(result.warnings.length, 1);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizePayload } from '../prompts';

test('normalizePayload parses array payload', () => {
  const result = normalizePayload([
    { name: 'Prompt A', rawText: 'hello' },
    { name: 'Prompt B', rawText: 'world', tags: ['hero'] },
  ]);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, 'Prompt A');
  assert.equal(result[1].tags?.[0], 'hero');
});

test('normalizePayload parses JSON string payload', () => {
  const body = JSON.stringify({ name: 'Prompt JSON', rawText: 'markdown' });
  const result = normalizePayload(body);
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Prompt JSON');
});

test('normalizePayload parses plain text payload', () => {
  const result = normalizePayload('This is markdown');
  assert.equal(result.length, 1);
  assert.ok(result[0].name.startsWith('prompt-'));
  assert.equal(result[0].rawText, 'This is markdown');
});

test('normalizePayload returns empty for unsupported payload', () => {
  const result = normalizePayload(123 as any);
  assert.equal(result.length, 0);
});

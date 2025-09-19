import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IZipEntry } from 'adm-zip';

import { validateTemplateZip, TemplateZipValidationError } from '../../../utils/templates/zipSchemaValidator';

function entry(name: string, isDirectory = false): IZipEntry {
  return {
    entryName: name,
    isDirectory,
  } as unknown as IZipEntry;
}

test('validateTemplateZip succeeds when required files exist', () => {
  assert.doesNotThrow(() =>
    validateTemplateZip([
      entry('template.json'),
      entry('schema.json'),
      entry('preview.html'),
      entry('pages/home.html'),
    ]),
  );
});

test('validateTemplateZip accepts required files inside root directory', () => {
  assert.doesNotThrow(() =>
    validateTemplateZip([
      entry('metadata/template.json'),
      entry('metadata/schema.json'),
      entry('preview/preview.html'),
    ]),
  );
});

test('validateTemplateZip throws with structured details when files missing', () => {
  try {
    validateTemplateZip([
      entry('template.json'),
      entry('assets/logo.png'),
    ]);
    assert.fail('should throw');
  } catch (error) {
    assert.ok(error instanceof TemplateZipValidationError);
    assert.equal(error.details.length, 2);
    assert.deepEqual(
      error.details.map((d) => d.file).sort(),
      ['preview.html', 'schema.json'],
    );
    assert.equal(error.status, 400);
  }
});

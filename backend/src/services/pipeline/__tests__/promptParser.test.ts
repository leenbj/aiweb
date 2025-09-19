import { test } from 'node:test';
import assert from 'node:assert/strict';

import parsePrompt, { parsePrompt as parsePromptNamed } from '../promptParser';

test('parsePrompt extracts component, demo, dependencies, styles, assets, npm packages and notes', () => {
  const markdown = [
    '# Hero Banner',
    'Slug: hero-banner',
    'Description: 用于着陆页的 Hero 组件',
    '',
    '## 主组件',
    '```tsx filename=HeroBanner.tsx export=HeroBanner',
    'import React from "react";',
    '',
    'export const HeroBanner: React.FC = () => (',
    '  <section className="hero">',
    '    <h1>Grow faster with Hero</h1>',
    '  </section>',
    ');',
    '```',
    '',
    '## Demo',
    '```tsx filename=HeroBanner.demo.tsx',
    "import { HeroBanner } from './HeroBanner';",
    '',
    'export default function Demo() {',
    '  return <HeroBanner />;',
    '}',
    '```',
    '',
    '## 依赖文件',
    '```ts filename=utils/color.ts kind=util',
    'export function toHex(value: number) {',
    '  return `#${value.toString(16)}`;',
    '}',
    '```',
    '',
    '## 样式',
    '```css filename=hero-banner.css',
    '.hero {',
    '  display: grid;',
    '  gap: 1.5rem;',
    '}',
    '```',
    '',
    '## 静态资源',
    '```asset filename=images/hero.png encoding=base64',
    'ZmFrZS1pbWFnZS1ieXRlcw==',
    '```',
    '',
    '## npm 依赖',
    '- clsx@^2.0.0',
    '- @tanstack/react-query ^5.47.0',
    '',
    '## 实施指南',
    '- @field title: string = "Main headline"',
    '- 提供清晰的 CTA 按钮',
    '',
  ].join('\n');

  const { prompt, warnings } = parsePrompt(markdown);

  assert.equal(prompt.name, 'Hero Banner');
  assert.equal(prompt.slug, 'hero-banner');
  assert.equal(prompt.description, '用于着陆页的 Hero 组件');

  assert.ok(prompt.component);
  assert.match(prompt.component.code, /HeroBanner/);
  assert.equal(prompt.component.filename, 'HeroBanner.tsx');
  assert.equal(prompt.component.exportName, 'HeroBanner');

  assert.ok(prompt.demo);
  assert.match(prompt.demo!.code, /HeroBanner/);
  assert.equal(prompt.demo!.filename, 'HeroBanner.demo.tsx');

  assert.ok(prompt.dependencies);
  assert.equal(prompt.dependencies!.length, 1);
  assert.equal(prompt.dependencies![0].filename, 'utils/color.ts');
  assert.equal(prompt.dependencies![0].kind, 'util');

  assert.ok(prompt.styles);
  assert.equal(prompt.styles!.length, 1);
  assert.equal(prompt.styles![0].filename, 'hero-banner.css');

  assert.ok(prompt.assets);
  assert.equal(prompt.assets![0].encoding, 'base64');

  assert.ok(prompt.npmPackages);
  assert.deepEqual(prompt.npmPackages![0], { name: 'clsx', version: '^2.0.0' });
  assert.deepEqual(prompt.npmPackages![1], { name: '@tanstack/react-query', version: '^5.47.0' });

  assert.deepEqual(prompt.notes, [
    '@field title: string = "Main headline"',
    '提供清晰的 CTA 按钮',
  ]);

  assert.ok(Array.isArray(warnings), JSON.stringify(warnings));
  assert.deepEqual(warnings, [], JSON.stringify(warnings));
});

test('parsePrompt returns warnings when optional sections missing and derives slug', () => {
  const markdown = [
    '# Stats Card',
    '',
    '## 主组件',
    '```tsx',
    'export function StatsCard() {',
    '  return <div>Stats</div>;',
    '}',
    '```',
    '',
  ].join('\n');

  const { prompt, warnings } = parsePromptNamed(markdown);

  assert.equal(prompt.name, 'Stats Card');
  assert.equal(prompt.slug, 'stats-card');
  assert.ok(Array.isArray(warnings));
  const sectionsWithWarnings = warnings.map((warning) => warning.section);
  assert.ok(sectionsWithWarnings.includes('demo'));
  assert.ok(sectionsWithWarnings.includes('dependencies'));
  assert.ok(sectionsWithWarnings.includes('styles'));
  assert.ok(sectionsWithWarnings.includes('assets'));
  assert.ok(sectionsWithWarnings.includes('npm'));
});

test('parsePrompt throws on unterminated fence', () => {
  const invalid = '# Title\n\n## 主组件\n```tsx\nexport const Broken = () => null;\n';
  assert.throws(() => parsePrompt(invalid), /unterminated code fence/i);
});

test('parsePrompt accepts JSON payloads describing ParsedPrompt', () => {
  const json = JSON.stringify({
    name: 'JSON Prompt',
    component: {
      code: 'export const Example = () => null;',
    },
  });

  const { prompt, warnings } = parsePrompt(json);
  assert.equal(prompt.name, 'JSON Prompt');
  assert.equal(prompt.slug, 'json-prompt');
  assert.equal(prompt.component.code, 'export const Example = () => null;');
  assert.equal(warnings.length, 0);
});

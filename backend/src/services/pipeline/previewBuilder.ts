import path from 'path';
import fs from 'fs/promises';

export interface PreviewBuildInput {
  outDir: string;
  componentFile: string;
  demoFile?: string;
  slug: string;
}

export interface PreviewBuildResult {
  previewHtml: string;
  previewPath: string;
  warnings: string[];
}

const TEMPLATE = (slug: string, componentPath: string, demoPath?: string) => `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${slug} Preview</title>
  <link rel="stylesheet" href="/preview.css" />
</head>
<body>
  <div id="root"></div>
  <script type="module">
    import Component from './${componentPath}';
    ${demoPath ? `import Demo from './${demoPath}';
    const Preview = Demo ?? Component;
    const app = Preview instanceof Function ? Preview() : Preview;` : 'const Preview = Component instanceof Function ? Component() : Component; const app = Preview;'}
    const container = document.getElementById('root');
    if (container) {
      container.innerHTML = '';
      if (typeof app === 'string') {
        container.innerHTML = app;
      } else if (app && app.outerHTML) {
        container.appendChild(app);
      } else {
        container.innerText = '[Preview rendering not implemented]';
      }
    }
  </script>
</body>
</html>`;

export async function buildPreview(input: PreviewBuildInput): Promise<PreviewBuildResult> {
  const warnings: string[] = [];
  if (!input.componentFile) {
    throw new Error('componentFile missing');
  }

  const previewHtml = TEMPLATE(input.slug, input.componentFile, input.demoFile);
  const previewPath = path.join(input.outDir, 'preview.html');
  await fs.writeFile(previewPath, previewHtml, 'utf8');

  if (!input.demoFile) {
    warnings.push('Preview rendered without demo; fallback to component export');
  }

  return {
    previewHtml,
    previewPath,
    warnings,
  };
}

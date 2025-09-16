import AdmZip from 'adm-zip';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  const zip = new AdmZip();
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>示例落地页</title>
    <link rel="stylesheet" href="static/css/app.css" />
  </head>
  <body>
    <header class="site-header">Open Lovable</header>
    <section class="hero">
      <h1>安诺儿童定位器</h1>
      <p>更安全的随身守护</p>
      <a class="btn" href="/buy">立即购买</a>
    </section>
    <footer class="site-footer">© 2025</footer>
  </body>
</html>`;
  const css = `:root{--color-primary:#2b7cff}
  body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;padding:24px}
  .site-header,.site-footer{padding:12px 0;color:#555}
  .hero{padding:40px 0}
  .btn{display:inline-block;padding:8px 16px;background:var(--color-primary);color:#fff;border-radius:6px;text-decoration:none}
  `;

  zip.addFile('index.html', Buffer.from(html, 'utf8'));
  zip.addFile('static/css/app.css', Buffer.from(css, 'utf8'));

  const outDir = path.resolve(process.cwd(), 'project');
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, 'sample-site.zip');
  await fs.writeFile(outPath, zip.toBuffer());
  console.log('Sample ZIP created at:', outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


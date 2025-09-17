#!/usr/bin/env node

const AdmZip = require('adm-zip');

async function main() {
  const baseUrl = process.env.TEST_API_BASE || 'http://localhost:3001/api/templates';
  console.log(`[info] Using API base: ${baseUrl}`);

  const sampleHtml = `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>示例落地页</title>
    <link rel="stylesheet" href="assets/style.css" />
  </head>
  <body>
    <header class="site-header">
      <h1>欢迎来到示例站点</h1>
    </header>
    <section class="hero">
      <h2>英雄模块</h2>
      <p>这是一个用于测试组合的英雄模块。</p>
    </section>
    <section class="pricing">
      <div class="plan">基础版</div>
      <div class="plan">专业版</div>
    </section>
    <footer class="site-footer">版权所有</footer>
    <script src="assets/app.js"></script>
  </body>
</html>`;

  const zip = new AdmZip();
  zip.addFile('index.html', Buffer.from(sampleHtml, 'utf8'));
  zip.addFile('assets/style.css', Buffer.from('body{font-family:sans-serif;} .hero{padding:40px;background:#f5f5f5;}', 'utf8'));
  zip.addFile('assets/app.js', Buffer.from('console.log("hello from sample");', 'utf8'));
  const buffer = zip.toBuffer();

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: 'application/zip' }), 'sample.zip');

  console.log('[step] POST /import-zip');
  const importRes = await fetch(`${baseUrl}/import-zip`, { method: 'POST', body: form });
  const importJson = await importRes.json();
  if (!importRes.ok || !importJson.success) {
    throw new Error(`导入失败: ${importRes.status} ${importJson.error || ''}`);
  }
  const pages = importJson.pages || [];
  const components = importJson.components || [];
  if (!pages.length) throw new Error('导入未返回任何页面模板');
  if (!components.length) throw new Error('导入未识别任何组件模板');
  console.log(`[info] 导入成功，pages=${pages.length}, components=${components.length}`);

  const pageSlug = pages[0];
  const componentSlug = components[0];

  console.log('[step] GET /:slug');
  const tplRes = await fetch(`${baseUrl}/${pageSlug}`);
  if (!tplRes.ok) throw new Error(`获取模板失败: ${tplRes.status}`);
  const tplJson = await tplRes.json();
  const templateId = tplJson.id;
  if (!templateId) throw new Error('模板记录缺少 id 字段');

  console.log('[step] GET /search?type=component');
  const searchRes = await fetch(`${baseUrl}/search?type=component&query=${encodeURIComponent(componentSlug)}`);
  if (!searchRes.ok) throw new Error(`搜索组件失败: ${searchRes.status}`);
  const searchJson = await searchRes.json();
  if (!Array.isArray(searchJson.items) || !searchJson.items.length) throw new Error('搜索结果为空');

  console.log('[step] POST /render');
  const renderRes = await fetch(`${baseUrl}/render`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug: pageSlug })
  });
  const renderJson = await renderRes.json();
  if (!renderRes.ok || !renderJson.html) throw new Error('模板渲染失败');

  console.log('[step] POST /compose');
  const composeRes = await fetch(`${baseUrl}/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      page: { slug: pageSlug },
      components: [{ slot: componentSlug, slug: componentSlug, data: {} }]
    })
  });
  const composeJson = await composeRes.json();
  if (!composeRes.ok || !composeJson.html) throw new Error('组合页面失败');

  console.log('[step] GET /:id/export');
  const exportRes = await fetch(`${baseUrl}/${templateId}/export`);
  if (!exportRes.ok) throw new Error(`导出模板失败: ${exportRes.status}`);
  const contentType = exportRes.headers.get('content-type') || '';
  if (!contentType.includes('zip')) throw new Error(`导出内容类型异常: ${contentType}`);
  const exportBuffer = Buffer.from(await exportRes.arrayBuffer());
  if (exportBuffer.length === 0) throw new Error('导出文件为空');

  console.log('\n✅ 所有接口检查通过');
  console.log(`- 导入模板: ${pageSlug}`);
  console.log(`- 组件示例: ${componentSlug}`);
  console.log(`- 导出 ZIP 大小: ${exportBuffer.length} 字节`);
}

main().catch((err) => {
  console.error(`\n❌ 测试失败: ${err.message}`);
  process.exitCode = 1;
});

import * as cheerio from 'cheerio';

// 极简安全净化：移除脚本/内联事件/可疑链接方案与样式表达式
export function sanitizeHtmlCssJs(_html: string, _css?: string, _js?: string) {
  if (!_html) return { html: _html, css: _css, js: _js };

  const isFullDoc = /<!DOCTYPE/i.test(_html) || /<html[\s>]/i.test(_html);
  const $ = cheerio.load(_html, { xmlMode: false, decodeEntities: true } as any);

  // 1) 删除脚本与危险标签
  $('script, iframe, object, embed').remove();

  // 2) 清除危险属性与链接方案
  $('*').each((_, el) => {
    const attribs = (el as any).attribs || {};
    for (const name of Object.keys(attribs)) {
      const v = String(attribs[name] ?? '');
      // on* 事件处理程序
      if (/^on/i.test(name)) {
        $(el).removeAttr(name);
        continue;
      }
      // href/src/javascript: or data:javascript
      if ((name === 'href' || name === 'src')) {
        const val = v.trim();
        if (/^javascript:/i.test(val)) $(el).removeAttr(name);
        if (/^data:\s*text\/javascript/i.test(val)) $(el).removeAttr(name);
      }
      if (name === 'style') {
        let style = v;
        // 去除表达式与 js url
        style = style.replace(/expression\s*\(/gi, '');
        style = style.replace(/url\((['"]?)\s*javascript:[^\)]*\)/gi, '');
        style = style.replace(/behavior\s*:\s*url\([^\)]*\)/gi, '');
        $(el).attr('style', style);
      }
    }
  });

  const html = isFullDoc ? $.html() : $.root().html() || '';
  // 暂不处理 _css/_js，返回原值（若后续需要可在此处再净化）
  return { html, css: _css, js: _js };
}

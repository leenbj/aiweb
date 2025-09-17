import * as cheerio from 'cheerio';
import { inferSchemaFromHtml } from './schemaGenerator';

export interface ParametrizeResult {
  code: string;
  schemaJson: any;
}

// 将常见结构参数化为 Handlebars 模板
export function parametrizeComponentHtml(htmlFragment: string): ParametrizeResult {
  const $ = cheerio.load(htmlFragment);

  // 标题
  const h1 = $('h1').first();
  if (h1.length) h1.text('{{title}}');

  // 副标题
  const p = $('p').first();
  if (p.length) p.text('{{subtitle}}');

  // CTA 按钮
  const a = $('a').first();
  if (a.length) {
    a.attr('href', '{{cta.href}}');
    a.text('{{cta.text}}');
  }

  // 单图像
  const img = $('img').first();
  if (img.length) {
    img.attr('src', '{{image.src}}');
    img.attr('alt', '{{image.alt}}');
  }

  // 列表
  const ul = $('ul').first();
  if (ul.length) {
    // 尽量保留 li class
    const sampleLi = ul.find('li').first();
    const liClass = sampleLi.attr('class');
    // 进一步探测价格等字段
    const text = sampleLi.text().trim();
    const hasPrice = /\d+|¥|\$/.test(text);
    let liTpl: string;
    if (hasPrice) {
      // 价格型列表作为对象数组
      liTpl = liClass ? `<li class="${liClass}">{{name}} - {{price}}</li>` : '<li>{{name}} - {{price}}</li>';
    } else {
      liTpl = liClass ? `<li class="${liClass}">{{this}}</li>` : '<li>{{this}}</li>';
    }
    const each = `{{#each items}}${liTpl}{{/each}}`;
    ul.html(each);
  }

  // 简单卡片栅格（pricing/features/cards/plans）
  const grid = $('[class*=pricing], [class*=feature], [class*=card], [class*=plans]').first();
  if (grid.length) {
    const children = grid.children();
    if (children.length >= 2) {
      const firstChild = children.first();
      // 替换常见文本节点为变量
      const replaceText = (el: cheerio.Cheerio<any>, key: string) => {
        if (!el || el.length === 0) return;
        const t = el.text().trim();
        if (t) el.text(`{{${key}}}`);
      };
      replaceText(firstChild.find('h3').first(), 'title');
      replaceText(firstChild.find('h4').first(), 'subtitle');
      const price = firstChild.find(':contains("¥"), :contains("$")').first();
      if (price.length) price.text('{{price}}');
      const ptag = firstChild.find('p').first();
      if (ptag.length) ptag.text('{{text}}');
      const cardTpl = firstChild.parent().children().length ? $.html(firstChild) : firstChild.html() || '';
      grid.html(`{{#each items}}${cardTpl}{{/each}}`);
    }
  }

  const schemaJson = inferSchemaFromHtml(htmlFragment);
  if (img.length) {
    schemaJson.properties = schemaJson.properties || {};
    schemaJson.properties.image = {
      type: 'object',
      properties: { src: { type: 'string', format: 'uri-reference' }, alt: { type: 'string' } },
      required: ['src']
    };
  }
  if (ul.length || grid.length) {
    schemaJson.properties = schemaJson.properties || {};
    // 若检测为价格卡片，items 为对象数组；否则字符串数组
    const itemsSchema = ul.length && /\d+|¥|\$/.test(ul.find('li').first().text())
      ? { type: 'array', items: { type: 'object', properties: { name: { type:'string' }, price:{ type:'string' } }, required:['name','price'] } }
      : { type: 'array', items: { type: 'string' } };
    schemaJson.properties.items = schemaJson.properties.items || itemsSchema;
  }
  const code = $.root().children().length === 1 ? $.root().html() || '' : $.html();
  return { code, schemaJson };
}

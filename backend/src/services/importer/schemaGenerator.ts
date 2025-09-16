import * as cheerio from 'cheerio';

export function inferSchemaFromHtml(htmlFragment: string) {
  const $ = cheerio.load(htmlFragment);
  const schema: any = { type: 'object', properties: {}, required: [] };

  // 标题类
  if ($('h1').length) schema.properties.title = { type: 'string' };
  if ($('h2').length || $('p').length) schema.properties.subtitle = { type: 'string' };

  // CTA 按钮
  const a = $('a').first();
  if (a.length) {
    schema.properties.cta = {
      type: 'object',
      properties: { text: { type: 'string' }, href: { type: 'string' } },
      required: ['text', 'href']
    };
  }

  // 列表
  if ($('ul li').length) {
    // 根据 li 文本是否包含价格信息，推断对象数组
    const firstLi = $('ul li').first();
    const txt = firstLi.text().trim();
    const hasPrice = /[\d¥$]/.test(txt);
    if (hasPrice) {
      schema.properties.items = {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            price: { type: 'string' },
            features: { type: 'array', items: { type: 'string' } }
          },
          required: ['name', 'price']
        }
      };
    } else {
      schema.properties.items = { type: 'array', items: { type: 'string' } };
    }
  }

  // 多按钮：若存在多个链接，提供 buttons 数组
  const links = $('a');
  if (links.length > 1) {
    schema.properties.buttons = {
      type: 'array',
      items: { type: 'object', properties: { text: { type:'string' }, href: { type:'string' } }, required: ['text','href'] }
    };
  }

  // 图片：多图/单图
  const imgs = $('img');
  if (imgs.length > 1) {
    schema.properties.images = {
      type: 'array',
      items: {
        type: 'object',
        properties: { src: { type: 'string', format: 'uri-reference' }, alt: { type: 'string' } },
        required: ['src']
      }
    };
  } else if (imgs.length === 1) {
    schema.properties.image = {
      type: 'object',
      properties: { src: { type: 'string', format: 'uri-reference' }, alt: { type: 'string' } },
      required: ['src']
    };
  }

  return schema;
}

import { isString } from 'lodash';

const BASE_STYLE = '<style>html,body{margin:0!important;padding:0!important;background:#fff;}body{padding-top:8px !important;}*{box-sizing:border-box;}</style>';
const META_TAGS = '<meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/>';

function resolveUploadsBase(): string {
  const env: any = (import.meta as any).env || {};
  const rawBase: string = env?.VITE_API_URL || (env?.DEV ? '/api' : 'http://localhost:3001/api');
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
  try {
    const url = new URL(rawBase, origin);
    url.pathname = `${url.pathname.replace(/\/+$/, '')}/uploads/`;
    return url.toString().replace(/\/+$/, '/');
  } catch (error) {
    if (typeof rawBase === 'string' && rawBase.startsWith('/')) {
      return `${rawBase.replace(/\/+$/, '')}/uploads/`.replace(/\/+$/, '/');
    }
    return '/api/uploads/';
  }
}

let cachedUploadsBase: string | null = null;

export function getUploadsBase(): string {
  if (!cachedUploadsBase) {
    cachedUploadsBase = resolveUploadsBase();
  }
  return cachedUploadsBase;
}

function rewriteUploadsPaths(html: string, uploadsBase: string): string {
  if (!html) return html;
  const base = uploadsBase.replace(/\/+$/, '/');
  let output = html;
  output = output.replace(/(<base\s+[^>]*href=["'])\/uploads\//gi, (match) => match.replace('/uploads/', base));
  output = output.replace(/(href|src)=["']\/uploads\//gi, (match) => match.replace('/uploads/', base));
  output = output.replace(/url\((['"]?)\/uploads\//gi, (match) => match.replace('/uploads/', base));
  return output;
}

function ensureBaseTag(doc: string, uploadsBase: string): string {
  if (!doc) return doc;
  if (/<base\b[^>]*href=/i.test(doc)) return doc;
  const baseTag = `<base href="${uploadsBase.replace(/\/+$/, '/')}"/>`;
  if (/<head\b[^>]*>/i.test(doc)) {
    return doc.replace(/<head([^>]*)>/i, (match, attrs) => `<head${attrs}>${baseTag}`);
  }
  if (/<html\b[^>]*>/i.test(doc)) {
    return doc.replace(/<html([^>]*)>/i, (match, attrs) => `<html${attrs}><head>${baseTag}</head>`);
  }
  return doc;
}

function injectHeadDefaults(doc: string): string {
  if (!doc) return doc;
  if (/<head\b[^>]*>/i.test(doc)) {
    return doc.replace(/<head([^>]*)>/i, (match, attrs) => `<head${attrs}>${META_TAGS}${BASE_STYLE}`);
  }
  if (/<html\b[^>]*>/i.test(doc)) {
    return doc.replace(/<html([^>]*)>/i, (match, attrs) => `<html${attrs}><head>${META_TAGS}${BASE_STYLE}</head>`);
  }
  return doc;
}

function wrapFragment(fragment: string, uploadsBase: string): string {
  const baseHref = uploadsBase.replace(/\/+$/, '/');
  return `<!DOCTYPE html><html lang="zh-CN"><head><base href="${baseHref}">${META_TAGS}${BASE_STYLE}</head><body>${fragment}</body></html>`;
}

export function buildTemplatePreviewDoc(rawHtml?: string | null): string {
  const source = isString(rawHtml) ? rawHtml : '';
  if (!source) return '';
  const uploadsBase = getUploadsBase();
  let normalized = rewriteUploadsPaths(source, uploadsBase);
  const isFullDocument = /<!DOCTYPE/i.test(normalized) || /<html[\s>]/i.test(normalized);
  if (isFullDocument) {
    normalized = ensureBaseTag(normalized, uploadsBase);
    normalized = rewriteUploadsPaths(normalized, uploadsBase);
    normalized = injectHeadDefaults(normalized);
    return normalized;
  }
  return wrapFragment(normalized, uploadsBase);
}

export function normalizeUploadsReference(url: string): string {
  if (!url) return url;
  const base = getUploadsBase();
  if (url.startsWith('/api/uploads/') || url.startsWith(base)) return url;
  if (url.startsWith('/uploads/')) {
    return url.replace('/uploads/', base);
  }
  return url;
}

export function toUploadsPath(url: string): string {
  if (!url) return url;

  const toUploads = (suffix: string) => `/uploads/${suffix.replace(/^\/+/,'')}`;

  if (url.startsWith('/uploads/')) {
    return toUploads(url.slice('/uploads/'.length));
  }
  if (url.startsWith('/api/uploads/')) {
    return toUploads(url.slice('/api/uploads/'.length));
  }

  const base = getUploadsBase();
  if (url.startsWith(base)) {
    return toUploads(url.slice(base.length));
  }

  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const parsed = new URL(url, origin);
    if (parsed.pathname.startsWith('/uploads/')) {
      return toUploads(parsed.pathname.slice('/uploads/'.length));
    }
    if (parsed.pathname.startsWith('/api/uploads/')) {
      return toUploads(parsed.pathname.slice('/api/uploads/'.length));
    }
  } catch {
    // ignore parsing failure
  }

  return url;
}

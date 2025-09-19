# Templates API

This document describes the `POST /api/templates/import-zip` endpoint for ingesting template ZIP archives and the `GET /api/templates/summary` endpoint for querying cached template summaries.

## Import ZIP Endpoint

## Summary

- **Method**: POST
- **Path**: `/api/templates/import-zip`
- **Auth**: requires an authenticated session (same as other template routes)
- **Request Body**: `multipart/form-data` containing a `file` field with a ZIP archive
- **Response**: JSON payload describing imported pages, components, theme, and assets base path

## Request

Send the ZIP archive in a `file` form field. The archive must provide the following required files (either at root or inside a single top-level directory):

- `template.json`
- `schema.json`
- `preview.html`

All other assets (HTML, CSS, JS, images, fonts, media) will be imported when they use allowed extensions. Paths are validated to prevent directory traversal and unsupported files are skipped silently.

### Sample cURL

```bash
curl -X POST \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/template.zip" \
  https://<host>/api/templates/import-zip
```

## Successful Response

```json
{
  "success": true,
  "importId": "imp_ab12cd34",
  "pages": ["landing-page"],
  "components": ["landing-page-hero", "landing-page-pricing"],
  "theme": "theme-imp_ab12cd34",
  "assetsBase": "/uploads/u_demo/imp_ab12cd34/"
}
```

### Field Reference

- `success` (`boolean`): Always `true` on success.
- `importId` (`string`): Identifier generated for this import run; can be used in logs and monitoring.
- `pages` (`string[]`): Slugs of page templates persisted to the database or in-memory fallback cache.
- `components` (`string[]`): Slugs of component templates extracted heuristically from imported pages.
- `theme` (`string`): Theme slug created from extracted CSS tokens. Defaults to `default` when no theme is generated.
- `assetsBase` (`string`): Base path that frontends should prepend when referencing uploaded static assets.

## Validation Failure

The importer validates required files before processing. Missing files return HTTP `400` with structured details:

```json
{
  "success": false,
  "error": "Template ZIP validation failed",
  "details": [
    {
      "code": "missing-file",
      "file": "schema.json",
      "message": "Required file \"schema.json\" not found in archive",
      "description": "Schema metadata is missing"
    }
  ]
}
```

- `details` (`array`): Each entry describes a missing requirement.
- `code` (`string`): Currently only `missing-file`.
- `file` (`string`): The expected file name (case-insensitive).
- `message` (`string`): Machine-friendly error message.
- `description` (`string`): Human-facing context.

## Template Summary Endpoint

## Summary

- **Method**: GET
- **Path**: `/api/templates/summary`
- **Auth**: requires authenticated session
- **Query Params**:
  - `type` (`string`, optional): filter by template type (`component`, `page`, `theme`).
  - `engine` (`string`, optional): filter by rendering engine (`react`, `hbs`, etc.).
  - `tag` (`string`, optional): exact tag match。
  - `keyword` (`string`, optional): fuzzy match against名称/slug/摘要/标签。
  - `page` (`number`, optional, default 1)
  - `pageSize` (`number`, optional, default 20, max 60)

### Response

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "tpl_hero",
        "slug": "hero-banner",
        "name": "Hero Banner",
        "type": "component",
        "engine": "react",
        "version": "1.0.0",
        "tags": ["hero", "landing"],
        "summary": "适用于产品落地页的首屏展示模块",
        "keyFields": ["title", "subtitle", "cta"],
        "updatedAt": "2024-10-18T03:21:43.000Z"
      }
    ],
    "total": 42,
    "page": 1,
    "pageSize": 20,
    "hasNextPage": true,
    "cachedAt": "2024-10-18T03:22:01.123Z"
  }
}
```

- 响应头 `x-template-summary-cache`: 若命中缓存，包含缓存生成时间。

### Notes

- 列表数据由 `TemplateIndexService` 缓存，默认缓存 5 分钟，可通过后台手动刷新。
- `keyword` 同时匹配名称、slug、摘要与标签。
- 超过最大分页或缺失参数时会自动回退到默认值。

## Other Errors

Unexpected errors return HTTP `500` with the shape below. The `error` message mirrors the server log.

```json
{
  "success": false,
  "error": "Server error"
}
```

Logs include `importId`, `durationMs`, and stack traces for debugging. Failed imports emit the `template.import.failed` event which downstream consumers can observe for retries.

## Notes

- The importer skips entries with unsupported extensions or invalid paths (`__MACOSX`, directory traversal patterns, etc.).
- CSS files are aggregated for theme token extraction; extraction failures log warnings but do not fail the import.
- Successful imports emit the `template.imported` event, triggering downstream template index refresh.
- Check the server logs for `zipImporter.*` entries to trace processing stages.

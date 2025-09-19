export interface PromptImportPayload {
  name: string;
  rawText: string;
  tags?: string[];
}

export function parseJsonPrompts(content: string): PromptImportPayload[] {
  if (!content.trim()) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : '无法解析 JSON';
    throw new Error(`JSON 解析失败：${message}`);
  }

  const payloads = Array.isArray(parsed) ? parsed : [parsed];
  return sanitizePayloads(payloads);
}

export function parseMarkdownPrompts(markdown: string): PromptImportPayload[] {
  const content = markdown.replace(/\r\n/g, '\n').trim();
  if (!content) return [];

  const lines = content.split('\n');
  const sections: Array<{ title: string; lines: string[] }> = [];
  let current: { title: string; lines: string[] } | null = null;

  const flushSection = () => {
    if (current) {
      sections.push({ title: current.title.trim(), lines: current.lines });
      current = null;
    }
  };

  for (const line of lines) {
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      flushSection();
      current = { title: headingMatch[1], lines: [] };
    } else {
      if (!current) {
        current = { title: '', lines: [] };
      }
      current.lines.push(line);
    }
  }
  flushSection();

  if (sections.length === 0) {
    const firstLine = lines[0]?.trim() || '';
    const autoTitle = firstLine.slice(0, 48) || `prompt-${Date.now()}`;
    return [
      {
        name: autoTitle,
        rawText: content,
      },
    ];
  }

  return sections
    .map((section, index) => {
      const { title, lines: sectionLines } = section;
      let name = title.trim();
      const bodyLines: string[] = [];
      let tags: string[] = [];

      for (const rawLine of sectionLines) {
        const line = rawLine.trim();
        if (!line) {
          bodyLines.push(rawLine);
          continue;
        }

        const tagMatch = line.match(/^(?:tags?|标签)\s*[:：]\s*(.+)$/i);
        if (tagMatch) {
          tags = tagMatch[1]
            .split(/[,，]/)
            .map((item) => item.trim())
            .filter(Boolean);
          continue;
        }

        bodyLines.push(rawLine);
      }

      const rawText = bodyLines.join('\n').trim();
      if (!name) {
        const fallbackSource = rawText || `prompt-${Date.now()}-${index}`;
        name = fallbackSource.slice(0, 48);
      }

      if (!rawText) return null;

      return {
        name,
        rawText,
        tags,
      } as PromptImportPayload;
    })
    .filter((item): item is PromptImportPayload => Boolean(item));
}

export function chunkPromptPayloads(payloads: PromptImportPayload[], chunkSize = 20): PromptImportPayload[][] {
  const result: PromptImportPayload[][] = [];
  for (let index = 0; index < payloads.length; index += chunkSize) {
    result.push(payloads.slice(index, index + chunkSize));
  }
  return result;
}

function sanitizePayloads(payloads: unknown[]): PromptImportPayload[] {
  return payloads
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      const rawText = typeof record.rawText === 'string' ? record.rawText.trim() : '';
      const tagsRaw = Array.isArray(record.tags) ? record.tags : [];
      const tags = tagsRaw
        .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
        .filter(Boolean);

      if (!name || !rawText) {
        return null;
      }

      return {
        name,
        rawText,
        tags,
      } as PromptImportPayload;
    })
    .filter((item): item is PromptImportPayload => Boolean(item));
}

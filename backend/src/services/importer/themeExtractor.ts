// 从 CSS 文本中抽取 :root 中的 CSS 变量，形成 token 映射
export function extractThemeTokens(cssBundle: string) {
  const tokens: Record<string, string> = {};
  if (!cssBundle) return { tokens, css: '' };

  // 抓取 :root {...} 或 html {...} 中的 --var 声明
  const rootBlockRe = /(?:\:root|html)\s*\{([^}]*)\}/gms;
  let m: RegExpExecArray | null;
  const varRe = /--([a-zA-Z0-9_-]+)\s*:\s*([^;]+);/g;
  while ((m = rootBlockRe.exec(cssBundle))) {
    const block = m[1] || '';
    let vm: RegExpExecArray | null;
    while ((vm = varRe.exec(block))) {
      const k = vm[1].trim();
      const v = vm[2].trim();
      if (k) tokens[k] = v;
    }
  }

  const cssVars = Object.keys(tokens)
    .map(k => `  --${k}: ${tokens[k]};`)
    .join('\n');
  const css = cssVars ? `:root{\n${cssVars}\n}` : '';
  return { tokens, css };
}

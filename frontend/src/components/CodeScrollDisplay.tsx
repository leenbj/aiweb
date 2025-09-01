import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Code, Copy, Check, RefreshCw } from 'lucide-react';

interface CodeScrollDisplayProps {
  code: string;
  language?: string;
  maxLines?: number;
  className?: string;
  onCodeComplete?: (code: string) => void;
  title?: string;
  spinning?: boolean;
}

export const CodeScrollDisplay: React.FC<CodeScrollDisplayProps> = ({
  code,
  language = 'html',
  maxLines = 6,
  className = '',
  onCodeComplete,
  title,
  spinning
}) => {
  const [displayedLines, setDisplayedLines] = useState<string[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cacheLinesRef = useRef<string[]>([]);

  // ---------- Lightweight syntax highlighting ----------
  const escapeHtml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const getLangAlias = (lang?: string) => {
    const l = (lang || '').toLowerCase();
    if (!l) return 'html';
    if (['html', 'xml', 'xhtml'].includes(l)) return 'html';
    if (['js', 'javascript', 'jsx', 'ts', 'tsx', 'vue', 'svelte'].includes(l)) return 'js';
    if (['css', 'scss', 'less', 'stylus'].includes(l)) return 'css';
    return 'js';
  };

  const hlHTML = (s: string) => {
    let x = escapeHtml(s);
    x = x.replace(/&lt;!--([\s\S]*?)--&gt;/g, '<span class="text-green-400">&lt;!--$1--&gt;</span>');
    x = x.replace(/&lt;(\/)?([a-zA-Z0-9-]+)/g, (m, slash, name) => `&lt;${slash || ''}<span class="text-blue-300">${name}</span>`);
    x = x.replace(/([a-zA-Z_:][\w:.-]*)=("[^"]*"|'[^']*')/g, '<span class="text-amber-200">$1</span>=<span class="text-emerald-200">$2</span>');
    return x;
  };

  const jsKeywords = ['const','let','var','function','return','if','else','for','while','async','await','import','from','export','class','new','try','catch','finally','throw','switch','case','break','continue'];
  const hlJS = (s: string) => {
    let x = escapeHtml(s);
    x = x.replace(/\/\/.*$/gm, '<span class="text-gray-400">$&</span>');
    x = x.replace(/\/\*[\s\S]*?\*\//g, '<span class="text-gray-400">$&</span>');
    x = x.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '<span class="text-emerald-300">$&</span>');
    x = x.replace(/\b(0x[\da-fA-F]+|\d+\.?\d*)\b/g, '<span class="text-orange-300">$1</span>');
    const re = new RegExp('\\b(' + jsKeywords.join('|') + ')\\b', 'g');
    x = x.replace(re, '<span class="text-blue-300">$1</span>');
    return x;
  };

  const hlCSS = (s: string) => {
    let x = escapeHtml(s);
    x = x.replace(/\/\*[\s\S]*?\*\//g, '<span class="text-gray-400">$&</span>');
    x = x.replace(/([a-zA-Z-]+)\s*:\s*([^;]+);/g, '<span class="text-amber-200">$1</span>: <span class="text-emerald-200">$2</span>;');
    x = x.replace(/(^|\n)([^\{\n]+)\{/g, (m, p, sel) => `${p}<span class="text-purple-300">${escapeHtml(sel.trim())}</span>{`);
    return x;
  };

  const highlight = (line: string) => {
    const alias = getLangAlias(language);
    if (alias === 'html') return hlHTML(line);
    if (alias === 'css') return hlCSS(line);
    return hlJS(line);
  };

  // 分割代码为行（保留空行以便更贴近原始输出）
  const codeLines = code.split('\n');

  // 增量模式：代码变化时仅追加新增行，保持滚动体验
  useEffect(() => {
    const prevLines = cacheLinesRef.current;
    const prevLen = prevLines.length;
    const allLen = codeLines.length;
    if (allLen === 0) return;

    // 初次填充
    if (prevLen === 0) {
      cacheLinesRef.current = codeLines;
      setDisplayedLines(codeLines.slice(-maxLines));
      setCurrentLineIndex(allLen);
    } else if (allLen > prevLen) {
      // 行数增加：只追加新增行
      const append = codeLines.slice(prevLen);
      cacheLinesRef.current = codeLines;
      setCurrentLineIndex(allLen);
      setDisplayedLines(prev => {
        const merged = [...prev, ...append];
        return merged.slice(-maxLines);
      });
    } else {
      // 行数未变：若最后一行内容发生变化（没有换行的持续追加），则更新最后一行
      const last = allLen - 1;
      if (last >= 0 && (prevLines[last] !== codeLines[last])) {
        cacheLinesRef.current = codeLines;
        setCurrentLineIndex(allLen);
        setDisplayedLines(prev => {
          const startIndex = Math.max(0, allLen - maxLines);
          return codeLines.slice(startIndex, allLen);
        });
      }
    }

    // 自动滚动到底部
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }

    if (onCodeComplete && currentLineIndex >= allLen && code && code.length > 0) {
      const t = setTimeout(() => onCodeComplete(code), 300);
      return () => clearTimeout(t);
    }
  }, [code, codeLines, maxLines, onCodeComplete, currentLineIndex]);

  // 若 code 被清空，重置
  useEffect(() => {
    if (!code) {
      cacheLinesRef.current = [];
      setDisplayedLines([]);
      setCurrentLineIndex(0);
    }
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  if (!code || codeLines.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-2xl border border-gray-200 overflow-hidden bg-white ${className}`}
      style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}
    >
      {/* 头部（白色卡片风格） */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2 text-gray-400">
          {spinning ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Code className="w-3.5 h-3.5" />
          )}
          <span className="text-sm">
            {title ? title : `Writing ${language.toUpperCase()}…`}
          </span>
          <div className="text-xs text-gray-400">{currentLineIndex}/{codeLines.length}</div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" />
              已复制
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              复制
            </>
          )}
        </button>
      </div>

      {/* 代码展示区 */}
      <div 
        ref={scrollRef}
        className="h-32 overflow-y-auto font-mono text-sm code-scroll"
        style={{ lineHeight: '1.6' }}
      >
        <div className="p-4">
          {displayedLines.map((line, index) => (
            <motion.div
              key={`${currentLineIndex - displayedLines.length + index}`}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3 }}
              className="text-gray-900 whitespace-pre-wrap mb-1"
            >
              <span className="text-gray-500 text-xs mr-3 inline-block w-6 text-right">
                {currentLineIndex - displayedLines.length + index + 1}
              </span>
              <span className="" dangerouslySetInnerHTML={{ __html: highlight(line) }} />
            </motion.div>
          ))}
          
          {/* 显示输入光标 */}
          {currentLineIndex < codeLines.length && (
            <div className="flex items-center">
              <span className="text-gray-500 text-xs mr-3 inline-block w-6 text-right">
                {currentLineIndex + 1}
              </span>
              <span className="inline-block w-2 h-4 bg-green-400 animate-pulse"></span>
            </div>
          )}
        </div>
      </div>

      {/* 底部状态 */}
      <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>代码正在生成中…</span>
          <div className="flex items-center gap-1">
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                className="w-1 h-1 bg-emerald-400 rounded-full"
                animate={{
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2
                }}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default CodeScrollDisplay;

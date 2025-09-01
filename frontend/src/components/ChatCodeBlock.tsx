import React, { useMemo } from 'react'
import { Code, Copy, Check } from 'lucide-react'

function escapeHtml(str: string) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function highlightHTML(code: string) {
  let s = escapeHtml(code)
  // comments
  s = s.replace(/&lt;!--([\s\S]*?)--&gt;/g, '<span class="text-green-400">&lt;!--$1--&gt;</span>')
  // tag name
  s = s.replace(/&lt;(\/)?([a-zA-Z0-9-]+)/g, (m, slash, name) => `&lt;${slash || ''}<span class="text-blue-300">${name}</span>`)
  // attributes name="value"
  s = s.replace(/([a-zA-Z_:][\w:.-]*)=("[^"]*"|'[^']*')/g, '<span class="text-amber-200">$1</span>=<span class="text-emerald-200">$2</span>')
  return s
}

const jsKeywords = ['const','let','var','function','return','if','else','for','while','async','await','import','from','export','class','new','try','catch','finally','throw','switch','case','break','continue']
function highlightJS(code: string) {
  let s = escapeHtml(code)
  // comments
  s = s.replace(/\/\/.*$/gm, '<span class="text-gray-400">$&</span>')
  s = s.replace(/\/\*[\s\S]*?\*\//g, '<span class="text-gray-400">$&</span>')
  // strings
  s = s.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '<span class="text-emerald-300">$&</span>')
  // numbers
  s = s.replace(/\b(0x[\da-fA-F]+|\d+\.?\d*)\b/g, '<span class="text-orange-300">$1</span>')
  // keywords
  const re = new RegExp('\\b(' + jsKeywords.join('|') + ')\\b', 'g')
  s = s.replace(re, '<span class="text-blue-300">$1</span>')
  return s
}

function highlightCSS(code: string) {
  let s = escapeHtml(code)
  // comments
  s = s.replace(/\/\*[\s\S]*?\*\//g, '<span class="text-gray-400">$&</span>')
  // property: value;
  s = s.replace(/([a-zA-Z-]+)\s*:\s*([^;]+);/g, '<span class="text-amber-200">$1</span>: <span class="text-emerald-200">$2</span>;')
  // selectors (very naive)
  s = s.replace(/(^|\n)([^\{\n]+)\{/g, (m, p, sel) => `${p}<span class="text-purple-300">${sel.trim()}</span>{`)
  return s
}

function getLangAlias(lang?: string) {
  const l = (lang || '').toLowerCase()
  if (!l) return 'html'
  if (['html','xml','xhtml'].includes(l)) return 'html'
  if (['js','javascript','jsx','ts','tsx','vue','svelte'].includes(l)) return 'js'
  if (['css','scss','less','stylus'].includes(l)) return 'css'
  return 'js'
}

export default function ChatCodeBlock({ code, language }: { code: string; language?: string }) {
  const lang = getLangAlias(language)
  const highlighted = useMemo(() => {
    if (lang === 'html') return highlightHTML(code)
    if (lang === 'css') return highlightCSS(code)
    return highlightJS(code)
  }, [code, lang])

  const [copied, setCopied] = React.useState(false)
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(()=>setCopied(false),1500) } catch {}
  }

  return (
    <div className="bg-gray-900 rounded border border-gray-700 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Code className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-xs text-gray-300 font-medium">{(language || 'code').toUpperCase()}</span>
        </div>
        <button onClick={handleCopy} className="flex items-center gap-1 px-2 py-0.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded">
          {copied ? (<><Check className="w-3 h-3" />已复制</>) : (<><Copy className="w-3 h-3" />复制</>)}
        </button>
      </div>
      <div className="max-h-32 overflow-auto p-3 font-mono text-[12px] leading-5" dangerouslySetInnerHTML={{ __html: highlighted }} />
    </div>
  )
}


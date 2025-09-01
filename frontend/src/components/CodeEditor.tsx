import React, { useRef, useEffect, useState } from 'react';
import Editor from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

// 传统代码配色主题配置
const traditionalTheme: monaco.editor.IStandaloneThemeData = {
  base: 'vs' as monaco.editor.BuiltinTheme,
  inherit: true,
  rules: [
    // 关键字 - 深蓝色
    { token: 'keyword', foreground: '0000FF', fontStyle: 'bold' },
    { token: 'keyword.control', foreground: '0000FF', fontStyle: 'bold' },
    { token: 'keyword.operator', foreground: '0000FF', fontStyle: 'bold' },

    // 类型和类名 - 深绿色
    { token: 'type', foreground: '008000', fontStyle: 'bold' },
    { token: 'type.identifier', foreground: '008000', fontStyle: 'bold' },
    { token: 'class', foreground: '008000', fontStyle: 'bold' },

    // 函数名 - 深紫色
    { token: 'function', foreground: '800080', fontStyle: 'bold' },
    { token: 'method', foreground: '800080', fontStyle: 'bold' },

    // 变量名 - 黑色
    { token: 'variable', foreground: '000000' },
    { token: 'variable.name', foreground: '000000' },
    { token: 'identifier', foreground: '000000' },

    // 字符串 - 褐色
    { token: 'string', foreground: '8B4513' },
    { token: 'string.quote', foreground: '8B4513' },

    // 数字 - 深红色
    { token: 'number', foreground: 'FF0000' },
    { token: 'number.hex', foreground: 'FF0000' },

    // 注释 - 绿色
    { token: 'comment', foreground: '008000', fontStyle: 'italic' },

    // 运算符 - 黑色
    { token: 'operator', foreground: '000000' },
    { token: 'delimiter', foreground: '000000' },

    // 括号 - 深灰色
    { token: 'delimiter.parenthesis', foreground: '666666' },
    { token: 'delimiter.bracket', foreground: '666666' },
    { token: 'delimiter.curly', foreground: '666666' },

    // HTML标签 - 深蓝色
    { token: 'tag', foreground: '000080', fontStyle: 'bold' },
    { token: 'tag.html', foreground: '000080', fontStyle: 'bold' },
    { token: 'attribute.name', foreground: 'FF6600' },
    { token: 'attribute.value', foreground: '008000' },

    // CSS属性 - 深蓝色
    { token: 'attribute.name.css', foreground: '0000FF' },
    { token: 'attribute.value.css', foreground: '800080' },

    // 错误和警告
    { token: 'invalid', foreground: 'FF0000', fontStyle: 'bold underline' },
    { token: 'error-token', foreground: 'FF0000', fontStyle: 'bold' },
    { token: 'warning-token', foreground: 'FFA500', fontStyle: 'bold' },

    // 转义字符 - 深红色
    { token: 'string.escape', foreground: 'FF0000' },

    // 预处理器 - 深紫色
    { token: 'predefined', foreground: '800080' },
    { token: 'namespace', foreground: '800080' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.foreground': '#000000',
    'editor.lineHighlightBackground': '#F0F0F0',
    'editor.selectionBackground': '#ADD6FF',
    'editor.inactiveSelectionBackground': '#E5EBF1',
    'editorCursor.foreground': '#000000',
    'editorWhitespace.foreground': '#CCCCCC',
    'editorIndentGuide.background': '#E5E5E5',
    'editorLineNumber.foreground': '#999999',
    'editorLineNumber.activeForeground': '#666666',
  }
};

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  height?: string;
  theme?: string;
  readOnly?: boolean;
  minimap?: boolean;
  lineNumbers?: 'on' | 'off' | 'relative' | 'interval';
  typewriterMode?: boolean;
  typewriterSpeed?: number;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = 'html',
  height = '100%',
  theme = 'traditional',
  readOnly = false,
  minimap = true,
  lineNumbers = 'on',
  typewriterMode = false,
  typewriterSpeed = 30,
}) => {
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const [displayedValue, setDisplayedValue] = useState(value);
  const [isTyping, setIsTyping] = useState(false);
  const typewriterTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastValueRef = useRef(value);

  // 打字机效果处理
  useEffect(() => {
    if (!typewriterMode || value === lastValueRef.current) {
      setDisplayedValue(value);
      return;
    }

    // 清除之前的定时器
    if (typewriterTimeoutRef.current) {
      clearTimeout(typewriterTimeoutRef.current);
    }

    setIsTyping(true);
    let currentIndex = displayedValue.length;
    const targetValue = value;
    lastValueRef.current = value;

    const typeNextCharacter = () => {
      if (currentIndex < targetValue.length) {
        setDisplayedValue(targetValue.substring(0, currentIndex + 1));
        currentIndex++;
        
        // 计算延迟时间，对于换行符和空格稍快一些
        const char = targetValue[currentIndex - 1];
        let delay = typewriterSpeed;
        if (char === '\n' || char === ' ' || char === '\t') {
          delay = Math.max(5, typewriterSpeed * 0.3);
        } else if (char === '<' || char === '>') {
          delay = Math.max(10, typewriterSpeed * 0.5);
        }
        
        typewriterTimeoutRef.current = setTimeout(typeNextCharacter, delay);
      } else {
        setIsTyping(false);
      }
    };

    typeNextCharacter();

    return () => {
      if (typewriterTimeoutRef.current) {
        clearTimeout(typewriterTimeoutRef.current);
      }
    };
  }, [value, typewriterMode, typewriterSpeed]);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor) => {
    editorRef.current = editor;

    // 注册传统主题
    monaco.editor.defineTheme('traditional', traditionalTheme);

    // 设置主题
    monaco.editor.setTheme(theme);

    // Configure editor
    editor.updateOptions({
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      lineHeight: 1.5,
      wordWrap: 'on',
      automaticLayout: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: minimap },
      lineNumbers,
      renderWhitespace: 'selection',
      bracketPairColorization: { enabled: true },
      guides: {
        bracketPairs: true,
        indentation: true,
      },
    });

    // Add custom HTML snippets and autocomplete
    if (language === 'html') {
      monaco.languages.registerCompletionItemProvider('html', {
        provideCompletionItems: (_model, position) => {
          const suggestions = [
            {
              label: 'html5',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }
    </style>
</head>
<body>
    <h1>Welcome</h1>
    <p>Start building your website here.</p>
</body>
</html>`,
              documentation: 'Basic HTML5 template',
              range: new monaco.Range(
                position.lineNumber,
                1,
                position.lineNumber,
                position.column
              ),
            },
            {
              label: 'responsive-nav',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: `<nav style="background-color: #333; padding: 1rem;">
    <div style="max-width: 1200px; margin: 0 auto; display: flex; justify-content: space-between; align-items: center;">
        <div style="color: white; font-size: 1.5rem; font-weight: bold;">Logo</div>
        <ul style="list-style: none; display: flex; margin: 0; padding: 0; gap: 2rem;">
            <li><a href="#" style="color: white; text-decoration: none;">Home</a></li>
            <li><a href="#" style="color: white; text-decoration: none;">About</a></li>
            <li><a href="#" style="color: white; text-decoration: none;">Services</a></li>
            <li><a href="#" style="color: white; text-decoration: none;">Contact</a></li>
        </ul>
    </div>
</nav>`,
              documentation: 'Responsive navigation bar',
              range: new monaco.Range(
                position.lineNumber,
                1,
                position.lineNumber,
                position.column
              ),
            },
            {
              label: 'hero-section',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: `<section style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 100px 20px; text-align: center;">
    <div style="max-width: 800px; margin: 0 auto;">
        <h1 style="font-size: 3rem; margin-bottom: 1rem;">Welcome to Our Website</h1>
        <p style="font-size: 1.2rem; margin-bottom: 2rem;">Discover amazing features and services that will transform your business</p>
        <button style="background-color: white; color: #667eea; border: none; padding: 15px 30px; font-size: 1.1rem; border-radius: 5px; cursor: pointer;">Get Started</button>
    </div>
</section>`,
              documentation: 'Hero section with gradient background',
              range: new monaco.Range(
                position.lineNumber,
                1,
                position.lineNumber,
                position.column
              ),
            },
            {
              label: 'card-grid',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: `<section style="padding: 80px 20px;">
    <div style="max-width: 1200px; margin: 0 auto;">
        <h2 style="text-align: center; margin-bottom: 3rem; font-size: 2.5rem;">Our Services</h2>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
            <div style="background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center;">
                <h3 style="margin-bottom: 1rem; color: #333;">Service One</h3>
                <p style="color: #666; line-height: 1.6;">Description of your first service and its benefits.</p>
            </div>
            <div style="background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center;">
                <h3 style="margin-bottom: 1rem; color: #333;">Service Two</h3>
                <p style="color: #666; line-height: 1.6;">Description of your second service and its benefits.</p>
            </div>
            <div style="background: white; padding: 2rem; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.1); text-align: center;">
                <h3 style="margin-bottom: 1rem; color: #333;">Service Three</h3>
                <p style="color: #666; line-height: 1.6;">Description of your third service and its benefits.</p>
            </div>
        </div>
    </div>
</section>`,
              documentation: 'Responsive card grid layout',
              range: new monaco.Range(
                position.lineNumber,
                1,
                position.lineNumber,
                position.column
              ),
            },
          ];

          return { suggestions };
        },
      });
    }

    // Focus the editor
    editor.focus();
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      onChange(value);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // You can add save functionality here
        console.log('Save triggered');
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        // Undo is handled by Monaco by default
      }

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'Z') {
        // Redo is handled by Monaco by default
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
    readOnly,
    fontSize: 14,
    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
    lineHeight: 1.5,
    wordWrap: 'on',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    minimap: { enabled: minimap },
    lineNumbers,
    renderWhitespace: 'selection',
    bracketPairColorization: { enabled: true },
    guides: {
      bracketPairs: true,
      indentation: true,
    },
    suggestOnTriggerCharacters: true,
    acceptSuggestionOnEnter: 'on',
    tabCompletion: 'on',
    wordBasedSuggestions: true,
    formatOnPaste: true,
    formatOnType: true,
  };

  return (
    <div className="h-full w-full border rounded-lg overflow-hidden relative">
      <Editor
        height={height}
        language={language}
        theme={theme}
        value={typewriterMode ? displayedValue : value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={editorOptions}
        loading={
          <div className="flex items-center justify-center h-full">
            <div className="loading-spinner mr-2" />
            <span>正在加载传统代码编辑器...</span>
          </div>
        }
      />

      {/* 打字机效果状态指示器 */}
      {typewriterMode && isTyping && (
        <div className="absolute top-2 right-2 bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs flex items-center space-x-1 z-10">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
          <span>AI实时生成中...</span>
        </div>
      )}

      {/* 打字光标效果 */}
      {typewriterMode && isTyping && (
        <style dangerouslySetInnerHTML={{
          __html: `
            .monaco-editor .cursors-layer .cursor {
              animation: blink 1s infinite;
              background-color: #007ACC !important;
              width: 2px !important;
            }
            @keyframes blink {
              0%, 50% { opacity: 1; }
              51%, 100% { opacity: 0; }
            }
          `
        }} />
      )}

      {/* 传统主题提示 */}
      {theme === 'traditional' && (
        <div className="absolute bottom-2 left-2 bg-green-100 text-green-800 px-2 py-1 rounded text-xs z-10">
          <span>已启用传统代码配色</span>
        </div>
      )}
    </div>
  );
};
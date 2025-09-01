import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Code, FileCode, Loader2, CheckCircle, Minimize2, X } from 'lucide-react';

interface CodeGenerationWindowProps {
  isGenerating: boolean;
  generatedCode: string;
  onCodeComplete?: (code: string) => void;
  onClose?: () => void;
  className?: string;
}

// 模拟代码生成过程的组件
export const CodeGenerationWindow: React.FC<CodeGenerationWindowProps> = ({
  isGenerating,
  generatedCode,
  onCodeComplete,
  onClose,
  className = ''
}) => {
  const [displayedCode, setDisplayedCode] = useState('');
  const [currentFile, setCurrentFile] = useState('index.html');
  const [isMinimized, setIsMinimized] = useState(false);
  const codeRef = useRef<HTMLDivElement>(null);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);

  // 模拟的代码生成流程
  useEffect(() => {
    if (!isGenerating || !generatedCode) {
      setDisplayedCode('');
      return;
    }

    setDisplayedCode('');
    let currentIndex = 0;
    
    const typeNextCharacter = () => {
      if (currentIndex < generatedCode.length) {
        setDisplayedCode(generatedCode.substring(0, currentIndex + 1));
        currentIndex++;
        
        // 自动滚动到底部
        if (codeRef.current) {
          codeRef.current.scrollTop = codeRef.current.scrollHeight;
        }
        
        // 调整打字速度，对于标签和关键字慢一些
        const char = generatedCode[currentIndex - 1];
        let delay = 15;
        if (char === '<' || char === '>') {
          delay = 50;
        } else if (char === '\n') {
          delay = 100;
        }
        
        typewriterRef.current = setTimeout(typeNextCharacter, delay);
      } else {
        // 代码生成完成
        onCodeComplete?.(generatedCode);
      }
    };

    // 开始打字效果
    typewriterRef.current = setTimeout(typeNextCharacter, 500);

    return () => {
      if (typewriterRef.current) {
        clearTimeout(typewriterRef.current);
      }
    };
  }, [isGenerating, generatedCode, onCodeComplete]);

  if (!isGenerating && !displayedCode) {
    return null;
  }

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 100, opacity: 0 }}
      className={`fixed bottom-4 right-4 bg-white border border-gray-300 rounded-xl shadow-lg overflow-hidden z-50 ${className}`}
      style={{ 
        width: isMinimized ? '320px' : '480px', 
        height: isMinimized ? '60px' : '320px' 
      }}
    >
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            {isGenerating ? (
              <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
            ) : (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            <span className="text-sm font-medium text-gray-700">
              {isGenerating ? 'Writing' : 'Generated'} /{currentFile}
            </span>
          </div>
          {isGenerating && (
            <div className="flex space-x-1">
              {[0, 1, 2].map(i => (
                <div 
                  key={i}
                  className="w-1 h-1 bg-blue-500 rounded-full animate-pulse"
                  style={{ animationDelay: `${i * 0.2}s` }}
                />
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          >
            <Minimize2 className="w-3 h-3" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* 代码内容 */}
      {!isMinimized && (
        <div className="h-full flex flex-col">
          <div 
            ref={codeRef}
            className="flex-1 p-4 font-mono text-sm overflow-y-auto bg-gray-900 text-gray-100"
          >
            <pre className="whitespace-pre-wrap">
              <code className="text-gray-100">
                {displayedCode}
                {isGenerating && (
                  <span className="inline-block w-2 h-4 bg-green-400 ml-1 animate-pulse rounded-sm" />
                )}
              </code>
            </pre>
          </div>
          
          {/* 底部状态栏 */}
          <div className="px-4 py-2 bg-gray-800 border-t border-gray-700">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                {displayedCode.split('\n').length} lines
              </span>
              <span className="text-gray-400">
                {displayedCode.length} characters
              </span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default CodeGenerationWindow;

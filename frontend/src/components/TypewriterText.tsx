import React, { useState, useEffect } from 'react';
import CodeScrollDisplay from './CodeScrollDisplay';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  isStreaming?: boolean;
  className?: string;
  onCodeComplete?: (code: string) => void;
}

export const TypewriterText: React.FC<TypewriterTextProps> = ({ 
  text, 
  speed = 20, 
  isStreaming = false, 
  className = '',
  onCodeComplete
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (!text) return;
    
    if (isStreaming) {
      // 如果正在流式输出，直接显示全部文本
      setDisplayedText(text);
      setCurrentIndex(text.length);
    } else {
      // 如果不是流式输出，使用打字机效果
      if (currentIndex < text.length) {
        const timer = setTimeout(() => {
          setDisplayedText(text.slice(0, currentIndex + 1));
          setCurrentIndex(currentIndex + 1);
        }, speed);
        
        return () => clearTimeout(timer);
      }
    }
  }, [text, currentIndex, speed, isStreaming]);

  useEffect(() => {
    // 当text改变时，重置状态
    if (!isStreaming) {
      setDisplayedText('');
      setCurrentIndex(0);
    }
  }, [text, isStreaming]);

  // 检测是否包含HTML代码块
  const htmlCodeMatch = displayedText.match(/```html\n([\s\S]*?)```/);
  const hasHtmlCode = htmlCodeMatch && htmlCodeMatch[1];

  // 分离文本和代码部分 - 完全移除代码块内容
  let textPart = displayedText;
  if (hasHtmlCode) {
    textPart = displayedText.replace(/```html\n([\s\S]*?)```/, '[代码已在下方代码框中展示]').trim();
  }

  return (
    <div className={className}>
      {/* 普通文本部分 */}
      <span>
        {textPart}
        {(isStreaming || currentIndex < text.length) && !hasHtmlCode && (
          <span className="inline-block w-0.5 h-4 bg-blue-500 ml-1 animate-pulse" />
        )}
      </span>
      
      {/* 代码滚动显示部分 */}
      {hasHtmlCode && (
        <div className="mt-4">
          <CodeScrollDisplay 
            code={hasHtmlCode} 
            language="html" 
            className="max-w-full"
            onCodeComplete={onCodeComplete}
          />
        </div>
      )}
    </div>
  );
};
import React, { useState, useRef, useCallback, useEffect } from 'react';
import AIAssistant from './AIAssistant';

interface ResizableAIChatProps {
  websiteId?: string;
  onWebsiteGenerated?: (website: any, content: string) => void;
  onWebsiteUpdated?: (content: string) => void;
  onGenerationProgress?: (progress: number, stage: string, partialCode?: string) => void;
  onCodeStreamUpdate?: (code: string) => void;
  onGenerationStart?: () => void;
  onGenerationEnd?: () => void;
  minWidth?: number;
  maxWidth?: number;
  defaultWidth?: number;
}

export const ResizableAIChat: React.FC<ResizableAIChatProps> = ({
  websiteId: _websiteId,
  onWebsiteGenerated: _onWebsiteGenerated,
  onWebsiteUpdated: _onWebsiteUpdated,
  onGenerationProgress: _onGenerationProgress,
  onCodeStreamUpdate,
  onGenerationStart,
  onGenerationEnd,
  minWidth = 280,
  maxWidth = 600,
  defaultWidth = 400,
}) => {
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = containerRect.right - e.clientX;
      
      // 限制宽度范围
      const clampedWidth = Math.max(minWidth, Math.min(maxWidth, newWidth));
      setWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [minWidth, maxWidth]);

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setWidth(prev => Math.max(minWidth, prev - 20));
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          setWidth(prev => Math.min(maxWidth, prev + 20));
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [minWidth, maxWidth]);

  return (
    <div 
      ref={containerRef}
      className="flex-shrink-0 relative"
      style={{ width: `${width}px` }}
    >
      {/* 调整宽度的拖拽手柄 */}
      <div
        ref={resizeRef}
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-10 group ${
          isResizing ? 'bg-blue-500' : 'bg-gray-200 hover:bg-blue-400'
        } transition-colors duration-200`}
        onMouseDown={handleMouseDown}
        title="拖拽调整AI面板宽度 (Ctrl+←/→ 调整)"
      >
        {/* 拖拽指示器 */}
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 
          w-3 h-8 bg-white border border-gray-300 rounded-sm shadow-sm
          flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity
          ${isResizing ? 'opacity-100' : ''}`}>
          <div className="w-0.5 h-4 bg-gray-400 mr-0.5"></div>
          <div className="w-0.5 h-4 bg-gray-400"></div>
        </div>
      </div>

      {/* AI聊天面板 */}
      <div className="h-full ml-1">
        <AIAssistant
          onCodeUpdate={onCodeStreamUpdate}
          onGenerationStart={onGenerationStart}
          onGenerationEnd={onGenerationEnd}
          className="h-full"
        />
      </div>

      {/* 宽度指示器 (在调整时显示) */}
      {isResizing && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 
          bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded z-20">
          {width}px
        </div>
      )}
    </div>
  );
};
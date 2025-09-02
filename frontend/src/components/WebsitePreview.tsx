import React, { useRef, useEffect, useState } from 'react';
import { RefreshCw, ExternalLink, AlertTriangle } from 'lucide-react';

interface WebsitePreviewProps {
  content: string;
  onContentChange?: (content: string) => void;
  selectedElement?: string | null;
  onElementSelect?: (element: string | null) => void;
  className?: string;
}

export const WebsitePreview: React.FC<WebsitePreviewProps> = ({
  content,
  onContentChange,
  selectedElement,
  onElementSelect,
  className = '',
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [lastContent, setLastContent] = useState('');

  const updatePreview = () => {
    if (!iframeRef.current) return;

    try {
      setIsLoading(true);
      setHasError(false);

      const iframe = iframeRef.current;
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      
      if (!doc) {
        setHasError(true);
        setIsLoading(false);
        return;
      }

      console.log('WebsitePreview: Updating content', {
        contentLength: content.length,
        isFullHTML: content.includes('<!DOCTYPE') || content.includes('<html'),
        hasHTMLTag: content.includes('<html'),
        hasBodyTag: content.includes('<body'),
        preview: content.substring(0, 200) + '...'
      });

      // 处理内容逻辑改进
      let finalContent = content.trim();

      // 兜底清洗：移除可能残留的Markdown代码围栏与语言标记
      // 例如：```html ... ``` 或者 去掉围栏后残留的开头“html”
      finalContent = finalContent
        // 去掉起始围栏 ```html 或 ```
        .replace(/^```(?:html)?\s*\r?\n?/i, '')
        // 去掉结束围栏 ```
        .replace(/\r?\n?\s*```\s*$/i, '')
        // 如果开头意外残留“html”，且后面紧跟HTML起始结构，则移除
        .replace(/^\s*html\s*(?=(<!DOCTYPE|<html|<head|<body))/i, '');
      
      // 如果内容为空，显示默认页面
      if (!finalContent) {
        finalContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>空白页面</title>
    <style>
        body {
            margin: 0;
            padding: 40px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            text-align: center;
            color: #6b7280;
        }
    </style>
</head>
<body>
    <h2>等待AI生成内容...</h2>
    <p>请在左侧输入您想要创建的网站描述</p>
</body>
</html>`;
      }
      // 如果内容已经是完整的HTML文档，直接使用
      else if (finalContent.includes('<!DOCTYPE') || finalContent.includes('<html')) {
        console.log('WebsitePreview: Content is full HTML document, using directly');
        
        // 确保添加编辑功能的JavaScript
        if (!content.includes('makeEditable')) {
          // 在</body>前添加编辑脚本
          const editScript = `
<script>
  function makeEditable() {
    const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, button, div[class*="text"], [contenteditable="true"]';
    const elements = document.querySelectorAll(editableSelectors);
    
    elements.forEach((element, index) => {
      if (!element.id) {
        element.id = 'editable-' + index;
      }
      
      element.classList.add('editable-element');
      
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON'].includes(element.tagName)) {
        element.contentEditable = 'true';
      }
      
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        document.querySelectorAll('.editable-element.selected').forEach(el => {
          el.classList.remove('selected');
        });
        
        element.classList.add('selected');
        
        window.parent.postMessage({
          type: 'elementSelected',
          elementId: element.id,
          tagName: element.tagName,
          content: element.innerText || element.innerHTML
        }, '*');
      });
      
      element.addEventListener('input', (e) => {
        window.parent.postMessage({
          type: 'contentChanged',
          elementId: element.id,
          content: element.innerHTML,
          fullHTML: document.documentElement.outerHTML
        }, '*');
      });
      
      element.addEventListener('blur', (e) => {
        window.parent.postMessage({
          type: 'contentFinalized',
          fullHTML: document.documentElement.outerHTML
        }, '*');
      });
    });
  }
  
  // 添加编辑样式
  const editStyles = document.createElement('style');
  editStyles.textContent = \`
    .editable-element {
      outline: none;
      transition: box-shadow 0.2s ease;
    }
    
    .editable-element:hover {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
      cursor: pointer;
    }
    
    .editable-element.selected {
      box-shadow: 0 0 0 2px #3b82f6;
    }
  \`;
  document.head.appendChild(editStyles);
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', makeEditable);
  } else {
    makeEditable();
  }
  
  window.addEventListener('message', (event) => {
    if (event.data.type === 'selectElement' && event.data.elementId) {
      const element = document.getElementById(event.data.elementId);
      if (element) {
        document.querySelectorAll('.editable-element.selected').forEach(el => {
          el.classList.remove('selected');
        });
        element.classList.add('selected');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
  
  document.addEventListener('dragstart', (e) => e.preventDefault());
  
  window.parent.postMessage({ type: 'previewReady' }, '*');
</script>`;
          
          if (content.includes('</body>')) {
            finalContent = content.replace('</body>', editScript + '\n</body>');
          } else {
            finalContent = content + editScript;
          }
        } else {
          finalContent = content;
        }
      } else {
        // 如果不是完整HTML，按原逻辑处理
        console.log('WebsitePreview: Content is partial, wrapping in full HTML');
        
        // Extract body content if content contains body tags
        let bodyContent = content;
        if (content.includes('<body')) {
          const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
          if (bodyMatch) {
            bodyContent = bodyMatch[1];
          }
        }

        // Create enhanced HTML with editing capabilities
        finalContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <style>
    * {
      box-sizing: border-box;
    }
    
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
      line-height: 1.5;
    }
    
    .editable-element {
      outline: none;
      transition: box-shadow 0.2s ease;
    }
    
    .editable-element:hover {
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.3);
      cursor: pointer;
    }
    
    .editable-element.selected {
      box-shadow: 0 0 0 2px #3b82f6;
    }
    
    @media (max-width: 768px) {
      body {
        font-size: 14px;
      }
    }
  </style>
</head>
<body>
${bodyContent}

<script>
  function makeEditable() {
    const editableSelectors = 'h1, h2, h3, h4, h5, h6, p, span, a, button, div[class*="text"], [contenteditable="true"]';
    const elements = document.querySelectorAll(editableSelectors);
    
    elements.forEach((element, index) => {
      if (!element.id) {
        element.id = 'editable-' + index;
      }
      
      element.classList.add('editable-element');
      
      if (['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'BUTTON'].includes(element.tagName)) {
        element.contentEditable = 'true';
      }
      
      element.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        document.querySelectorAll('.editable-element.selected').forEach(el => {
          el.classList.remove('selected');
        });
        
        element.classList.add('selected');
        
        window.parent.postMessage({
          type: 'elementSelected',
          elementId: element.id,
          tagName: element.tagName,
          content: element.innerText || element.innerHTML
        }, '*');
      });
      
      element.addEventListener('input', (e) => {
        window.parent.postMessage({
          type: 'contentChanged',
          elementId: element.id,
          content: element.innerHTML,
          fullHTML: document.documentElement.outerHTML
        }, '*');
      });
      
      element.addEventListener('blur', (e) => {
        window.parent.postMessage({
          type: 'contentFinalized',
          fullHTML: document.documentElement.outerHTML
        }, '*');
      });
    });
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', makeEditable);
  } else {
    makeEditable();
  }
  
  window.addEventListener('message', (event) => {
    if (event.data.type === 'selectElement' && event.data.elementId) {
      const element = document.getElementById(event.data.elementId);
      if (element) {
        document.querySelectorAll('.editable-element.selected').forEach(el => {
          el.classList.remove('selected');
        });
        element.classList.add('selected');
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  });
  
  document.addEventListener('dragstart', (e) => e.preventDefault());
  
  window.parent.postMessage({ type: 'previewReady' }, '*');
</script>
</body>
</html>`;
      }

      console.log('WebsitePreview: Writing content to iframe', {
        finalContentLength: finalContent.length,
        preview: finalContent.substring(0, 300) + '...'
      });

      doc.open();
      doc.write(finalContent);
      doc.close();
      
      // 检查是否有有效内容被写入
      setTimeout(() => {
        const body = doc.body;
        if (body && (body.innerHTML.trim() || body.textContent?.trim())) {
          console.log('WebsitePreview: Content successfully loaded');
          setLastContent(content);
          setIsLoading(false);
        } else {
          console.warn('WebsitePreview: No content in body, might be an issue');
          setLastContent(content);
          setIsLoading(false);
        }
      }, 100);
    } catch (error) {
      console.error('Preview update error:', error);
      setHasError(true);
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (content !== lastContent) {
      const timeoutId = setTimeout(() => {
        updatePreview();
      }, 300);
      
      return () => clearTimeout(timeoutId);
    }
  }, [content, lastContent]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      
      switch (event.data.type) {
        case 'previewReady':
          setIsLoading(false);
          if (selectedElement) {
            iframeRef.current?.contentWindow?.postMessage({
              type: 'selectElement',
              elementId: selectedElement
            }, '*');
          }
          break;
          
        case 'elementSelected':
          onElementSelect?.(event.data.elementId);
          break;
          
        case 'contentChanged':
          if (onContentChange) {
            const updatedContent = content.replace(
              new RegExp(`<[^>]*id="${event.data.elementId}"[^>]*>.*?</[^>]*>`, 'g'),
              (match) => {
                return match.replace(/>.*?</, `>${event.data.content}<`);
              }
            );
            onContentChange(updatedContent);
          }
          break;
          
        case 'contentFinalized':
          if (onContentChange && event.data.fullHTML) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(event.data.fullHTML, 'text/html');
            const bodyContent = doc.body.innerHTML;
            
            const cleanContent = bodyContent
              .replace(/class="[^"]*editable-element[^"]*"/g, '')
              .replace(/contenteditable="true"/g, '')
              .replace(/\s+class=""/g, '')
              .replace(/\s+class="\s*"/g, '')
              .replace(/id="editable-\d+"/g, '')
              .trim();
              
            onContentChange(cleanContent);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedElement, onElementSelect, onContentChange, content]);

  const handleRefresh = () => {
    setIsLoading(true);
    setHasError(false);
    updatePreview();
  };

  const openInNewTab = () => {
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(content);
      newWindow.document.close();
    }
  };

  return (
    <div className={`relative h-full bg-transparent ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
          <div className="flex items-center space-x-2 text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
            <span>Loading preview...</span>
          </div>
        </div>
      )}
      
      {hasError && (
        <div className="absolute inset-0 bg-white bg-opacity-90 flex items-center justify-center z-50">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Preview Error</h3>
            <p className="text-gray-600 mb-4">Failed to load the website preview</p>
            <button 
              onClick={handleRefresh} 
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
      
      <div className="absolute top-2 right-2 flex items-center space-x-2 z-40">
        <button
          onClick={handleRefresh}
          className="p-2 bg-white rounded-md shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          title="Refresh Preview"
        >
          <RefreshCw className="h-4 w-4 text-gray-600" />
        </button>
        <button
          onClick={openInNewTab}
          className="p-2 bg-white rounded-md shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
          title="Open in New Tab"
        >
          <ExternalLink className="h-4 w-4 text-gray-600" />
        </button>
      </div>
      
      <iframe
        ref={iframeRef}
        className="w-full h-full"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-modals allow-downloads"
        title="Website Preview"
        style={{ border: 'none' }}
      />
    </div>
  );
};

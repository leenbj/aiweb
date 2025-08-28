import React, { useState, useRef, useEffect } from 'react';
import { Eye, Code, Smartphone, Tablet, Monitor, Save, Download, Settings, Undo, Redo } from 'lucide-react';
import { motion } from 'framer-motion';
import { CodeEditor } from './CodeEditor';
import { WebsitePreview } from './WebsitePreview';
import { useWebsiteStore } from '../store/websiteStore';
import { toast } from 'react-hot-toast';

type ViewMode = 'visual' | 'code';
type DeviceMode = 'desktop' | 'tablet' | 'mobile';

interface VisualEditorProps {
  content: string;
  onContentChange: (content: string) => void;
  onSave?: () => void;
  isGenerating?: boolean;
  generationProgress?: {progress: number, stage: string};
}

export const VisualEditor: React.FC<VisualEditorProps> = ({
  content,
  onContentChange,
  onSave,
  isGenerating = false,
  generationProgress = { progress: 0, stage: '' },
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('visual');
  const [deviceMode, setDeviceMode] = useState<DeviceMode>('desktop');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([content]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const { currentWebsite, updateWebsite } = useWebsiteStore();

  // 调试内容变化
  useEffect(() => {
    console.log('VisualEditor: Content changed', {
      contentLength: content?.length,
      isHTML: content?.includes('<html'),
      isGenerating,
      generationProgress,
      preview: content?.substring(0, 100) + '...'
    });

    // 如果正在生成且有新内容，强制更新预览
    if (isGenerating && content && content.length > 0) {
      console.log('VisualEditor: Forcing preview update during generation');
    }
  }, [content, isGenerating, generationProgress]);

  const addToHistory = (newContent: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newContent);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleContentChange = (newContent: string) => {
    onContentChange(newContent);
    addToHistory(newContent);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      onContentChange(history[newIndex]);
      toast.success('Undo successful');
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      onContentChange(history[newIndex]);
      toast.success('Redo successful');
    }
  };

  const handleSave = async () => {
    try {
      if (onSave) {
        await onSave();
      } else if (currentWebsite) {
        await updateWebsite(currentWebsite.id, { content });
      }
      toast.success('Website saved successfully!');
    } catch (error) {
      toast.error('Failed to save website');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentWebsite?.title || 'website'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Website downloaded successfully!');
  };

  const getDeviceWidth = () => {
    switch (deviceMode) {
      case 'mobile':
        return '375px';
      case 'tablet':
        return '768px';
      default:
        return '100%';
    }
  };

  const getDeviceHeight = () => {
    switch (deviceMode) {
      case 'mobile':
        return '667px';
      case 'tablet':
        return '1024px';
      default:
        return '100%';
    }
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-4">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setViewMode('visual')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center space-x-1 ${
                viewMode === 'visual'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Eye className="h-4 w-4" />
              <span>Visual</span>
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center space-x-1 ${
                viewMode === 'code'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Code className="h-4 w-4" />
              <span>Code</span>
            </button>
          </div>

          {/* Device Mode Toggle */}
          {viewMode === 'visual' && (
            <div className="flex items-center bg-white rounded-lg border border-gray-200 p-1">
              <button
                onClick={() => setDeviceMode('desktop')}
                className={`p-2 rounded-md transition-colors ${
                  deviceMode === 'desktop'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Desktop View"
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeviceMode('tablet')}
                className={`p-2 rounded-md transition-colors ${
                  deviceMode === 'tablet'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Tablet View"
              >
                <Tablet className="h-4 w-4" />
              </button>
              <button
                onClick={() => setDeviceMode('mobile')}
                className={`p-2 rounded-md transition-colors ${
                  deviceMode === 'mobile'
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
                title="Mobile View"
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* History Controls */}
          <div className="flex items-center space-x-1">
            <button
              onClick={handleUndo}
              disabled={historyIndex === 0}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Undo"
            >
              <Undo className="h-4 w-4" />
            </button>
            <button
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Redo"
            >
              <Redo className="h-4 w-4" />
            </button>
          </div>

          {/* Action Buttons */}
          <button
            onClick={handleDownload}
            className="btn btn-secondary btn-sm flex items-center space-x-1"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary btn-sm flex items-center space-x-1"
          >
            <Save className="h-4 w-4" />
            <span>Save</span>
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'visual' ? (
          <div className="h-full flex items-center justify-center bg-gray-100 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              style={{
                width: getDeviceWidth(),
                height: getDeviceHeight(),
                maxWidth: '100%',
                maxHeight: '100%',
              }}
              className="bg-white rounded-lg shadow-lg overflow-hidden relative"
            >
              {isGenerating ? (
                // AI生成进度界面
                <div className="h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50">
                  <div className="text-center p-8 max-w-md">
                    <div className="mb-6">
                      <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                        <Code className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-2xl font-bold text-gray-800 mb-2">AI正在生成您的网站</h3>
                      <p className="text-gray-600 mb-6">请稍候，我正在根据您的需求创建专业的网站代码</p>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="bg-white rounded-lg p-4 shadow-sm">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-700">{generationProgress.stage}</span>
                          <span className="text-sm text-gray-500">{generationProgress.progress}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-blue-500 to-purple-600 h-2 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${generationProgress.progress}%` }}
                          ></div>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                        <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                        <span className="ml-2">预计完成时间：30-60秒</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <WebsitePreview
                    content={content}
                    onContentChange={handleContentChange}
                    selectedElement={selectedElement}
                    onElementSelect={setSelectedElement}
                  />
                  
                  {/* 实时预览状态指示器 */}
                  <div className="absolute top-2 left-2 bg-white/90 backdrop-blur-sm px-2 py-1 rounded text-xs text-gray-600 border">
                    实时预览 • {Math.round(content.length / 1024 * 100) / 100} KB
                  </div>
                </>
              )}
            </motion.div>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            <div className="p-2 bg-gray-50 border-b text-sm text-gray-600 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span>HTML 源代码</span>
                {isGenerating && (
                  <div className="flex items-center space-x-1 text-blue-600">
                    <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    <span className="text-xs">实时生成中...</span>
                  </div>
                )}
              </div>
              <span className="text-xs">
                代码行数: {content.split('\n').length} • 
                字符数: {content.length}
              </span>
            </div>
            {isGenerating && (
              <div className="bg-blue-50 border-b border-blue-200 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-blue-800">{generationProgress.stage}</span>
                  <span className="text-sm text-blue-600">{generationProgress.progress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-1">
                  <div 
                    className="bg-blue-600 h-1 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${generationProgress.progress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-blue-700 mt-2">💡 代码将在生成过程中实时更新，您可以看到AI是如何构建您的网站的</p>
              </div>
            )}
            <div className="flex-1">
              <CodeEditor
                value={content}
                onChange={handleContentChange}
                language="html"
                typewriterMode={isGenerating}
                typewriterSpeed={25}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
        <div className="flex items-center space-x-4">
          <span>
            Mode: {viewMode === 'visual' ? 'Visual' : 'Code'}
            {viewMode === 'visual' && ` (${deviceMode})`}
          </span>
          {selectedElement && (
            <span>Selected: {selectedElement}</span>
          )}
        </div>
        <div className="flex items-center space-x-4">
          <span>History: {historyIndex + 1}/{history.length}</span>
          <span>
            Size: {Math.round(content.length / 1024 * 100) / 100} KB
          </span>
        </div>
      </div>
    </div>
  );
};
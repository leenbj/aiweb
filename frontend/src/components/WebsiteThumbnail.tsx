import React, { useState, useEffect } from 'react';
import { Globe, RefreshCw, AlertCircle } from 'lucide-react';
import { screenshotService } from '../services/api';

interface WebsiteThumbnailProps {
  websiteId: string;
  domain?: string;
  title: string;
  className?: string;
  showRefreshButton?: boolean;
  onRefresh?: () => void;
}

export const WebsiteThumbnail: React.FC<WebsiteThumbnailProps> = ({
  websiteId,
  domain,
  title,
  className = '',
  showRefreshButton = false,
  onRefresh
}) => {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadThumbnail();
  }, [websiteId]);

  const loadThumbnail = async () => {
    try {
      setLoading(true);
      setError(false);
      
      const response = await screenshotService.getThumbnail(websiteId);
      setThumbnailUrl(response.data.thumbnailUrl);
    } catch (err) {
      console.log(`No thumbnail found for website ${websiteId}`);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!domain) {
      console.warn('Cannot refresh thumbnail without domain');
      return;
    }
    
    try {
      setRefreshing(true);
      
      await screenshotService.generateThumbnail(websiteId, domain);
      await loadThumbnail(); // 重新加载缩略图
      
      onRefresh?.();
    } catch (error) {
      console.error('Failed to refresh thumbnail:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const renderThumbnail = () => {
    if (loading) {
      return (
        <div className="w-full h-full bg-gray-100 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-blue-600"></div>
        </div>
      );
    }

    if (error || !thumbnailUrl) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 flex flex-col items-center justify-center">
          {error ? (
            <AlertCircle className="h-8 w-8 text-gray-400 mb-2" />
          ) : (
            <Globe className="h-8 w-8 text-gray-400 mb-2" />
          )}
          <span className="text-xs text-gray-500 font-medium text-center px-2">
            {title.substring(0, 20)}
            {title.length > 20 ? '...' : ''}
          </span>
        </div>
      );
    }

    return (
      <img
        src={thumbnailUrl}
        alt={`${title} 缩略图`}
        className="w-full h-full object-cover"
        onError={() => setError(true)}
        onLoad={() => setError(false)}
      />
    );
  };

  return (
    <div className={`relative overflow-hidden bg-gray-50 ${className}`}>
      {renderThumbnail()}
      
      {/* 刷新按钮 */}
      {showRefreshButton && domain && (
        <div className="absolute top-2 right-2">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 bg-white bg-opacity-80 hover:bg-opacity-100 rounded-full shadow-sm transition-all duration-200 hover:scale-110"
            title="刷新缩略图"
          >
            <RefreshCw 
              className={`h-3 w-3 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} 
            />
          </button>
        </div>
      )}
      
      {/* 加载遮罩 */}
      {refreshing && (
        <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
          <div className="bg-white rounded-full p-2">
            <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />
          </div>
        </div>
      )}
    </div>
  );
};
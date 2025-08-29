import React, { useState, useEffect } from 'react';
import { Calendar, TrendingUp, DollarSign, Activity } from 'lucide-react';
import { tokenService } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';

interface UsageOverview {
  today: {
    tokensUsed: number;
    costRmb: number;
    operations: number;
  };
  yesterday: {
    tokensUsed: number;
    costRmb: number;
  };
  month: {
    tokensUsed: number;
    costRmb: number;
  };
  providers: Array<{
    provider: string;
    tokensUsed: number;
    costRmb: number;
  }>;
}

export const TokenStatsSimple: React.FC = () => {
  const [overview, setOverview] = useState<UsageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 加载概览数据
  const loadOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await tokenService.getOverview();
      console.log('API Response:', response.data); // 调试信息
      setOverview(response.data?.data || {
        today: { tokensUsed: 0, costRmb: 0, operations: 0 },
        yesterday: { tokensUsed: 0, costRmb: 0 },
        month: { tokensUsed: 0, costRmb: 0 },
        providers: [],
      });
    } catch (error: any) {
      console.error('Failed to load token overview:', error);
      setError(error.message || '加载数据失败');
      // 设置默认值避免页面空白
      setOverview({
        today: { tokensUsed: 0, costRmb: 0, operations: 0 },
        yesterday: { tokensUsed: 0, costRmb: 0 },
        month: { tokensUsed: 0, costRmb: 0 },
        providers: [],
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Token 使用统计</h1>
        <p className="text-gray-600">查看和分析您的 AI Token 使用情况</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p className="text-red-800">错误: {error}</p>
          <button 
            onClick={loadOverview}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重试
          </button>
        </div>
      )}

      {/* 概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">今日使用</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview?.today.tokensUsed.toLocaleString() || 0}
              </p>
              <p className="text-sm text-gray-500">
                ¥{overview?.today.costRmb.toFixed(4) || '0.0000'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">昨日使用</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview?.yesterday.tokensUsed.toLocaleString() || 0}
              </p>
              <p className="text-sm text-gray-500">
                ¥{overview?.yesterday.costRmb.toFixed(4) || '0.0000'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Calendar className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">本月使用</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview?.month.tokensUsed.toLocaleString() || 0}
              </p>
              <p className="text-sm text-gray-500">
                ¥{overview?.month.costRmb.toFixed(4) || '0.0000'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <DollarSign className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">今日操作</p>
              <p className="text-2xl font-bold text-gray-900">
                {overview?.today.operations || 0}
              </p>
              <p className="text-sm text-gray-500">次调用</p>
            </div>
          </div>
        </div>
      </div>

      {/* 提供商统计 */}
      {overview?.providers && overview.providers.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">提供商统计</h2>
          <div className="space-y-4">
            {overview.providers.map((provider) => (
              <div key={provider.provider} className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 capitalize">{provider.provider}</p>
                  <p className="text-sm text-gray-600">{provider.tokensUsed.toLocaleString()} tokens</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">¥{provider.costRmb.toFixed(4)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 调试信息 */}
      <div className="bg-gray-100 rounded-lg p-4 mt-8">
        <h3 className="text-lg font-medium mb-2">调试信息</h3>
        <pre className="text-sm bg-white p-4 rounded overflow-auto">
          {JSON.stringify(overview, null, 2)}
        </pre>
      </div>
    </div>
  );
};

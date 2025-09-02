import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { format, subDays } from 'date-fns';
import { Calendar, TrendingUp, DollarSign, Activity, Clock, Filter } from 'lucide-react';
import { tokenService } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

interface TokenUsageData {
  date: string;
  hour?: number;
  provider?: string;
  tokensUsed: number;
  costRmb: number;
}

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

const COLORS = {
  deepseek: '#4F46E5',
  openai: '#10B981',
  anthropic: '#F59E0B',
};

export const TokenStats: React.FC = () => {
  const [overview, setOverview] = useState<UsageOverview | null>(null);
  const [trendData, setTrendData] = useState<TokenUsageData[]>([]);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dateRange, setDateRange] = useState({
    startDate: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    endDate: format(new Date(), 'yyyy-MM-dd'),
  });
  const [selectedProvider, setSelectedProvider] = useState<string>('');
  const [viewMode, setViewMode] = useState<'day' | 'hour'>('day');

  // 加载概览数据
  const loadOverview = async () => {
    try {
      const response = await tokenService.getOverview();
      setOverview(response.data?.data || {
        today: { tokensUsed: 0, costRmb: 0, operations: 0 },
        yesterday: { tokensUsed: 0, costRmb: 0 },
        month: { tokensUsed: 0, costRmb: 0 },
        providers: [],
      });
    } catch (error) {
      console.error('Failed to load token overview:', error);
      // 设置默认值避免页面空白
      setOverview({
        today: { tokensUsed: 0, costRmb: 0, operations: 0 },
        yesterday: { tokensUsed: 0, costRmb: 0 },
        month: { tokensUsed: 0, costRmb: 0 },
        providers: [],
      });
    }
  };

  // 加载趋势数据
  const loadTrendData = async () => {
    try {
      const response = await tokenService.getTrend();
      setTrendData(response.data?.data?.trend || []);
    } catch (error) {
      console.error('Failed to load trend data:', error);
      setTrendData([]); // 设置默认值
    }
  };

  // 加载特定日期的详细数据
  const loadDailyData = async (date: string) => {
    try {
      const response = await tokenService.getDailyUsage({
        date,
        provider: selectedProvider || undefined,
      });
      setDailyData(response.data?.data || []);
    } catch (error) {
      console.error('Failed to load daily data:', error);
      setDailyData(null); // 设置默认值
    }
  };

  // 加载日期范围数据
  const loadRangeData = async () => {
    try {
      const response = await tokenService.getRangeUsage({
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        provider: selectedProvider || undefined,
        groupBy: viewMode,
      });
      setTrendData(response.data?.data?.usage || []);
    } catch (error) {
      console.error('Failed to load range data:', error);
      setTrendData([]); // 设置默认值
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      setLoading(true);
      await Promise.all([
        loadOverview(),
        loadTrendData(),
        loadDailyData(selectedDate),
      ]);
      setLoading(false);
    };
    loadInitialData();
  }, []);

  useEffect(() => {
    loadDailyData(selectedDate);
  }, [selectedDate, selectedProvider]);

  useEffect(() => {
    loadRangeData();
  }, [dateRange, selectedProvider, viewMode]);

  // 格式化图表数据
  const formatTrendData = () => {
    const groupedData: { [key: string]: any } = {};
    
    trendData.forEach(item => {
      const key = viewMode === 'hour' 
        ? `${item.date} ${item.hour}:00` 
        : item.date;
      
      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          totalTokens: 0,
          totalCost: 0,
        };
      }
      
      groupedData[key][`${item.provider}_tokens`] = item.tokensUsed;
      groupedData[key][`${item.provider}_cost`] = item.costRmb;
      groupedData[key].totalTokens += item.tokensUsed;
      groupedData[key].totalCost += item.costRmb;
    });

    return Object.values(groupedData);
  };

  // 格式化提供商数据为饼图格式
  const formatProviderData = () => {
    if (!overview?.providers) return [];
    
    return overview.providers.map(provider => ({
      name: provider.provider,
      value: provider.tokensUsed,
      cost: provider.costRmb,
      color: COLORS[provider.provider as keyof typeof COLORS],
    }));
  };

  // 格式化小时数据
  const formatHourlyData = () => {
    if (!dailyData?.hourlyStats) return [];
    
    return dailyData.hourlyStats.map((hour: any) => ({
      hour: `${hour.hour}:00`,
      tokens: hour.tokensUsed,
      cost: hour.costRmb,
    }));
  };

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

      {/* 过滤器 */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">筛选器</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              开始日期
            </label>
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              结束日期
            </label>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI 提供商
            </label>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部</option>
              <option value="deepseek">DeepSeek</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              查看方式
            </label>
            <select
              value={viewMode}
              onChange={(e) => setViewMode(e.target.value as 'day' | 'hour')}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="day">按天</option>
              <option value="hour">按小时</option>
            </select>
          </div>
        </div>
      </div>

      {/* 趋势图 */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">使用趋势</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={formatTrendData()}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12 }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip 
                formatter={(value: number, name: string) => [
                  name.includes('cost') ? `¥${value.toFixed(4)}` : value.toLocaleString(),
                  name.includes('cost') ? '费用' : 'Token数量'
                ]}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="totalTokens" 
                stroke="#4F46E5" 
                strokeWidth={2}
                name="总Token数"
              />
              <Line 
                type="monotone" 
                dataKey="totalCost" 
                stroke="#EF4444" 
                strokeWidth={2}
                name="总费用(¥)"
                yAxisId="right"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* 提供商分布 */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">提供商分布</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={formatProviderData()}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, percent }) => `${name} ${(percent ?? 0 * 100).toFixed(1)}%`}
                >
                  {formatProviderData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => [value.toLocaleString(), 'Token数量']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 每日详细数据 */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">每日详情</h2>
            <div className="flex items-center space-x-2">
              <Clock className="h-5 w-5 text-gray-400" />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={formatHourlyData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'tokens' ? value.toLocaleString() : `¥${value.toFixed(4)}`,
                    name === 'tokens' ? 'Token数量' : '费用'
                  ]}
                />
                <Bar dataKey="tokens" fill="#4F46E5" name="tokens" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 详细统计表格 */}
      {dailyData && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            {selectedDate} 详细统计
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-2">总Token数</h3>
              <p className="text-2xl font-bold text-gray-900">
                {dailyData.totals.totalTokens.toLocaleString()}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-2">总费用</h3>
              <p className="text-2xl font-bold text-gray-900">
                ¥{dailyData.totals.totalCost.toFixed(4)}
              </p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-600 mb-2">操作次数</h3>
              <p className="text-2xl font-bold text-gray-900">
                {dailyData.totals.totalOperations}
              </p>
            </div>
          </div>
          
          {Object.keys(dailyData.providerStats).length > 0 && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">按提供商统计</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        提供商
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Token数量
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        费用
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作次数
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {Object.entries(dailyData.providerStats).map(([provider, stats]: [string, any]) => (
                      <tr key={provider}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {provider}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stats.tokensUsed.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ¥{stats.costRmb.toFixed(4)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {stats.operations}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

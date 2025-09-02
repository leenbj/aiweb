import React, { useState, useEffect } from 'react';
import { 
  Server, Globe, Check, X, AlertTriangle, 
  Plus, Edit, Trash2, Eye, RefreshCw,
  ExternalLink, Copy, Clock, Shield
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { deploymentService, websiteService, notificationService } from '../services/api';

interface Website {
  id: string;
  domain: string;
  title: string;
  status: 'draft' | 'deployed' | 'failed';
  sslStatus: 'pending' | 'active' | 'failed';
  dnsStatus: 'pending' | 'active' | 'failed';
  deployedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface Deployment {
  id: string;
  websiteId: string;
  domain: string;
  status: 'pending' | 'deploying' | 'success' | 'failed';
  serverPath: string;
  logs?: string;
  createdAt: string;
  updatedAt: string;
  website?: {
    title: string;
    description?: string;
  };
}

export const DeploymentManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState('websites');
  const [websites, setWebsites] = useState<Website[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [selectedWebsite, setSelectedWebsite] = useState<Website | null>(null);
  const [domainInput, setDomainInput] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [websitesResponse, deploymentsResponse] = await Promise.all([
        websiteService.getWebsites(),
        deploymentService.getDeployments()
      ]);
      
      setWebsites(websitesResponse.data.data || []);
      setDeployments(deploymentsResponse.data.data || []);
    } catch (error) {
      toast.error('加载数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeploy = async (websiteId: string, domain: string) => {
    try {
      setDeploying(websiteId);
      
      // 直接发送原始域名，后端会处理中文域名转换
      await deploymentService.deployWebsite(websiteId, domain);
      toast.success('部署已启动，请稍候查看部署状态');
      
      // 重新加载数据
      await loadData();
      setShowDeployModal(false);
      setSelectedWebsite(null);
      setDomainInput('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || '部署失败');
    } finally {
      setDeploying(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('已复制到剪贴板');
  };

  const sendNotifyEmail = async (website: Website) => {
    try {
      const resp = await notificationService.sendWebsiteComplete(website.id);
      toast.success('通知邮件已发送');
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '发送通知失败');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'success':
      case 'deployed':
        return <Check className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <X className="h-4 w-4 text-red-500" />;
      case 'pending':
      case 'deploying':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    const statusMap: { [key: string]: string } = {
      draft: '草稿',
      deployed: '已部署',
      failed: '部署失败',
      pending: '等待中',
      deploying: '部署中',
      success: '成功',
      active: '正常'
    };
    return statusMap[status] || status;
  };

  const openDeployModal = (website: Website) => {
    setSelectedWebsite(website);
    setDomainInput(website.domain || '');
    setShowDeployModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">部署管理</h1>
              <p className="mt-1 text-gray-600">管理网站部署和域名配置</p>
            </div>
            <button
              onClick={loadData}
              className="btn btn-secondary flex items-center space-x-2"
            >
              <RefreshCw className="h-4 w-4" />
              <span>刷新</span>
            </button>
          </div>
          
          {/* 标签导航 */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="flex space-x-8">
              <button
                onClick={() => setActiveTab('websites')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === 'websites'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Globe className="h-4 w-4" />
                <span>网站列表</span>
              </button>
              <button
                onClick={() => setActiveTab('deployments')}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === 'deployments'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Server className="h-4 w-4" />
                <span>部署记录</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* 网站列表标签 */}
        {activeTab === 'websites' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">网站列表</h2>
                <p className="text-sm text-gray-600">管理您的网站和部署状态</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">网站信息</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">域名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">部署状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SSL状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">DNS状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最后更新</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {websites.map((website) => (
                      <tr key={website.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">{website.title}</h3>
                            <p className="text-sm text-gray-500">ID: {website.id.slice(0, 8)}...</p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-900">{website.domain}</span>
                            <button
                              onClick={() => copyToClipboard(website.domain)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(website.status)}
                            <span className="text-sm text-gray-900">{getStatusText(website.status)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(website.sslStatus)}
                            <span className="text-sm text-gray-900">{getStatusText(website.sslStatus)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(website.dnsStatus)}
                            <span className="text-sm text-gray-900">{getStatusText(website.dnsStatus)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(website.updatedAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {website.status === 'deployed' && (
                              <a
                                href={`https://${website.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <button
                              onClick={() => openDeployModal(website)}
                              disabled={deploying === website.id}
                              className="btn btn-sm btn-primary"
                            >
                              {deploying === website.id ? (
                                <LoadingSpinner size="sm" />
                              ) : (
                                '部署'
                              )}
                            </button>
                            {website.status === 'deployed' && (
                              <button
                                onClick={() => sendNotifyEmail(website)}
                                className="btn btn-sm btn-secondary"
                              >
                                发送通知邮件
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {websites.length === 0 && (
                  <div className="text-center py-12">
                    <Globe className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">暂无网站</h3>
                    <p className="mt-1 text-sm text-gray-500">创建您的第一个网站开始使用</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 部署记录标签 */}
        {activeTab === 'deployments' && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">部署记录</h2>
                <p className="text-sm text-gray-600">查看所有部署历史和状态</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">网站信息</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">域名</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">服务器路径</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">部署时间</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {deployments.map((deployment) => (
                      <tr key={deployment.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div>
                            <h3 className="text-sm font-medium text-gray-900">
                              {deployment.website?.title || '未知网站'}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {deployment.website?.description || `ID: ${deployment.websiteId.slice(0, 8)}...`}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-900">{deployment.domain}</span>
                            <button
                              onClick={() => copyToClipboard(deployment.domain)}
                              className="text-gray-400 hover:text-gray-600"
                            >
                              <Copy className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(deployment.status)}
                            <span className="text-sm text-gray-900">{getStatusText(deployment.status)}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-gray-500 font-mono">{deployment.serverPath}</span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900">
                          {new Date(deployment.createdAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            {deployment.status === 'success' && (
                              <a
                                href={`https://${deployment.domain}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            {deployment.logs && (
                              <button
                                onClick={() => {
                                  // TODO: 显示部署日志模态框
                                  console.log('显示日志:', deployment.logs);
                                }}
                                className="text-gray-600 hover:text-gray-800"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                
                {deployments.length === 0 && (
                  <div className="text-center py-12">
                    <Server className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">暂无部署记录</h3>
                    <p className="mt-1 text-sm text-gray-500">部署网站后记录将显示在这里</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 部署模态框 */}
      {showDeployModal && selectedWebsite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">部署网站</h3>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  网站标题
                </label>
                <p className="text-sm text-gray-900">{selectedWebsite.title}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  域名 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="example.com 或 例子.中国"
                  className="input w-full"
                />
                <p className="mt-1 text-xs text-gray-500">
                  支持中文域名，系统将自动转换为 Punycode 格式
                </p>
              </div>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                  <Shield className="h-5 w-5 text-blue-500 mr-2 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">部署说明：</p>
                    <ul className="text-xs space-y-1">
                      <li>• 确保域名 DNS 已指向服务器</li>
                      <li>• 系统将自动配置 Nginx 和 SSL</li>
                      <li>• 部署过程可能需要几分钟</li>
                      <li>• 支持中文域名和国际化域名</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeployModal(false);
                  setSelectedWebsite(null);
                  setDomainInput('');
                }}
                className="btn btn-secondary"
              >
                取消
              </button>
              <button
                onClick={() => handleDeploy(selectedWebsite.id, domainInput)}
                disabled={!domainInput.trim() || deploying === selectedWebsite.id}
                className="btn btn-primary flex items-center space-x-2"
              >
                {deploying === selectedWebsite.id ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>部署中...</span>
                  </>
                ) : (
                  <>
                    <Server className="h-4 w-4" />
                    <span>开始部署</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

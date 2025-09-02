import React, { useEffect, useState } from 'react';
import { useRouter } from '@/lib/router';
import { 
  Plus, 
  Globe, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  Sparkles,
  Calendar,
  MoreVertical,
  Rocket,
  Power,
  PowerOff
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWebsiteStore } from '../store/websiteStore';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { WebsiteThumbnail } from '../components/WebsiteThumbnail';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { deploymentService } from '@/services/api';
import { toast } from 'react-hot-toast';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const { navigate } = useRouter();
  const { user } = useAuthStore();
  const { 
    websites, 
    fetchWebsites, 
    deleteWebsite, 
    duplicateWebsite, 
    isLoading, 
    isDeleting 
  } = useWebsiteStore();

  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [configWebsiteId, setConfigWebsiteId] = useState<string | null>(null);
  const [configDomain, setConfigDomain] = useState('');
  const [editingDescId, setEditingDescId] = useState<string | null>(null);
  const [editingDescValue, setEditingDescValue] = useState<string>('');

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  const handleCreateWebsite = () => {
    // 路由使用命名路由，URL保持为/editor
    navigate('editor');
  };

  const handleEditWebsite = (id: string) => {
    // 先切换到编辑器路由，再设置包含ID的URL，避免被navigate覆盖
    try { localStorage.setItem('editing-website-id', id); } catch {}
    navigate('editor');
    window.history.pushState({}, '', `/editor/${id}`);
  };

  const handleDeleteWebsite = async (id: string) => {
    if (confirm(t('dashboard.deleteConfirmation'))) {
      try {
        await deleteWebsite(id);
      } catch (error) {
        // Error handling is done in the store
      }
    }
  };

  const handleDuplicateWebsite = async (id: string) => {
    try {
      const duplicated = await duplicateWebsite(id);
      window.history.pushState({}, '', `/editor/${duplicated.id}`);
      navigate('editor');
    } catch (error) {
      // Error handling is done in the store
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'deploying':
        return 'bg-blue-100 text-blue-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === websites.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(websites.map(w => w.id)));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确定删除所选的 ${selectedIds.size} 个网站？`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map(id => deleteWebsite(id)));
      setSelectedIds(new Set());
    } catch {
      // errors toast in store
    }
  };

  const openConfigModal = (id: string, currentDomain?: string | null) => {
    setConfigWebsiteId(id);
    setConfigDomain(currentDomain || '');
    setShowConfigModal(true);
  };

  const handleConfigDeploy = async () => {
    if (!configWebsiteId) return;
    try {
      // 先保存域名到网站
      await useWebsiteStore.getState().updateWebsite(configWebsiteId, { domain: configDomain });
      // 再触发部署
      await deploymentService.deployWebsite(configWebsiteId, configDomain);
      toast.success('部署已启动');
      setShowConfigModal(false);
      setConfigWebsiteId(null);
      setConfigDomain('');
      await fetchWebsites();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '配置/部署失败');
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-gray-600">{t('dashboard.loadingWebsites')}</p>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t('dashboard.welcomeBack', { name: user?.name })}
              </h1>
              <p className="mt-1 text-gray-600">
                {t('dashboard.manageWebsites')}
              </p>
            </div>
            <button
              onClick={handleCreateWebsite}
              className="btn btn-primary flex items-center space-x-2"
            >
              <Plus className="h-5 w-5" />
              <span>{t('dashboard.newWebsite')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* 批量操作条 */}
        {websites.length > 0 && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 text-sm">
              <button onClick={selectAll} className="px-3 py-1 border rounded">
                {selectedIds.size === websites.length ? '取消全选' : '全选'}
              </button>
              {selectedIds.size > 0 && (
                <>
                  <span>已选择 {selectedIds.size} 项</span>
                  <button onClick={handleBatchDelete} className="px-3 py-1 bg-red-600 text-white rounded">
                    批量删除
                  </button>
                </>
              )}
            </div>
          </div>
        )}
        {websites.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Sparkles className="h-12 w-12 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {t('dashboard.noWebsites')}
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {t('dashboard.noWebsitesDescription')}
            </p>
            <button
              onClick={handleCreateWebsite}
              className="btn btn-primary btn-lg flex items-center space-x-2 mx-auto"
            >
              <Sparkles className="h-5 w-5" />
              <span>{t('dashboard.createFirstWebsite')}</span>
            </button>
          </div>
        ) : (
          /* Websites Grid */
          <div>
          <div className="flex items-center justify-between mb-4">
            {/* 标题去掉数量显示，保持简洁留白 */}
            <h2 className="text-lg font-semibold text-gray-900">网站列表</h2>
          </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {websites.map((website) => (
                <div
                  key={website.id}
                  className="card hover:shadow-md transition-shadow"
                >
                  {/* Website Preview */}
                  <div className="h-48 rounded-t-lg relative overflow-hidden">
                    {/* 选择复选框 */}
                    <div className="absolute top-2 left-2 z-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(website.id)}
                        onChange={() => toggleSelected(website.id)}
                        className="h-4 w-4"
                      />
                    </div>
                    <WebsiteThumbnail
                      websiteId={website.id}
                      domain={website.domain}
                      title={website.title}
                      className="h-full rounded-t-lg"
                      showRefreshButton={true}
                      htmlContent={website.content}
                    />
                    {/* 状态徽标：靠左上，避开左上复选框( left-2 )与右上刷新按钮 */}
                    <div className="absolute top-2 left-8 z-10">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(website.status)}`}>
                        {t(`common.${website.status}`)}
                      </span>
                    </div>
                  </div>

                  {/* Website Info */}
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 truncate mr-2">
                        {website.title}
                      </h3>
                      <div className="relative">
                        <button
                          onClick={() => setSelectedWebsiteId(
                            selectedWebsiteId === website.id ? null : website.id
                          )}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>
                        
                        {selectedWebsiteId === website.id && (
                          <div className="absolute right-0 top-8 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                            <div className="py-1">
                              <button
                                onClick={() => handleEditWebsite(website.id)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t('common.edit')}
                              </button>
                              <button
                                onClick={() => openConfigModal(website.id, website.domain)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Globe className="h-4 w-4 mr-2" />
                                配置域名/部署
                              </button>
                              <div className="px-4 pt-2 pb-1 text-[11px] text-gray-400">设置状态</div>
                              <div className="px-2 pb-2">
                                <div className="grid grid-cols-3 gap-2 px-2">
                                  {([
                                    { key: 'draft', label: '草稿' },
                                    { key: 'published', label: '上线' },
                                    { key: 'offline', label: '下线' },
                                  ] as const).map(opt => (
                                    <button
                                      key={opt.key}
                                      className={`text-xs py-1 rounded border ${
                                        (opt.key === 'offline' ? (website.status === 'draft') : (website.status === opt.key))
                                          ? 'bg-gray-800 text-white border-gray-800'
                                          : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                                      }`}
                                      onClick={async ()=>{
                                        try {
                                          if (opt.key === 'published') {
                                            if (!website.domain) { alert('请先配置域名'); return; }
                                            await useWebsiteStore.getState().updateWebsite(website.id, { status: 'published' as any });
                                            await deploymentService.deployWebsite(website.id, website.domain);
                                          } else if (opt.key === 'offline') {
                                            await useWebsiteStore.getState().updateWebsite(website.id, { status: 'draft' as any });
                                            try { await deploymentService.undeployWebsite(website.id); } catch {}
                                          } else {
                                            await useWebsiteStore.getState().updateWebsite(website.id, { status: 'draft' as any });
                                          }
                                        } catch {}
                                      }}
                                    >{opt.label}</button>
                                  ))}
                                </div>
                              </div>
                              <button
                                onClick={() => handleDuplicateWebsite(website.id)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Copy className="h-4 w-4 mr-2" />
                                {t('common.duplicate')}
                              </button>
                              {website.status === 'published' && (
                                <button
                                  onClick={() => window.open(`https://${website.domain}`, '_blank')}
                                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <ExternalLink className="h-4 w-4 mr-2" />
                                  {t('dashboard.viewLive')}
                                </button>
                              )}
                              <hr className="my-1" />
                              <button
                                onClick={() => handleDeleteWebsite(website.id)}
                                disabled={isDeleting}
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 rounded-b-md"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('common.delete')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {editingDescId === website.id ? (
                      <div className="mb-3">
                        <textarea
                          className="w-full border border-gray-300 rounded p-2 text-sm"
                          maxLength={500}
                          rows={3}
                          value={editingDescValue}
                          onChange={(e)=>setEditingDescValue(e.target.value)}
                        />
                        <div className="mt-2 flex gap-2">
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={async()=>{
                              try {
                                await useWebsiteStore.getState().updateWebsite(website.id, { description: editingDescValue });
                                setEditingDescId(null);
                                setEditingDescValue('');
                              } catch {/* toast in store */}
                            }}
                          >保存</button>
                          <button className="btn btn-secondary btn-sm" onClick={()=>{ setEditingDescId(null); setEditingDescValue(''); }}>取消</button>
                        </div>
                      </div>
                    ) : (
                      <div className="mb-3">
                        <p
                          className="text-sm text-gray-600 line-clamp-2 cursor-text hover:bg-gray-50 rounded px-1"
                          onClick={()=>{ setEditingDescId(website.id); setEditingDescValue(website.description || ''); }}
                          title="点击编辑描述"
                        >
                          {website.description || t('dashboard.noDescription')}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="flex items-center">
                        <Calendar className="h-3 w-3 mr-1" />
                        {format(new Date(website.updatedAt), 'MMM d, yyyy', { locale: zhCN })}
                      </span>
                      <span className="truncate ml-2 max-w-[120px]">
                        {website.domain}
                      </span>
                    </div>
                  </div>

                  {/* Actions - 三个按钮同排：编辑 / 配置域名 / 上线或下线 */}
                  <div className="px-4 pb-4">
                    <div className="grid grid-cols-3 gap-2">
                      {/* 编辑：统一灰色边框 */}
                      <button
                        onClick={() => handleEditWebsite(website.id)}
                        className="w-full inline-flex items-center justify-center gap-1 border border-gray-300 text-gray-800 rounded-md px-2 py-1.5 text-xs hover:bg-gray-50 hover:border-gray-400 transition transform hover:-translate-y-0.5 hover:shadow-sm"
                        title="编辑网站内容"
                      >
                        <Edit className="h-3.5 w-3.5 transition-transform" />
                        编辑
                      </button>
                      {/* 部署：与编辑同色边框，保持一致性 */}
                      <button
                        onClick={() => openConfigModal(website.id, website.domain)}
                        className="w-full inline-flex items-center justify-center gap-1 border border-gray-300 text-gray-800 rounded-md px-2 py-1.5 text-xs hover:bg-gray-50 hover:border-gray-400 transition transform hover:-translate-y-0.5 hover:shadow-sm"
                        title="绑定域名并部署"
                      >
                        <Rocket className="h-3.5 w-3.5 transition-transform" />
                        部署
                      </button>
                      {/* 上线/下线：使用不同灰度边框区分 */}
                      {website.status === 'published' ? (
                        <button
                          onClick={async () => {
                            try {
                              await useWebsiteStore.getState().updateWebsite(website.id, { status: 'draft' as any });
                              try { await deploymentService.undeployWebsite(website.id); } catch {}
                            } catch {}
                          }}
                          className="w-full inline-flex items-center justify-center gap-1 border border-red-300 bg-red-50 text-red-700 rounded-md px-2 py-1.5 text-xs hover:bg-red-100 hover:border-red-400 transition transform hover:-translate-y-0.5 hover:shadow-sm"
                          title="下线网站"
                        >
                          <PowerOff className="h-3.5 w-3.5" />
                          下线
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try {
                              if (!website.domain) { openConfigModal(website.id, website.domain); return; }
                              await useWebsiteStore.getState().updateWebsite(website.id, { status: 'published' as any });
                              await deploymentService.deployWebsite(website.id, website.domain!);
                            } catch {}
                          }}
                          className="w-full inline-flex items-center justify-center gap-1 border border-green-300 bg-green-50 text-green-700 rounded-md px-2 py-1.5 text-xs hover:bg-green-100 hover:border-green-400 transition transform hover:-translate-y-0.5 hover:shadow-sm"
                          title="上线网站"
                        >
                          <Power className="h-3.5 w-3.5" />
                          上线
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Click outside to close dropdown */}
      {selectedWebsiteId && (
        <div
          className="fixed inset-0 z-5"
          onClick={() => setSelectedWebsiteId(null)}
        />
      )}
    </div>

    {/* 配置域名/上线部署 模态框 */}
    {showConfigModal && (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">绑定域名并部署</h3>
          </div>
          <div className="p-6 space-y-3">
            <label className="text-sm text-gray-700">域名</label>
            <input
              className="input w-full"
              placeholder="example.com 或 例子.中国"
              value={configDomain}
              onChange={(e) => setConfigDomain(e.target.value)}
            />
            <p className="text-xs text-gray-500">支持中文域名，系统将自动转换为Punycode</p>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
            <button className="btn btn-secondary" onClick={() => { setShowConfigModal(false); setConfigWebsiteId(null); }}>
              取消
            </button>
            <button className="btn btn-primary" disabled={!configDomain.trim()} onClick={handleConfigDeploy}>
              保存并部署
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
};

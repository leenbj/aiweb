import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { 
  Key, Save, Eye, EyeOff, User, Server, Users, Activity, 
  Settings as SettingsIcon, Database, Lock, Mail
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { settingsService, authService, adminService } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AvatarShowcase } from '../components/AvatarShowcase';
import { useAuthStore } from '../store/authStore';
import { useRouter } from '@/lib/router';

interface SettingsForm {
  // AI设置
  deepseekApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  aiProvider: 'deepseek' | 'openai' | 'anthropic';
  deepseekModel: string;
  openaiModel: string;
  anthropicModel: string;
  chatPrompt: string;
  generatePrompt: string;
  editPrompt: string;
}

export const Settings: React.FC = () => {
  const { user } = useAuthStore();
  const { navigate } = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'ai' | 'users' | 'email' | 'system' | 'activities'>('profile');
  const [pwChanging, setPwChanging] = useState(false);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [users, setUsers] = useState<any[]>([]);
  const [permDefs, setPermDefs] = useState<Array<{ key: string; roles: string[] }>>([]);
  const [selectedUserPerms, setSelectedUserPerms] = useState<Record<string, boolean>>({});
  const [emailSettings, setEmailSettings] = useState<{ smtp_host: string; smtp_port: string; smtp_user: string; smtp_pass: string; smtp_from: string; smtp_enabled: boolean } | null>(null);
  const [notifyEmails, setNotifyEmails] = useState('');
  
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const isSuperAdmin = user?.role === 'super_admin';
  const [defaultPrompts, setDefaultPrompts] = useState<{
    chatPrompt: string;
    generatePrompt: string;
    editPrompt: string;
  }>({
    chatPrompt: '',
    generatePrompt: '',
    editPrompt: ''
  });

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<SettingsForm>();

  const currentProvider = watch('aiProvider');

  useEffect(() => {
    // 同时加载默认提示词与用户设置，避免默认提示词未返回时阻塞设置加载
    loadDefaultPrompts();
    loadSettings();
  }, []);

  useEffect(() => {
    if (isAdmin) {
      // preload users and permissions for admin
      loadUsers();
      loadPermissionDefs();
      loadEmailSettings();
    }
  }, [isAdmin]);

  const loadDefaultPrompts = async () => {
    try {
      const response = await settingsService.getDefaultPrompts();
      if (response.data.data) {
        setDefaultPrompts(response.data.data);
      }
    } catch (error) {
      console.error('加载默认提示词失败:', error);
    }
  };

  const loadSettings = async (forceShowFull?: boolean) => {
    try {
      const shouldShowFull = forceShowFull !== undefined ? forceShowFull : showApiKeys;
      const response = await settingsService.getSettings(shouldShowFull);
      const settings = response.data.data;
      
      if (settings) {
        // AI设置
        setValue('deepseekApiKey', settings.deepseekApiKey || '');
        setValue('openaiApiKey', settings.openaiApiKey || '');
        setValue('anthropicApiKey', settings.anthropicApiKey || '');
        setValue('aiProvider', settings.aiProvider);
        setValue('chatPrompt', settings.chatPrompt || defaultPrompts.chatPrompt);
        setValue('generatePrompt', settings.generatePrompt || defaultPrompts.generatePrompt);
        setValue('editPrompt', settings.editPrompt || defaultPrompts.editPrompt);
        setValue('deepseekModel', settings.deepseekModel || 'deepseek-chat');
        setValue('openaiModel', settings.openaiModel || 'gpt-3.5-turbo');
        setValue('anthropicModel', settings.anthropicModel || 'claude-3-haiku-20240307');
        // 通知邮箱
        if (settings.notificationEmails) {
          setNotifyEmails(settings.notificationEmails);
        }
      }
    } catch (error) {
      toast.error('加载设置失败');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SettingsForm) => {
    try {
      setSaving(true);
      
      // 仅提交通用AI设置字段，避免后端校验失败
      const allowedKeys: (keyof SettingsForm)[] = [
        'deepseekApiKey','openaiApiKey','anthropicApiKey','aiProvider','deepseekModel','openaiModel','anthropicModel','chatPrompt','generatePrompt','editPrompt'
      ];
      const filteredData: Partial<SettingsForm> = {};
      for (const k of allowedKeys) {
        // @ts-ignore
        filteredData[k] = data[k];
      }
      
      // 如果密钥包含星号，说明是掩码化的，不应该更新
      if (filteredData.deepseekApiKey?.includes('*')) {
        delete filteredData.deepseekApiKey;
      }
      if (filteredData.openaiApiKey?.includes('*')) {
        delete filteredData.openaiApiKey;
      }
      if (filteredData.anthropicApiKey?.includes('*')) {
        delete filteredData.anthropicApiKey;
      }
      
      await settingsService.updateSettings(filteredData);
      toast.success('设置保存成功');
      // 只在隐藏密钥时重新加载，避免清空用户正在编辑的完整密钥
      if (!showApiKeys) {
        await loadSettings(false);
      }
    } catch (error: any) {
      const msg = error?.response?.data?.error || error?.message || '保存设置失败';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  // Admin data loaders
  const loadUsers = async () => {
    try {
      const res = await adminService.getUsers();
      setUsers(res.data?.data || []);
    } catch (e) { /* ignore */ }
  };
  const loadPermissionDefs = async () => {
    try { const r = await adminService.getPermissionDefs(); setPermDefs(r.data?.data || []);} catch(e) { /* ignore */ }
  };
  const loadEmailSettings = async () => {
    try { const r = await adminService.getEmailSettings(); setEmailSettings(r.data?.data || null);} catch(e) { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: '个人资料', icon: User },
    { id: 'ai', label: 'AI设置', icon: Key },
    ...(isAdmin ? [
      { id: 'users', label: '用户管理', icon: Users },
      { id: 'email', label: '邮件设置', icon: Mail },
    ] : []),
    ...(isSuperAdmin ? [
      { id: 'activities', label: '活动日志', icon: Activity },
    ] : [])
  ];

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
              <p className="mt-1 text-gray-600">配置系统功能和个人偏好</p>
            </div>
            <button
              type="submit"
              form="settings-form"
              disabled={saving}
              className="btn btn-primary flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>保存中...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>保存设置</span>
                </>
              )}
            </button>
          </div>
          
          {/* 标签导航 */}
          <div className="mt-6 border-b border-gray-200">
            <nav className="flex space-x-8">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-8 max-w-4xl mx-auto">
        <form id="settings-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* 个人资料 */}
          {activeTab === 'profile' && (
            <>
              <div className="card">
                <div className="card-header">
                  <div className="flex items-center">
                    <User className="h-5 w-5 text-gray-600 mr-3" />
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900">个人资料</h2>
                      <p className="text-sm text-gray-600">更新头像、昵称、邮箱和密码</p>
                    </div>
                  </div>
                </div>
                <div className="card-body space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="h-16 w-16 rounded-full bg-gray-200 overflow-hidden flex items-center justify-center text-gray-700 text-xl font-semibold">
                      {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="text-sm text-gray-600">
                      系统默认使用邮箱首字母作为头像（不支持上传）
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">昵称</label>
                      <input defaultValue={user?.name} onBlur={async (e) => {
                        try { await authService.updateProfile({ name: e.target.value }); useAuthStore.setState((s)=>({ ...s, user: { ...s.user!, name: e.target.value } })); toast.success('昵称已更新'); } catch { toast.error('更新失败'); }
                      }} className="input" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">邮箱</label>
                      <input defaultValue={user?.email} onBlur={async (e) => {
                        const val = e.target.value; if (!val) return;
                        try { await authService.updateProfile({ email: val }); useAuthStore.setState((s)=>({ ...s, user: { ...s.user!, email: val } })); toast.success('邮箱已更新'); } catch (err:any) { toast.error(err.response?.data?.error || '更新失败'); }
                      }} className="input" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">修改密码</label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <input type="password" placeholder="当前密码" value={passwords.currentPassword} onChange={(e)=>setPasswords({...passwords, currentPassword: e.target.value})} className="input" />
                      <input type="password" placeholder="新密码" value={passwords.newPassword} onChange={(e)=>setPasswords({...passwords, newPassword: e.target.value})} className="input" />
                      <button type="button" disabled={pwChanging} onClick={async()=>{ try { setPwChanging(true); await authService.changePassword(passwords); setPasswords({ currentPassword: '', newPassword: ''}); toast.success('密码已更新'); } catch(err:any){ toast.error(err.response?.data?.error || '修改失败'); } finally { setPwChanging(false);} }} className="btn btn-secondary">{pwChanging ? '提交中...' : '更新密码'}</button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">通知邮箱（逗号分隔）</label>
                    <input
                      placeholder="example1@mail.com, example2@mail.com"
                      className="input"
                      value={notifyEmails}
                      onChange={(e)=>setNotifyEmails(e.target.value)}
                      onBlur={async (e) => {
                        try {
                          await settingsService.updateSettings({ notificationEmails: e.target.value });
                          toast.success('通知邮箱已保存');
                        } catch {
                          toast.error('保存失败');
                        }
                      }}
                    />
                    <p className="text-xs text-gray-500 mt-1">用于接收网站完成通知的邮箱列表</p>
                  </div>
                </div>
              </div>
            </>
          )}
          
          {/* AI设置标签 */}
          {activeTab === 'ai' && (
            <>
              {/* API Keys Section */}
              <div className="card">
            <div className="card-header">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Key className="h-5 w-5 text-gray-600 mr-3" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">API密钥配置</h2>
                    <p className="text-sm text-gray-600">配置AI服务提供商的访问密钥</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const newShowState = !showApiKeys;
                    setShowApiKeys(newShowState);
                    await loadSettings(newShowState);
                  }}
                  className="btn btn-secondary btn-sm flex items-center"
                >
                  {showApiKeys ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
                  {showApiKeys ? '隐藏' : '显示'}
                </button>
              </div>
            </div>

            <div className="card-body space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  AI服务提供商
                </label>
                <select
                  {...register('aiProvider', { required: '请选择AI服务提供商' })}
                  className="input"
                >
                  <option value="deepseek">DeepSeek</option>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                </select>
                {errors.aiProvider && (
                  <p className="mt-1 text-sm text-red-600">{errors.aiProvider.message}</p>
                )}
              </div>

              {currentProvider === 'deepseek' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      DeepSeek API密钥
                    </label>
                    <input
                      {...register('deepseekApiKey')}
                      type={showApiKeys ? 'text' : 'password'}
                      className="input"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      DeepSeek 模型
                    </label>
                    <select
                      {...register('deepseekModel')}
                      className="input"
                    >
                      <option value="deepseek-chat">deepseek-chat</option>
                      <option value="deepseek-coder">deepseek-coder</option>
                    </select>
                  </div>
                </div>
              )}

              {currentProvider === 'openai' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      OpenAI API密钥
                    </label>
                    <input
                      {...register('openaiApiKey')}
                      type={showApiKeys ? 'text' : 'password'}
                      className="input"
                      placeholder="sk-..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      模型选择
                    </label>
                    <select
                      {...register('openaiModel')}
                      className="input"
                    >
                      <option value="gpt-3.5-turbo">gpt-3.5-turbo</option>
                      <option value="gpt-4">gpt-4</option>
                      <option value="gpt-4-turbo">gpt-4-turbo</option>
                      <option value="gpt-4o">gpt-4o</option>
                      <option value="gpt-4o-mini">gpt-4o-mini</option>
                    </select>
                  </div>
                </div>
              )}

              {currentProvider === 'anthropic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Anthropic API密钥
                    </label>
                    <input
                      {...register('anthropicApiKey')}
                      type={showApiKeys ? 'text' : 'password'}
                      className="input"
                      placeholder="sk-ant-..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      模型选择
                    </label>
                    <select
                      {...register('anthropicModel')}
                      className="input"
                    >
                      <option value="claude-3-haiku-20240307">claude-3-haiku</option>
                      <option value="claude-3-sonnet-20240229">claude-3-sonnet</option>
                      <option value="claude-3-opus-20240229">claude-3-opus</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Prompts Configuration */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center">
                <svg className="h-5 w-5 text-gray-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">提示词配置</h2>
                  <p className="text-sm text-gray-600">自定义AI在不同场景下的行为模式</p>
                </div>
              </div>
            </div>
            
            <div className="card-body space-y-6">
              {/* Chat Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    对话聊天提示词
                  </label>
                  <button
                    type="button"
                    onClick={() => setValue('chatPrompt', defaultPrompts.chatPrompt)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 hover:border-blue-300 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    恢复默认
                  </button>
                </div>
                <textarea
                  {...register('chatPrompt')}
                  rows={4}
                  className="input resize-none"
                  placeholder="在此输入自定义的对话提示词..."
                />
                <p className="mt-1 text-xs text-gray-500">控制AI在聊天对话中的回复风格和行为准则</p>
                {defaultPrompts.chatPrompt && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                      查看默认提示词内容
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded border text-xs text-gray-700 whitespace-pre-wrap">
                      {defaultPrompts.chatPrompt}
                    </div>
                  </details>
                )}
              </div>

              {/* Generate Website Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    网站生成提示词
                  </label>
                  <button
                    type="button"
                    onClick={() => setValue('generatePrompt', defaultPrompts.generatePrompt)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-md hover:bg-green-100 hover:border-green-300 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    恢复默认
                  </button>
                </div>
                <textarea
                  {...register('generatePrompt')}
                  rows={6}
                  className="input resize-none"
                  placeholder="在此输入自定义的网站生成提示词..."
                />
                <p className="mt-1 text-xs text-gray-500">控制AI生成新网站的设计风格和技术规范</p>
                {defaultPrompts.generatePrompt && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                      查看默认提示词内容
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded border text-xs text-gray-700 whitespace-pre-wrap">
                      {defaultPrompts.generatePrompt}
                    </div>
                  </details>
                )}
              </div>

              {/* Edit Website Prompt */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    网站编辑提示词
                  </label>
                  <button
                    type="button"
                    onClick={() => setValue('editPrompt', defaultPrompts.editPrompt)}
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-md hover:bg-orange-100 hover:border-orange-300 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-1"
                  >
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    恢复默认
                  </button>
                </div>
                <textarea
                  {...register('editPrompt')}
                  rows={5}
                  className="input resize-none"
                  placeholder="在此输入自定义的网站编辑提示词..."
                />
                <p className="mt-1 text-xs text-gray-500">控制AI编辑现有网站的修改策略和优化方向</p>
                {defaultPrompts.editPrompt && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-800">
                      查看默认提示词内容
                    </summary>
                    <div className="mt-2 p-3 bg-gray-50 rounded border text-xs text-gray-700 whitespace-pre-wrap">
                      {defaultPrompts.editPrompt}
                    </div>
                  </details>
                )}
              </div>



              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>提示：</strong>自定义提示词将覆盖系统默认设置，留空则使用默认配置。
                </p>
              </div>
            </div>
          </div>
            </>
          )}

          {/* 用户管理标签 - 管理员/超管 */}
          
          {activeTab === 'users' && isAdmin && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-gray-600 mr-3" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">用户管理</h2>
                    <p className="text-sm text-gray-600">管理系统用户和权限</p>
                  </div>
                </div>
              </div>
              <div className="card-body space-y-4">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">用户</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">邮箱</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">角色</th>
                        {isSuperAdmin && <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">权限</th>}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {users.map(u => (
                        <tr key={u.id}>
                          <td className="px-4 py-2 text-sm">{u.name}</td>
                          <td className="px-4 py-2 text-sm">{u.email}</td>
                          <td className="px-4 py-2 text-sm">
                            <select disabled={!isSuperAdmin} defaultValue={u.role} onChange={async (e)=>{ try { await adminService.updateUserRole(u.id, e.target.value as any); toast.success('角色已更新'); loadUsers(); } catch{ toast.error('更新失败'); }}} className="input">
                              <option value="user">用户</option>
                              <option value="admin">管理员</option>
                              <option value="super_admin">超级管理员</option>
                            </select>
                          </td>
                          {isSuperAdmin && (
                            <td className="px-4 py-2 text-sm">
                              <details>
                                <summary className="cursor-pointer text-blue-600">设置权限</summary>
                                <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                                  {permDefs.map(def => (
                                    <label key={def.key} className="flex items-center space-x-2">
                                      <input type="checkbox" defaultChecked={false} onChange={async (e)=>{
                                        try {
                                          await adminService.updateUserPermissions(u.id, [{ permission: def.key, granted: e.target.checked }]);
                                          toast.success('权限已更新');
                                        } catch { toast.error('更新失败'); }
                                      }} />
                                      <span className="text-xs text-gray-700">{def.key}</span>
                                    </label>
                                  ))}
                                </div>
                              </details>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 邮件设置 - 管理员可见 */}
          {activeTab === 'email' && isAdmin && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center">
                  <Mail className="h-5 w-5 text-gray-600 mr-3" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">邮件通知设置</h2>
                    <p className="text-sm text-gray-600">配置SMTP用于系统邮件通知</p>
                  </div>
                </div>
              </div>
              <div className="card-body space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Host</label>
                    <input className="input" value={emailSettings?.smtp_host || ''} onChange={(e)=>setEmailSettings(es=> es ? { ...es, smtp_host: e.target.value } : es)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Port</label>
                    <input className="input" value={emailSettings?.smtp_port || ''} onChange={(e)=>setEmailSettings(es=> es ? { ...es, smtp_port: e.target.value } : es)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SMTP User</label>
                    <input className="input" value={emailSettings?.smtp_user || ''} onChange={(e)=>setEmailSettings(es=> es ? { ...es, smtp_user: e.target.value } : es)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">SMTP Password</label>
                    <input type="password" className="input" value={emailSettings?.smtp_pass || ''} onChange={(e)=>setEmailSettings(es=> es ? { ...es, smtp_pass: e.target.value } : es)} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">发件人邮箱</label>
                    <input className="input" value={emailSettings?.smtp_from || ''} onChange={(e)=>setEmailSettings(es=> es ? { ...es, smtp_from: e.target.value } : es)} />
                  </div>
                  <div className="flex items-center space-x-2 mt-6">
                    <input type="checkbox" checked={!!emailSettings?.smtp_enabled} onChange={(e)=>setEmailSettings(es=> es ? { ...es, smtp_enabled: e.target.checked } : es)} />
                    <span className="text-sm">启用邮件发送</span>
                  </div>
                </div>
                <div>
                  <button type="button" className="btn btn-primary" onClick={async()=>{ try { if (!emailSettings) return; await adminService.updateEmailSettings(emailSettings); toast.success('保存成功'); } catch { toast.error('保存失败'); } }}>保存邮件设置</button>
                </div>
              </div>
            </div>
          )}

          {/* 活动日志标签 - 仅超级管理员可见 */}
          {activeTab === 'activities' && isSuperAdmin && (
            <div className="card">
              <div className="card-header">
                <div className="flex items-center">
                  <Activity className="h-5 w-5 text-gray-600 mr-3" />
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">活动日志</h2>
                    <p className="text-sm text-gray-600">查看系统活动和审计日志</p>
                  </div>
                </div>
              </div>
              <div className="card-body">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    <strong>开发中：</strong>活动日志功能正在开发中，敬请期待。
                  </p>
                </div>
              </div>
            </div>
          )}
          
        </form>
        
      </div>
    </div>
  );
};

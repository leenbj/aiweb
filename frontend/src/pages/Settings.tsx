import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Key, Save, Eye, EyeOff } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { settingsService } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AvatarShowcase } from '../components/AvatarShowcase';

interface SettingsForm {
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showApiKeys, setShowApiKeys] = useState(false);
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
    loadDefaultPrompts();
  }, []);

  useEffect(() => {
    if (defaultPrompts.chatPrompt) {
      loadSettings();
    }
  }, [defaultPrompts]);

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
      
      // 过滤掉掩码化的API密钥，只发送真实的密钥
      const filteredData: Partial<SettingsForm> = { ...data };
      
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
    } catch (error) {
      toast.error('保存设置失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
              <p className="mt-1 text-gray-600">配置AI服务和提示词以个性化您的体验</p>
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
        </div>
      </div>

      {/* Content */}
      <div className="p-8 max-w-4xl mx-auto">

        <form id="settings-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
        </form>
        
        {/* Avatar Showcase */}
        <div className="mt-8">
          <AvatarShowcase />
        </div>
      </div>
    </div>
  );
};
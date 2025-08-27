import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Globe, 
  Edit, 
  Trash2, 
  Copy, 
  ExternalLink,
  Sparkles,
  Calendar,
  MoreVertical
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useWebsiteStore } from '../store/websiteStore';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

export const Dashboard: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
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

  useEffect(() => {
    fetchWebsites();
  }, [fetchWebsites]);

  const handleCreateWebsite = () => {
    navigate('/editor');
  };

  const handleEditWebsite = (id: string) => {
    navigate(`/editor/${id}`);
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
      navigate(`/editor/${duplicated.id}`);
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
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {t('dashboard.yourWebsites', { count: websites.length })}
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {websites.map((website) => (
                <div
                  key={website.id}
                  className="card hover:shadow-md transition-shadow"
                >
                  {/* Website Preview */}
                  <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-t-lg relative overflow-hidden">
                    <div className="absolute inset-0 bg-gray-50 flex items-center justify-center">
                      <Globe className="h-12 w-12 text-gray-400" />
                    </div>
                    {/* Status Badge */}
                    <div className="absolute top-3 left-3">
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
                          <div className="absolute right-0 top-8 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                            <div className="py-1">
                              <button
                                onClick={() => handleEditWebsite(website.id)}
                                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                {t('common.edit')}
                              </button>
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
                                className="flex items-center w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t('common.delete')}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {website.description || t('dashboard.noDescription')}
                    </p>

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

                  {/* Actions */}
                  <div className="px-4 pb-4">
                    <button
                      onClick={() => handleEditWebsite(website.id)}
                      className="btn btn-secondary w-full flex items-center justify-center space-x-2"
                    >
                      <Edit className="h-4 w-4" />
                      <span>{t('dashboard.editWebsite')}</span>
                    </button>
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
  );
};
import React from 'react';
import { useTranslation } from 'react-i18next';

export const Deployments: React.FC = () => {
  const { t } = useTranslation();
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">{t('deployment.deployments')}</h1>
      <p className="text-gray-600">部署管理页面即将推出...</p>
    </div>
  );
};
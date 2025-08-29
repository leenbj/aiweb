import { useState, useEffect } from 'react';
import { useAuth } from './lib/auth';
import { useRouter } from './lib/router';

// Public pages
import { LandingPage } from './components/LandingPage';
import { AuthPage } from './components/AuthPage';

// Dashboard components
import { DashboardSidebar } from './components/DashboardSidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { AIEditor } from './components/AIEditor';

// Placeholder components for other dashboard pages
function SettingsPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">设置</h1>
      <p className="text-muted-foreground">用户设置和偏好配置页面</p>
    </div>
  );
}

function WebsitesPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">网站管理</h1>
      <p className="text-muted-foreground">管理您创建的所有网站</p>
    </div>
  );
}

function DeployPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">部署管理</h1>
      <p className="text-muted-foreground">管理网站的部署和托管服务</p>
    </div>
  );
}

export default function App() {
  const { isAuthenticated } = useAuth();
  const { currentRoute } = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // 从本地存储读取侧边栏状态，默认为展开状态
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // 保存侧边栏状态到本地存储
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  // Public routes - show without sidebar
  if (!isAuthenticated) {
    switch (currentRoute) {
      case 'login':
        return <AuthPage mode="login" />;
      case 'register':
        return <AuthPage mode="register" />;
      default:
        return <LandingPage />;
    }
  }

  // Authenticated routes - show with dashboard layout
  const renderDashboardContent = () => {
    switch (currentRoute) {
      case 'editor':
        return <AIEditor />;
      case 'settings':
        return <SettingsPage />;
      case 'websites':
        return <WebsitesPage />;
      case 'deploy':
        return <DeployPage />;
      default:
        return <DashboardOverview />;
    }
  };

  return (
    <div className="h-screen flex">
      <DashboardSidebar 
        isCollapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />
      <main className="flex-1 overflow-auto">
        {renderDashboardContent()}
      </main>
    </div>
  );
}
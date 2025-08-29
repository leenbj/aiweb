import { useState, useEffect } from 'react';
import { useAuth } from './lib/auth';
import { useRouter } from './lib/router';

// Import existing pages
import { Dashboard } from './pages/Dashboard';
import { WebsiteEditor } from './pages/WebsiteEditor';
import { Settings } from './pages/Settings';
import { Deployments } from './pages/Deployments';
import { TokenStatsSimple as TokenStats } from './pages/TokenStatsSimple';

// Import new components
import { DashboardSidebar } from './components/DashboardSidebar';
import { DashboardOverview } from './components/DashboardOverview';
import { AuthPage } from './components/AuthPage';
import { LoadingSpinner } from './components/LoadingSpinner';
import { AIEditorWithNewUI } from './components/AIEditorWithNewUI';

export default function App() {
  const { isAuthenticated, isLoading } = useAuth();
  const { currentRoute, navigate } = useRouter();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    // 从本地存储读取侧边栏状态，默认为展开状态
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved ? JSON.parse(saved) : false;
  });

  // 保存侧边栏状态到本地存储
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', JSON.stringify(sidebarCollapsed));
  }, [sidebarCollapsed]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Public routes - show without sidebar
  if (!isAuthenticated) {
    switch (currentRoute) {
      case 'login':
        return <AuthPage mode="login" />;
      case 'register':
        return <AuthPage mode="register" />;
      default:
        // Redirect to login if not authenticated
        navigate('login');
        return <AuthPage mode="login" />;
    }
  }

  // Authenticated routes - show with dashboard layout
  const renderDashboardContent = () => {
    switch (currentRoute) {
      case 'dashboard':
        return <DashboardOverview />;
      case 'editor':
        return <AIEditorWithNewUI />;
      case 'settings':
        return <Settings />;
      case 'websites':
        return <Dashboard />; // Use existing Dashboard for websites management
      case 'deploy':
        return <Deployments />;
      case 'tokens':
        return <TokenStats />;
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
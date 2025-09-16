import { create } from 'zustand';

export type Route = 
  | 'home' 
  | 'login' 
  | 'register' 
  | 'dashboard' 
  | 'editor' 
  | 'settings' 
  | 'websites' 
  | 'deploy'
  | 'tokens'
  | 'templates'
  | 'uploadZip';

interface RouterState {
  currentRoute: Route;
  navigate: (route: Route) => void;
}

export const useRouter = create<RouterState>((set) => ({
  currentRoute: 'dashboard',
  navigate: (route: Route) => {
    // Update URL without page refresh for better UX
    const routeMap = {
      home: '/',
      login: '/login',
      register: '/register', 
      dashboard: '/dashboard',
      editor: '/editor',
      settings: '/settings',
      websites: '/websites',
      deploy: '/deployments',
      tokens: '/tokens',
      templates: '/templates',
      uploadZip: '/upload-zip'
    };
    
    const url = routeMap[route] || '/dashboard';
    window.history.pushState({}, '', url);
    
    set({ currentRoute: route });
  },
}));

// Initialize router based on current URL
const initializeRouter = () => {
  const { navigate } = useRouter.getState();
  const path = window.location.pathname;
  
  const routeMap: Record<string, Route> = {
    '/': 'home',
    '/login': 'login',
    '/register': 'register',
    '/dashboard': 'dashboard',
    '/editor': 'editor',
    '/settings': 'settings',
    '/websites': 'websites',
    '/deployments': 'deploy',
    '/tokens': 'tokens',
    '/templates': 'templates',
    '/upload-zip': 'uploadZip'
  };
  
  const route = routeMap[path] || 'dashboard';
  navigate(route);
};

// Handle browser back/forward buttons
window.addEventListener('popstate', initializeRouter);

// Initialize on load
if (typeof window !== 'undefined') {
  initializeRouter();
}

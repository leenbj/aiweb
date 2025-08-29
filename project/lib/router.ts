import { create } from 'zustand';

export type Route = 
  | 'home'
  | 'login'
  | 'register'
  | 'dashboard'
  | 'editor'
  | 'settings'
  | 'websites'
  | 'deploy';

interface RouterState {
  currentRoute: Route;
  navigate: (route: Route) => void;
  goBack: () => void;
  history: Route[];
}

export const useRouter = create<RouterState>((set, get) => ({
  currentRoute: 'home',
  history: ['home'],

  navigate: (route: Route) => {
    const { history } = get();
    set({
      currentRoute: route,
      history: [...history, route]
    });
  },

  goBack: () => {
    const { history } = get();
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      const previousRoute = newHistory[newHistory.length - 1];
      set({
        currentRoute: previousRoute,
        history: newHistory
      });
    }
  }
}));
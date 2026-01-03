import { create } from 'zustand';
import { db } from '../services/database';

export interface POSProfileInfo {
  name: string;
  warehouse?: string;
  company?: string;
  is_default?: boolean;
}

export interface User {
  username: string;
  full_name: string;
  email?: string;
  role: 'Admin' | 'Staff';
  pos_profiles: POSProfileInfo[];
  allowed_warehouses: string[];
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setUser: (user: User | null) => void;
  setIsAuthenticated: (value: boolean) => void;
  setIsLoading: (value: boolean) => void;
  logout: () => Promise<void>;
  restoreSession: () => Promise<boolean>;
  hasAccessToWarehouse: (warehouse: string) => boolean;
  hasAccessToProfile: (profile: string) => boolean;
  isAdmin: () => boolean;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) => set({ user }),
  setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setIsLoading: (isLoading) => set({ isLoading }),

  logout: async () => {
    try {
      // Clear from IndexedDB
      await db.setSetting('user', '');
      await db.setSetting('isAuthenticated', 'false');

      // Call logout API
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout error:', error);
    }

    set({ user: null, isAuthenticated: false });
  },

  restoreSession: async () => {
    try {
      set({ isLoading: true });

      const userJson = await db.getSetting('user');
      const isAuth = await db.getSetting('isAuthenticated');

      if (userJson && isAuth === 'true') {
        const user = JSON.parse(userJson) as User;
        set({ user, isAuthenticated: true, isLoading: false });
        return true;
      }
    } catch (error) {
      console.error('Failed to restore session:', error);
    }

    set({ isLoading: false });
    return false;
  },

  hasAccessToWarehouse: (warehouse: string) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return user.allowed_warehouses.includes(warehouse);
  },

  hasAccessToProfile: (profile: string) => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'Admin') return true;
    return user.pos_profiles.some(p => p.name === profile);
  },

  isAdmin: () => {
    const { user } = get();
    return user?.role === 'Admin';
  }
}));

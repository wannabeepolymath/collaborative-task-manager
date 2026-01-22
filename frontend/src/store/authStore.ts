import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import apiClient from '../api/client';

// Required for web OAuth
WebBrowser.maybeCompleteAuthSession();

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
  created_at: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isGoogleLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  handleGoogleAuth: (idToken: string) => Promise<void>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
  setGoogleLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  isGoogleLoading: false,
  error: null,

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/login', { email, password });
      const { access_token, refresh_token, user } = response.data;
      
      await AsyncStorage.setItem('accessToken', access_token);
      await AsyncStorage.setItem('refreshToken', refresh_token);
      
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Login failed';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  register: async (email: string, password: string, name: string) => {
    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/register', { email, password, name });
      const { access_token, refresh_token, user } = response.data;
      
      await AsyncStorage.setItem('accessToken', access_token);
      await AsyncStorage.setItem('refreshToken', refresh_token);
      
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Registration failed';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  handleGoogleAuth: async (idToken: string) => {
    set({ isGoogleLoading: true, error: null });
    try {
      const response = await apiClient.post('/auth/google', { id_token: idToken });
      const { access_token, refresh_token, user } = response.data;
      
      await AsyncStorage.setItem('accessToken', access_token);
      await AsyncStorage.setItem('refreshToken', refresh_token);
      
      set({ user, isAuthenticated: true, isLoading: false, isGoogleLoading: false });
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Google authentication failed';
      set({ error: message, isGoogleLoading: false });
      throw new Error(message);
    }
  },

  logout: async () => {
    set({ isLoading: true });
    try {
      await AsyncStorage.removeItem('accessToken');
      await AsyncStorage.removeItem('refreshToken');
      set({ user: null, isAuthenticated: false, isLoading: false });
    } catch (error) {
      console.error('Logout error:', error);
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  checkAuth: async () => {
    set({ isLoading: true });
    const AUTH_CHECK_TIMEOUT_MS = 5000;

    const doCheck = async (): Promise<void> => {
      const token = await AsyncStorage.getItem('accessToken');
      if (!token) {
        set({ isLoading: false, isAuthenticated: false, user: null });
        return;
      }
      const response = await apiClient.get('/auth/me');
      set({ user: response.data, isAuthenticated: true, isLoading: false });
    };

    try {
      await Promise.race([
        doCheck(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Auth check timeout')), AUTH_CHECK_TIMEOUT_MS)
        ),
      ]);
    } catch (error) {
      try {
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
      } catch (_) {}
      set({ user: null, isAuthenticated: false, isLoading: false });
    } finally {
      set((state) => (state.isLoading ? { ...state, isLoading: false } : state));
    }
  },

  clearError: () => set({ error: null }),
  setLoading: (loading: boolean) => set({ isLoading: loading }),
  setGoogleLoading: (loading: boolean) => set({ isGoogleLoading: loading }),
}));

// Google OAuth configuration
export const googleConfig = {
  // These should be set in your .env file
  expoClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_EXPO,
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_ANDROID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB,
};

// Helper hook for Google authentication
export function useGoogleAuth() {
  const [request, response, promptAsync] = Google.useAuthRequest({
    expoClientId: googleConfig.expoClientId,
    iosClientId: googleConfig.iosClientId,
    androidClientId: googleConfig.androidClientId,
    webClientId: googleConfig.webClientId,
  });

  return { request, response, promptAsync };
}

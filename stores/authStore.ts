import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  avatar_url?: string | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (email: string, password: string, name: string, phone: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  user: null,
  isLoading: false,
  error: null,

  login: async (email: string, password: string, rememberMe: boolean = false) => {
    try {
      set({ isLoading: true, error: null });
      
      const { data: { user }, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, phone, avatar_url')
          .eq('id', user.id)
          .single();

        if (rememberMe) {
          await SecureStore.setItemAsync('rememberMe', 'true');
        } else {
          await SecureStore.deleteItemAsync('rememberMe');
        }

        set({
          isAuthenticated: true,
          user: {
            id: user.id,
            email: user.email!,
            name: profile?.name,
            phone: profile?.phone,
            avatar_url: profile?.avatar_url,
          },
          isLoading: false,
        });

        router.replace('/(tabs)');
      }
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  register: async (email: string, password: string, name: string, phone: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data: { user }, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;

      if (user) {
        // Create profile
        const { error: profileError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              name,
              phone,
              email,
            },
          ]);

        if (profileError) throw profileError;

        set({
          isAuthenticated: true,
          user: {
            id: user.id,
            email: user.email!,
            name,
            phone,
          },
          isLoading: false,
        });

        router.replace('/(tabs)');
      }
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true, error: null });
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      await SecureStore.deleteItemAsync('rememberMe');

      set({
        isAuthenticated: false,
        user: null,
        isLoading: false,
      });

      router.replace('/auth');
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
}));
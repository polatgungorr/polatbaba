import { useEffect, useState } from 'react';
import { Redirect, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../stores/authStore';
import { supabase } from '../lib/supabase';
import { View, ActivityIndicator } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export default function RootLayout() {
  const { isAuthenticated, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const rememberMe = await SecureStore.getItemAsync('rememberMe');

      if (session?.user && (rememberMe === 'true' || !rememberMe)) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, phone')
          .eq('id', session.user.id)
          .single();

        useAuthStore.setState({
          isAuthenticated: true,
          user: {
            id: session.user.id,
            email: session.user.email!,
            name: profile?.name,
            phone: profile?.phone,
          },
        });
      } else if (!rememberMe) {
        await supabase.auth.signOut();
        useAuthStore.setState({
          isAuthenticated: false,
          user: null,
        });
      }
      setIsLoading(false);
    };

    checkSession();

    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('name, phone')
          .eq('id', session.user.id)
          .single();

        useAuthStore.setState({
          isAuthenticated: true,
          user: {
            id: session.user.id,
            email: session.user.email!,
            name: profile?.name,
            phone: profile?.phone,
          },
        });
      } else {
        useAuthStore.setState({
          isAuthenticated: false,
          user: null,
        });
      }
    });
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#0e1d46" />
      </View>
    );
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Stack.Screen name="auth" />
        ) : (
          <Stack.Screen name="(tabs)" />
        )}
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}
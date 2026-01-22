import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/store/authStore';

export default function Index() {
  const router = useRouter();
  const { isAuthenticated, isLoading, isGoogleLoading } = useAuthStore();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (isLoading || isGoogleLoading) return;
    if (hasRedirected.current) return;
    hasRedirected.current = true;
    if (isAuthenticated) {
      router.replace('/(tabs)/tasks');
    } else {
      router.replace('/(auth)/login');
    }
  }, [isAuthenticated, isLoading, isGoogleLoading, router]);

  // Fallback: force redirect after 3s if still on index with auth ready
  useEffect(() => {
    const t = setTimeout(() => {
      if (hasRedirected.current) return;
      hasRedirected.current = true;
      const { isLoading: loading, isGoogleLoading: googleLoading, isAuthenticated: auth } = useAuthStore.getState();
      if (!loading && !googleLoading) {
        if (auth) router.replace('/(tabs)/tasks');
        else router.replace('/(auth)/login');
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3B82F6" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F172A',
  },
});

import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function DashboardScreen() {
  const [connectionStatus, setConnectionStatus] = useState<'Checking...' | 'Connected' | 'Error'>('Checking...');

  useEffect(() => {
    async function checkConnection() {
      try {
        // Attempt a very simple query to see if the client can reach the server.
        // Even if the 'exercises' table doesn't exist yet, a response from Supabase confirms connectivity.
        const { error } = await supabase.from('exercises').select('id').limit(1);
        
        if (error && error.message.includes('fetch')) {
          setConnectionStatus('Error');
        } else {
          setConnectionStatus('Connected');
        }
      } catch (err) {
        setConnectionStatus('Error');
      }
    }
    checkConnection();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>You have 3 workouts planned for this week.</Text>
      </View>

      <View style={[styles.statusBox, connectionStatus === 'Connected' ? styles.success : styles.error]}>
        <Text style={styles.statusText}>Supabase Status: {connectionStatus}</Text>
      </View>

      {/* Add summary cards here */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.7,
  },
  statusBox: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: 'center',
    borderWidth: 1,
  },
  success: { backgroundColor: '#d1fae5', borderColor: '#10b981' },
  error: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  statusText: { fontWeight: 'bold', color: '#1f2937' },
});
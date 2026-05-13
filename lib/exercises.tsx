import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, FlatList, ActivityIndicator } from 'react-native';
import { supabase } from '@/lib/supabase';

export default function ExercisesScreen() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchExercises() {
      const { data, error } = await supabase.from('exercises').select('*');
      if (error) console.error('Error fetching exercises:', error);
      else setExercises(data || []);
      setLoading(false);
    }

    fetchExercises();
  }, []);

  if (loading) {
    return <ActivityIndicator style={{ flex: 1 }} size="large" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={exercises}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => <Text style={styles.item}>{item.name}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  item: { padding: 15, fontSize: 18, borderBottomWidth: 1, borderBottomColor: '#ccc' },
});
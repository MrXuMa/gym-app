import { StyleSheet, Text, View, FlatList } from 'react-native';

const MOCK_EXERCISES = [{ id: '1', name: 'Bench Press' }, { id: '2', name: 'Squat' }];

export default function ExercisesScreen() {
  return (
    <View style={styles.container}>
      <FlatList
        data={MOCK_EXERCISES}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <Text style={styles.item}>{item.name}</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  item: { padding: 15, fontSize: 18, borderBottomWidth: 1, borderBottomColor: '#ccc' },
});

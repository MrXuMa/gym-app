import { StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { Link } from 'expo-router';

export default function WorkoutsScreen() {
  return (
    <View style={styles.container}>
      <Link href="/modal" asChild>
        <TouchableOpacity style={styles.startButton}>
          <Text style={styles.buttonText}>Start Empty Workout</Text>
        </TouchableOpacity>
      </Link>
      <Text style={styles.historyTitle}>Recent History</Text>
      {/* Map through workout history here */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  startButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  historyTitle: { marginTop: 30, fontSize: 18, fontWeight: '600' },
});

import { Text, View } from 'react-native';
import { workoutEditorStyles as styles } from '@/components/workout-session/workoutEditorStyles';

type WorkoutMetaHeaderProps = {
  title: string;
  subtitle?: string;
};

export function WorkoutMetaHeader({ title, subtitle }: WorkoutMetaHeaderProps) {
  return (
    <View style={styles.metaCard}>
      <Text style={styles.metaTitle} numberOfLines={2}>
        {title}
      </Text>
      {subtitle ? <Text style={styles.metaSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NameWorkoutModal } from '@/components/workout-session/NameWorkoutModal';
import { getActiveWorkoutSession } from '@/lib/workoutSession';
import { createWorkoutSession } from '@/lib/workouts';
import { homeTheme } from '@/constants/theme';

type TabItem = {
  routeName: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const LEFT_TABS: TabItem[] = [
  { routeName: 'metrics', label: 'Metrics', icon: 'stats-chart-outline' },
  { routeName: 'workouts', label: 'Workouts', icon: 'barbell-outline' },
];

const RIGHT_TABS: TabItem[] = [
  { routeName: 'friends', label: 'Friends', icon: 'people-outline' },
  { routeName: 'tasks', label: 'Tasks', icon: 'checkbox-outline' },
];

const HOME_TAB: TabItem = {
  routeName: 'index',
  label: 'Home',
  icon: 'home-outline',
};

export function MainTabBar({ state, navigation }: BottomTabBarProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [starting, setStarting] = useState(false);
  const [nameModalVisible, setNameModalVisible] = useState(false);

  async function handleStartWorkout() {
    try {
      const active = await getActiveWorkoutSession();
      if (active) {
        setStarting(true);
        router.push({ pathname: '/workout-session', params: { workoutId: active.id } });
        return;
      }

      setNameModalVisible(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start workout.';
      Alert.alert('Could not start workout', message);
    } finally {
      setStarting(false);
    }
  }

  async function handleConfirmWorkoutName(title: string) {
    setStarting(true);

    try {
      const workoutId = await createWorkoutSession(title);
      setNameModalVisible(false);
      router.push({ pathname: '/workout-session', params: { workoutId } });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not start workout.';
      Alert.alert('Could not start workout', message);
    } finally {
      setStarting(false);
    }
  }

  function navigate(routeName: string) {
    const routeIndex = state.routes.findIndex((route) => route.name === routeName);
    if (routeIndex === -1) {
      return;
    }

    const event = navigation.emit({
      type: 'tabPress',
      target: state.routes[routeIndex].key,
      canPreventDefault: true,
    });

    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }

  function isFocused(routeName: string) {
    const current = state.routes[state.index];
    return current.name === routeName;
  }

  return (
    <>
      <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
        <View style={styles.tabRow}>
          {LEFT_TABS.map((tab) => (
            <TabButton
              key={tab.routeName}
              label={tab.label}
              icon={tab.icon}
              focused={isFocused(tab.routeName)}
              onPress={() => navigate(tab.routeName)}
            />
          ))}

          <TabButton
            label={HOME_TAB.label}
            icon={HOME_TAB.icon}
            focused={isFocused(HOME_TAB.routeName)}
            onPress={() => navigate(HOME_TAB.routeName)}
          />

          {RIGHT_TABS.map((tab) => (
            <TabButton
              key={tab.routeName}
              label={tab.label}
              icon={tab.icon}
              focused={isFocused(tab.routeName)}
              onPress={() => navigate(tab.routeName)}
            />
          ))}
        </View>

        <View style={styles.startWorkoutRow}>
          <Pressable
            style={[styles.startWorkoutButton, starting && styles.startWorkoutDisabled]}
            onPress={handleStartWorkout}
            disabled={starting}
            accessibilityRole="button"
            accessibilityLabel="Start workout"
          >
            {starting && !nameModalVisible ? (
              <ActivityIndicator color={homeTheme.colors.tabBar} />
            ) : (
              <Text style={styles.startWorkoutLabel}>Start Workout</Text>
            )}
          </Pressable>
        </View>
      </View>

      <NameWorkoutModal
        visible={nameModalVisible}
        submitting={starting}
        onCancel={() => setNameModalVisible(false)}
        onConfirm={handleConfirmWorkoutName}
      />
    </>
  );
}

type TabButtonProps = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  focused: boolean;
  onPress: () => void;
};

function TabButton({ label, icon, focused, onPress }: TabButtonProps) {
  const color = focused ? homeTheme.colors.tabActive : homeTheme.colors.tabInactive;

  return (
    <Pressable style={styles.tab} onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={22} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: homeTheme.colors.tabBar,
    borderTopWidth: 1,
    borderTopColor: homeTheme.colors.surfaceBorder,
    paddingTop: 8,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    gap: 4,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.25,
  },
  startWorkoutRow: {
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: homeTheme.spacing.screen,
  },
  startWorkoutButton: {
    width: '100%',
    minHeight: 52,
    backgroundColor: homeTheme.colors.navYellow,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startWorkoutDisabled: {
    opacity: 0.7,
  },
  startWorkoutLabel: {
    color: homeTheme.colors.tabBar,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.75,
    textTransform: 'uppercase',
  },
});

import { Tabs } from 'expo-router';
import { MainTabBar } from '@/components/navigation/MainTabBar';

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(props) => <MainTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', href: null }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      <Tabs.Screen name="workouts" options={{ title: 'Workouts' }} />
      <Tabs.Screen name="friends" options={{ title: 'Friends' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
    </Tabs>
  );
}

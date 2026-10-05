import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { C } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#1C1C1E', borderTopColor: C.border },
      tabBarActiveTintColor: C.text, tabBarInactiveTintColor: C.muted,
      sceneStyle: { backgroundColor: C.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Today', tabBarIcon: ({ color }) => <Feather name="calendar" size={20} color={color} /> }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: ({ color }) => <Feather name="check-square" size={20} color={color} /> }} />
      <Tabs.Screen name="focus" options={{ title: 'Focus', tabBarIcon: ({ color }) => <Feather name="clock" size={20} color={color} /> }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: ({ color }) => <Feather name="more-horizontal" size={20} color={color} /> }} />
    </Tabs>
  );
}

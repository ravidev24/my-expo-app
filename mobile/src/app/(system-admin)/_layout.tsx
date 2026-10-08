import { Stack } from 'expo-router';

export default function SystemAdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="users" />
    </Stack>
  );
}

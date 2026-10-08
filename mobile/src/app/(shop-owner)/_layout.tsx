import { Stack } from 'expo-router';

export default function ShopOwnerLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: 'transparent' },
      }}
    >
      <Stack.Screen name="customers" />
      <Stack.Screen name="add-customer" />
      <Stack.Screen name="customer/[id]" />
      <Stack.Screen name="galla" />
      <Stack.Screen name="regulars" />
      <Stack.Screen name="qr-standee" />
    </Stack>
  );
}

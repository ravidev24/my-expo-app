import { Image, Platform, StyleSheet, View } from 'react-native';
import { useColorScheme } from 'nativewind';

const photo = require('../../assets/images/using-smartphone-standing-woman-shopping-260nw-2449705197.webp');
const src = typeof photo === 'string' ? photo : photo?.uri || photo?.default || '';

export function ScreenBg({ children }: { children: React.ReactNode }) {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme !== 'light';

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {Platform.OS === 'web' ? (
        <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <Image source={photo} resizeMode="cover" style={StyleSheet.absoluteFill} />
      )}
      <View style={{ flex: 1, backgroundColor: dark ? 'rgba(15,23,42,0.82)' : 'rgba(255,255,255,0.88)' }}>
        {children}
      </View>
    </View>
  );
}

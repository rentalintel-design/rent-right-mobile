import { View, type ViewProps } from 'react-native';
import { useThemeColor } from '@/hooks/use-theme-color';

export function ThemedView({ style, ...otherProps }: ViewProps) {
  const backgroundColor = useThemeColor('bgPage');
  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}

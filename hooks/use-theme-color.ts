import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

type ColorName = keyof typeof Colors.dark;

export function useThemeColor(colorName: ColorName): string {
  const scheme = useColorScheme() ?? 'dark';
  return Colors[scheme][colorName];
}

/** Returns the full color palette for the current scheme */
export function useColors() {
  const scheme = useColorScheme() ?? 'dark';
  return Colors[scheme];
}

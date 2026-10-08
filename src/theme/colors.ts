import { ThemeColors } from './types';
import { lightColors } from './lightTheme';
import { darkColors } from './darkTheme';
import { currentActiveTheme } from './ThemeContext';

export { lightColors, darkColors };

// Dynamic proxy that always reads from the active theme while maintaining 100% backward compatibility
export const colors: ThemeColors = new Proxy(lightColors, {
  get(_target, prop: string | symbol) {
    if (typeof prop === 'string') {
      const active = currentActiveTheme?.colors;
      if (active && prop in active) {
        return (active as any)[prop];
      }
    }
    return (lightColors as any)[prop];
  },
});

export type Colors = ThemeColors;

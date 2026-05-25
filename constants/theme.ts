/**
 * Design tokens from shadcn-rn "amber-minimal" (dark).
 * @see https://ui.shadcn.com — applied via user-shadcn-rn MCP theme preset.
 */
export const homeTheme = {
  colors: {
    background: '#171717',
    foreground: '#e5e5e5',
    card: '#262626',
    cardForeground: '#e5e5e5',
    popover: '#262626',
    primary: '#f59e0b',
    primaryForeground: '#000000',
    secondary: '#262626',
    secondaryForeground: '#e5e5e5',
    muted: '#1f1f1f',
    mutedForeground: '#a3a3a3',
    accent: '#92400e',
    accentForeground: '#fde68a',
    destructive: '#ef4444',
    destructiveForeground: '#ffffff',
    border: '#404040',
    input: '#404040',
    ring: '#f59e0b',

    /** Legacy aliases used across the app */
    surface: '#262626',
    surfaceBorder: '#404040',
    textPrimary: '#e5e5e5',
    textMuted: '#a3a3a3',
    navYellow: '#f59e0b',
    tabBar: '#0f0f0f',
    tabInactive: '#737373',
    tabActive: '#fafafa',
    danger: '#ef4444',
    buttonText: '#000000',
    travertine: '#fde68a',
    bronze: '#d97706',
    footerBar: '#0f0f0f',
  },
  spacing: {
    screen: 20,
    cardGap: 12,
    footerHeight: 128,
  },
  typography: {
    greeting: {
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: -0.5,
    },
    tagline: {
      fontSize: 14,
      fontWeight: '400' as const,
      letterSpacing: 0.15,
    },
    widgetTitle: {
      fontSize: 11,
      fontWeight: '600' as const,
      letterSpacing: 1.2,
      textTransform: 'uppercase' as const,
    },
    widgetValue: {
      fontSize: 32,
      fontWeight: '700' as const,
      letterSpacing: -0.5,
    },
    widgetSubtext: {
      fontSize: 13,
      fontWeight: '400' as const,
      lineHeight: 18,
    },
  },
  radius: {
    card: 8,
    button: 8,
    input: 8,
  },
  home: {
    watermarkOpacity: 0.16,
  },
  auth: {
    overlaySolid: '#171717',
    overlayGradient: ['#171717', 'rgba(23, 23, 23, 0.98)', 'rgba(23, 23, 23, 0.72)', 'rgba(23, 23, 23, 0)'] as const,
    overlayLocations: [0, 0.42, 0.68, 0.88] as const,
    cardBackground: '#262626',
    fieldBackground: '#171717',
  },
} as const;

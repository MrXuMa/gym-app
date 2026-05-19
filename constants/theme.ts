/** Classical architecture aesthetic: stone, shadow, proportion — not historical Rome. */
export const homeTheme = {
  colors: {
    background: '#0a0a0a',
    surface: '#161514',
    surfaceBorder: 'rgba(245, 245, 240, 0.14)',
    travertine: '#e8e4dc',
    textPrimary: '#f5f5f0',
    textMuted: '#a8a29e',
    accent: '#b8956b',
    bronze: '#8c7355',
    danger: '#b91c1c',
    footerBar: '#0f0f0f',
    buttonText: '#0a0a0a',
    navYellow: '#FACC15',
    tabBar: '#000000',
    tabInactive: '#737373',
    tabActive: '#FFFFFF',
  },
  spacing: {
    screen: 20,
    cardGap: 14,
    footerHeight: 128,
  },
  typography: {
    greeting: {
      fontSize: 28,
      fontWeight: '600' as const,
      letterSpacing: 0.5,
    },
    tagline: {
      fontSize: 14,
      fontWeight: '400' as const,
      letterSpacing: 0.25,
    },
    widgetTitle: {
      fontSize: 11,
      fontWeight: '600' as const,
      letterSpacing: 2,
      textTransform: 'uppercase' as const,
    },
    widgetValue: {
      fontSize: 32,
      fontWeight: '700' as const,
    },
    widgetSubtext: {
      fontSize: 13,
      fontWeight: '400' as const,
    },
  },
  radius: {
    card: 4,
    button: 4,
  },
  home: {
    watermarkOpacity: 0.14,
  },
  auth: {
    /** Pure black — matches the image negative space and removes seam on web */
    overlaySolid: '#000000',
    /** Solid black over the form; fades out above the statue */
    overlayGradient: ['#000000', '#000000', 'rgba(0, 0, 0, 0.88)', 'rgba(0, 0, 0, 0)'] as const,
    overlayLocations: [0, 0.36, 0.58, 0.78] as const,
    cardBackground: 'rgba(0, 0, 0, 0.82)',
    fieldBackground: '#000000',
  },
} as const;

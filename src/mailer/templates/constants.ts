export const TIMMBR_BRAND_LOGO_URL =
  'https://pub-dc2a8fc90be54a65b2d2000bed9fc8d2.r2.dev/timmbr-brand-logo.png';

export const TIMMBR_HOUSE_HEART_URL =
  'https://pub-dc2a8fc90be54a65b2d2000bed9fc8d2.r2.dev/house-heart.png';

export const TIMMBR_OTP_CLOCK_ICON_URL =
  'https://pub-dc2a8fc90be54a65b2d2000bed9fc8d2.r2.dev/clock-3.png';

export const TIMMBR_OTP_SHIELD_ICON_URL =
  'https://pub-dc2a8fc90be54a65b2d2000bed9fc8d2.r2.dev/shield-check.png';

export const TIMMBR_DOWNLOAD_ICON_URL =
  'https://pub-dc2a8fc90be54a65b2d2000bed9fc8d2.r2.dev/download.png';

export const FONT_SANS = "Manrope, 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const FONT_SERIF_DISPLAY = "'DM Serif Display', Georgia, 'Times New Roman', Times, serif";

export const FONT_SCRIPT = 'Caveat, Georgia, serif';

export const EMAIL_BRAND_COLOR = '#9a502e';

export const EMAIL_BRAND_GRADIENT_END = '#d39375';

type EmailThemeProperty = 'color' | 'background-color' | 'border-color';

interface EmailThemeToken {
  property: EmailThemeProperty;
  light: string;
  dark: string;
}

/**
 * Each role renders as class `t-<role>`. Inline styles carry `light`; the layout's generated
 * stylesheet swaps in `dark` for clients that honour prefers-color-scheme or Outlook.com's
 * data-ogsc / data-ogsb dark-mode attributes.
 */
export const EMAIL_THEME = {
  page: { property: 'background-color', light: '#f4efeb', dark: '#1a1714' },
  card: { property: 'background-color', light: '#fffefc', dark: '#24201c' },
  band: { property: 'background-color', light: '#f5ede0', dark: '#2e2823' },
  ticket: { property: 'background-color', light: '#f7f1e6', dark: '#302a24' },
  divider: { property: 'background-color', light: '#e7d6cf', dark: '#3a332d' },
  outline: { property: 'border-color', light: '#e7d6cf', dark: '#3a332d' },
  dash: { property: 'border-color', light: '#e0b29d', dark: '#7a5644' },
  strong: { property: 'color', light: '#232323', dark: '#f4efeb' },
  body: { property: 'color', light: '#3c3c3c', dark: '#d9d0ca' },
  muted: { property: 'color', light: '#746762', dark: '#a59a94' },
  label: { property: 'color', light: '#525252', dark: '#bfb5ae' },
  meta: { property: 'color', light: '#626774', dark: '#a9adb8' },
  link: { property: 'color', light: '#9a502e', dark: '#e0a184' },
} as const satisfies Record<string, EmailThemeToken>;

export type EmailThemeRole = keyof typeof EMAIL_THEME;

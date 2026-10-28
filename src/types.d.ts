export interface MetaData {
  title?: string;
  ignoreTitleTemplate?: boolean;
  canonical?: string;
  description?: string;
  robots?: { index?: boolean; follow?: boolean };
  openGraph?: {
    url?: string;
    siteName?: string;
    images?: { url: string; width?: number; height?: number }[];
    locale?: string;
    type?: string;
  };
  twitter?: { handle?: string; site?: string; cardType?: string };
}
export interface Widget {
  id?: string;
  isDark?: boolean;
  bg?: string;
  classes?: Record<string, string | Record<string, string>>;
}
export interface Headline {
  title?: string;
  subtitle?: string;
  tagline?: string;
  classes?: Record<string, string>;
}

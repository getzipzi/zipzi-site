import messages from './messages.json';
export const languages = [
  { code: 'zh-cn', lang: 'zh-CN', name: '简体中文', path: '/', og: 'zh_CN' },
  { code: 'ja', lang: 'ja', name: '日本語', path: '/ja/', og: 'ja_JP' },
  { code: 'zh-tw', lang: 'zh-TW', name: '繁體中文', path: '/zh-tw/', og: 'zh_TW' },
  { code: 'en', lang: 'en', name: 'English', path: '/en/', og: 'en_US' },
  { code: 'ko', lang: 'ko', name: '한국어', path: '/ko/', og: 'ko_KR' },
] as const;
export type Locale = (typeof languages)[number]['code'];
export const language = (locale: Locale) => languages.find((entry) => entry.code === locale)!;
export function translate(locale: Locale) {
  return (source: string): string => {
    const key = source.replace(/\s+/g, ' ').trim();
    if (locale === 'zh-cn') return key;
    const value = messages[key as keyof typeof messages]?.[locale];
    if (!value) throw new Error(`Missing ${locale} translation: ${key}`);
    return value;
  };
}

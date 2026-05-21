export type Theme = 'dark' | 'light';

const THEME_KEY = 'superglazka_theme';

export class ThemeManager {
  static init(): void {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = saved || (prefersDark ? 'dark' : 'light');
    this.apply(theme);
  }

  static apply(theme: Theme): void {
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(`theme-${theme}`);
    localStorage.setItem(THEME_KEY, theme);
  }

  static toggle(): void {
    const current = document.body.classList.contains('theme-light') ? 'light' : 'dark';
    this.apply(current === 'dark' ? 'light' : 'dark');
  }

  static getCurrent(): Theme {
    return document.body.classList.contains('theme-light') ? 'light' : 'dark';
  }
}

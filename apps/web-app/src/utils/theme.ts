/**
 * Colour mode. The accent theme (`theme-indigo`) is fixed on <html> in index.html;
 * only light/dark is user-togglable. See ADR 0003.
 */
export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'stringlights-theme';

/** A stored preference, or null when absent, unreadable, or not a valid theme. */
export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === 'light' || stored === 'dark' ? stored : null;
  } catch {
    // Private mode and blocked site data both throw here. Fall back to the system.
    return null;
  }
}

export function readSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/** An explicit choice wins; otherwise follow the operating system. */
export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? readSystemTheme();
}

/** Applies the theme to the document and persists it. Persistence is best-effort. */
export function applyTheme(theme: Theme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Persistence is a convenience, not a requirement — the applied class still holds.
  }
}

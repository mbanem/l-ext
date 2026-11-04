// src/webview-ui/src/lib/utils/toggle-theme.ts

export type Theme = 'light' | 'dark'

const THEME_KEY = 'cr-theme'

export function getInitialTheme(): Theme {
  const saved = localStorage.getItem(THEME_KEY) as Theme | null

  if (saved === 'light' || saved === 'dark') {
    return saved
  }

  return document.body.classList.contains('vscode-dark') ? 'dark' : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.crTheme = theme
  localStorage.setItem(THEME_KEY, theme)
}

export function getIcon(theme: Theme) {
  return theme === 'dark' ? '☀️' : '🌙'
}

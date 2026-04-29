import { useEffect, useState, useCallback } from 'react';

type Theme = 'light' | 'dark';

function getInitial(): Theme {
  if (typeof document === 'undefined') return 'light';
  const fromAttr = document.documentElement.dataset.theme as Theme | undefined;
  if (fromAttr === 'light' || fromAttr === 'dark') return fromAttr;
  try {
    const stored = localStorage.getItem('hhl-theme') as Theme | null;
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {}
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getInitial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('hhl-theme', theme);
    } catch {}
  }, [theme]);

  const toggle = useCallback(() => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  }, []);

  return { theme, toggle, setTheme: setThemeState };
}

import { useEffect, useState } from 'react';

// New key: the old 'ff_theme' was written as 'light' for everyone on first visit,
// which would keep existing users out of the new dark default
const KEY = 'belaro_theme';

// Dark unless the user chose light (same rule as the script in index.html)
function readTheme() {
  try { return localStorage.getItem(KEY) !== 'light'; } catch { return true; }
}

// Light/dark toggle. The `dark` class on <html> switches the tokens in global.css.
export function useTheme() {
  const [dark, setDark] = useState(readTheme);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const toggle = () => setDark((d) => {
    try { localStorage.setItem(KEY, d ? 'light' : 'dark'); } catch { /* storage blocked */ }
    return !d;
  });

  return { dark, toggle };
}

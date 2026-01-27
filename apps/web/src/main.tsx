import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/globals.css';
import './i18n';

// Initialize theme from localStorage before render to prevent flash
const storedState = localStorage.getItem('arss-ui');
if (storedState) {
  try {
    const { state } = JSON.parse(storedState);
    const theme = state?.theme || 'system';
    const isDark =
      theme === 'dark' ||
      (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (isDark) {
      document.documentElement.classList.add('dark');
    }
  } catch {
    // Ignore parsing errors
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);

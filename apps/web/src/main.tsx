import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { applyTheme } from './store/useThemeStore';

// Apply saved theme before first render to avoid flash
const saved = localStorage.getItem('deep-theme');
const theme = saved ? (JSON.parse(saved)?.state?.theme ?? 'dark') : 'dark';
applyTheme(theme);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

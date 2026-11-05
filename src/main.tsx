import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';

if (typeof window !== 'undefined') {
  window.addEventListener('contextmenu', (e) => {
    const target = e.target as HTMLElement;
    if (
      target.closest('.file-tree-row') ||
      target.closest('[data-custom-contextmenu]') ||
      target.closest('[data-terminal-area]') ||
      target.closest('.xterm')
    ) {
      return;
    }
    e.preventDefault();
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';

// Tipografia dentro del bundle: la app funciona sin conexion (escritorio) y la
// CSP puede prohibir origenes remotos.
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/inter/900.css';
import '@fontsource/eb-garamond/400.css';
import '@fontsource/eb-garamond/400-italic.css';
import '@fontsource/eb-garamond/500.css';
import '@fontsource/eb-garamond/600.css';
import '@fontsource/eb-garamond/700.css';
import '@fontsource/eb-garamond/700-italic.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/600.css';

import App from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/ui/Toast';
import { registerServiceWorker } from './pwa/registerServiceWorker';
import './index.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('No se encontró el contenedor #root en index.html');
}

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Modo sin conexión del build web; se ignora en Electron y en desarrollo.
registerServiceWorker();

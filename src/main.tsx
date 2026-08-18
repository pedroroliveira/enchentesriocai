import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { HelmetProvider } from '@dr.pogodin/react-helmet';
import AiroErrorBoundary from '../export-plugins/AiroErrorBoundary';
import App from './App';
import './styles/globals.css';

if (import.meta.env.MODE === 'development') {
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex, nofollow';
  document.head.appendChild(meta);
}

const rootElement = document.getElementById('app');
if (!rootElement) throw new Error('Root element not found');

// Nenhum componente usa @tanstack/react-query — as páginas buscam dados com
// fetch + useEffect. O QueryClientProvider foi removido daqui e de
// entry-server.tsx para não embarcar ~12 KB (gzip) de código sem uso. Se algum
// dia entrar um useQuery, basta reintroduzir o provider nos dois arquivos.
const providers = (
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

// Root-level dev error boundary. The inner boundary in App.tsx lives
// inside the route element (so it can catch route render errors before
// React Router swaps in its own error UI), which leaves everything
// OUTSIDE the router uncaught: provider crashes, errors in App itself,
// and render errors in components mounted as siblings of <RouterProvider>
// (e.g. an analytics loader calling useLocation() outside the router).
// Those throw on first render before the inner boundary ever mounts, so
// only an ancestor boundary above the providers can catch them. This
// boundary also owns the global window.onerror/unhandledrejection
// handlers (the inner one opts out via captureGlobalErrors={false}).
const tree = (
  <StrictMode>
    {import.meta.env.MODE === 'development' ? (
      <AiroErrorBoundary>{providers}</AiroErrorBoundary>
    ) : (
      providers
    )}
  </StrictMode>
);

// SSR markup is detected via a child element inside the #app root. hydrateRoot
// reattaches to the server-rendered tree; createRoot mounts fresh for dev/
// pre-SSR fallback.
if (rootElement.firstElementChild) {
  hydrateRoot(rootElement, tree);
} else {
  createRoot(rootElement).render(tree);
}

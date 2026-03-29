import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
// Automatic reload on chunk load error
window.addEventListener('error', (e) => {
  if (/Loading chunk [\d]+ failed/.test(e.message) || /Failed to load module script/.test(e.message)) {
    window.location.reload();
  }
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(attempt * 1000, 5000),
      staleTime: 5 * 1000, // 5 seconds default stale time
    },
  },
});

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
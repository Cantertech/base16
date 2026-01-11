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

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
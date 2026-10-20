import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AgentActivityProvider } from './hooks/use-agent-activity';
import { ToastProvider } from './hooks/use-toast';
import { CommandPaletteProvider } from './hooks/use-command-palette';
import { HttpError, getToken, subscribeToken } from './lib/http';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      // Retrying a 401 only delays the redirect to /login.
      retry: (count, err) => !(err instanceof HttpError && err.status === 401) && count < 1,
    },
  },
});

// Signing out must never leave another operator's data in the cache.
subscribeToken(() => {
  if (!getToken()) queryClient.clear();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AgentActivityProvider>
          <ToastProvider>
            <CommandPaletteProvider>
              <App />
            </CommandPaletteProvider>
          </ToastProvider>
        </AgentActivityProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>
);

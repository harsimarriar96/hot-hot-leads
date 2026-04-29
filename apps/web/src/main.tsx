import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AgentActivityProvider } from './hooks/use-agent-activity';
import { ToastProvider } from './hooks/use-toast';
import { CommandPaletteProvider } from './hooks/use-command-palette';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      retry: 1,
    },
  },
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

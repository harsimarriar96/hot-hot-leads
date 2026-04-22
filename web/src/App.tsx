import { Navigate, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import { AppShell } from './components/app-shell';
import { ChatPage } from './pages/chat-page';
import { DashboardPage } from './pages/dashboard-page';

export default function App() {
  return (
    <TooltipProvider delayDuration={200} skipDelayDuration={100}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<ChatPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/dashboard/:tab" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </TooltipProvider>
  );
}

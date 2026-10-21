import { Clock, LayoutDashboard, MessagesSquare, Package, Settings, type LucideIcon } from 'lucide-react';
import { useAuth } from './use-auth';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
  soon?: boolean;
}

/** Primary navigation, filtered by the active organization's entitlements. */
export function useNavItems(): NavItem[] {
  const { hasFeature } = useAuth();
  const items: NavItem[] = [{ to: '/products', label: 'Products', icon: Package, end: false }];
  if (hasFeature('chat')) items.push({ to: '/chat', label: 'Chat', icon: MessagesSquare, end: true });
  items.push({ to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, end: false });
  if (hasFeature('schedules')) items.push({ to: '/schedules', label: 'Schedules', icon: Clock, end: false, soon: true });
  items.push({ to: '/settings', label: 'Settings', icon: Settings, end: false });
  return items;
}

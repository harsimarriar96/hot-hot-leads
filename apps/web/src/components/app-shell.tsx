import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from './ui/badge';
import { ThemeToggle } from './theme-toggle';
import { ProductSwitcher } from './product-switcher';
import { OrgSwitcher } from './org-switcher';
import { UserMenu } from './user-menu';
import { AgentActivityStrip } from './agent-activity-strip';
import { useCommandPalette } from '@/hooks/use-command-palette';
import { useNavItems } from '@/hooks/use-nav-items';
import { useAuth } from '@/hooks/use-auth';

function Logo({ className }: { className?: string }) {
  const counter = 'fill-[var(--app)]';
  return (
    <svg
      viewBox="118 285 1044 262"
      role="img"
      aria-label="HotHotLeads"
      className={cn('block w-auto select-none text-[var(--text)]', className)}
    >
      <path
        fill="#FF4500"
        d="M237.939 315.573C238.548 316.755 238.607 400.608 238.63 409.497C250.843 389.76 265.195 369.935 278.078 350.367L277.989 476.625C264.57 489.42 251.691 503.48 238.309 516.539L238.174 434.284L238.115 423.639C207.888 453.741 177.895 484.078 148.139 514.647L148.108 452.708C155.711 439.216 170.287 418.648 179.191 405.147L237.939 315.573Z"
      />
      <g fill="currentColor">
        <path d="M792.406 389.463L812.592 389.437L812.78 466.192L855.993 466.28C854.496 460.835 854.139 458.042 853.665 452.3C850.862 418.348 886.616 400.564 912.173 422.16C922.082 430.533 921.896 443.201 921.954 455.649C906.553 455.606 891.152 455.686 875.753 455.89L875.166 456.105C870.376 463.261 890.736 482.638 901.701 462.541L920.668 462.549C919.805 464.883 918.94 467.167 917.879 469.428C908.76 488.87 880.289 492.276 864.787 478.802C860.969 475.484 859.301 472.689 856.79 468.354L856.779 485.049L792.45 484.853L792.406 389.463Z" />
        <path d="M1041.37 389.506L1061.71 389.49C1061.52 421.292 1061.51 453.095 1061.7 484.897L1041.78 485.045L1041.73 475.896C1033.01 486.964 1027 487.861 1013.33 486.118C1008.76 484.724 1004.62 482.781 1001.24 479.346C987.598 465.514 988.358 434.534 1001.64 421.006C1006.94 415.613 1014.19 412.595 1021.74 412.64C1030.51 412.723 1035.41 416.249 1041.27 422.13L1041.37 389.506Z" />
        <path d="M399.646 389.462L421.46 389.421L421.586 456.017C421.605 459.972 421.967 482.422 421.352 484.511L420.048 484.894L399.512 484.963L399.504 445.007C387.759 444.864 375.707 445.015 363.938 445.027C363.77 458.111 364.068 471.854 364.148 484.989C357.197 485.099 350.014 484.916 343.044 484.825C342.849 453.042 342.837 421.257 343.007 389.473L364.103 389.453C363.98 401.609 364.161 414.017 364.218 426.193C375.964 426.265 387.71 426.274 399.455 426.219L399.646 389.462Z" />
        <path d="M567.619 389.434L588.662 389.388L588.731 426.174L624.336 426.402L624.403 389.469L646.306 389.465C646.302 398.252 646.683 483.018 645.698 484.613L643.906 484.946C637.552 485.012 630.759 484.746 624.372 484.603L624.324 445.044L588.773 445.173L588.775 484.776C581.779 484.842 574.578 484.695 567.565 484.638L567.619 389.434Z" />
        <path d="M456.127 413.609C476.312 410.433 495.229 424.286 498.296 444.492C501.364 464.697 487.412 483.542 467.193 486.502C447.127 489.44 428.458 475.613 425.413 455.56C422.369 435.507 436.093 416.761 456.127 413.609Z" />
        <path d="M680.411 413.641C700.577 410.436 719.5 424.253 722.591 444.44C725.682 464.626 711.761 483.474 691.561 486.452C671.52 489.407 652.857 475.618 649.79 455.591C646.723 435.565 660.405 416.821 680.411 413.641Z" />
        <path d="M948.676 413.359C957.669 412.248 970.952 413.659 978.466 419.015C982.243 421.693 985.004 425.569 986.302 430.013C988.968 438.919 986.421 470.066 988.746 484.948L969.142 484.973L967.54 478.197C956.913 488.642 939.942 490.327 928.68 479.991C916.17 464.494 927.887 443.724 946.377 443.256C952.096 443.111 963.92 442.852 966.486 437.541C966.135 428.545 957.224 426.66 950.294 429.931C946.911 431.528 946.282 434.266 945.351 437.572C940.101 437.558 933.436 437.688 928.2 437.149C926.457 436.97 926.038 435.946 925.311 434.768C925 431.493 927.478 427.578 929.408 425.012C934.923 417.679 939.926 414.819 948.676 413.359Z" />
        <path d="M1091.89 413.392C1112.51 411.64 1125.25 416.239 1130.17 437.221C1125.25 437.703 1116.52 437.469 1111.31 437.475C1106.46 422.124 1088.87 427.786 1088.96 435.53C1092.23 444.134 1118.58 440.821 1126.96 449.647C1130.23 452.525 1131.9 455.892 1132.21 460.401C1133.48 478.824 1120.4 485.347 1104.53 486.649C1085 487.293 1070.43 483.729 1067.66 461.846L1086.65 461.814C1087.43 464.74 1088.02 467.47 1090.69 469.488C1095.73 473.438 1106.61 473.802 1110.71 468.388C1113.25 464.572 1109.12 460.75 1105.86 459.694C1093.42 455.654 1071.17 457.111 1068.79 439.962C1066.4 422.813 1076.48 415.623 1091.89 413.392Z" />
        <path d="M506.144 396.422L526.005 396.429L526.141 415.074L537.123 415.18L537.236 429.638C533.648 429.818 529.84 429.863 526.229 429.968C526.169 437.128 524.737 466.226 528.259 469.915C530.944 470.964 534.353 470.608 537.298 470.52L537.404 484.884C535.774 486.163 529.765 486.17 527.593 486.344C504.948 488.157 505.504 473.36 506.016 455.683C506.228 448.394 506.036 437.916 505.988 429.955L496.764 429.993L496.958 415.008L506.029 414.912L506.144 396.422Z" />
        <path d="M730.51 396.419C737.179 396.316 743.85 396.398 750.515 396.665L750.526 415.327L761.279 415.17L761.273 429.82L750.471 429.674C750.423 436.9 749.309 462.271 751.869 469.408C752.422 470.949 759.177 470.702 761.459 470.693L761.468 484.96C759.878 486.233 754.129 486.196 751.993 486.373C729.863 488.204 729.847 474.638 730.44 457.127C730.706 449.26 730.568 438.063 730.623 429.546L721.354 429.569L721.357 414.816L730.465 414.859L730.51 396.419Z" />
      </g>
      <g>
        <path className={counter} d="M886.484 428.892C896.747 429.134 899.793 433.082 901.752 442.472L891.326 442.529C885.487 442.567 879.648 442.569 873.809 442.535C876.626 434.95 877.9 431.085 886.484 428.892Z" />
        <path className={counter} d="M1023.1 430.224C1026.05 430.036 1028.89 429.762 1031.74 430.933C1045.19 436.458 1044.64 464.382 1031.31 469.497L1029.89 470.028C1011.48 471.069 1009.69 453.293 1013.76 439.441C1015.21 434.52 1018.61 432.18 1023.1 430.224Z" />
        <path className={counter} d="M458.091 430.184C465.091 429.588 472.488 430.52 474.809 438.217C478.202 449.468 478.567 464.708 465.953 469.659C459.226 470.305 451.363 469.136 449.064 461.984C445.36 450.466 445.515 435.402 458.091 430.184Z" />
        <path className={counter} d="M683.169 430.239C695.64 429.743 700.107 434.105 700.787 446.887C701.345 457.39 700.711 466.418 689.132 469.985C681.802 470.363 675.024 468.633 673.061 460.702C670.207 449.176 669.935 434.44 683.169 430.239Z" />
        <path className={counter} d="M965.875 453.957C966.015 453.941 966.756 453.78 966.799 454.172C968.393 468.707 959.627 474.297 946.63 470.737C945.669 469.688 944.116 468.083 943.788 466.639C940.848 453.701 956.818 456.506 965.875 453.957Z" />
      </g>
    </svg>
  );
}

function PageHeader() {
  const loc = useLocation();
  const nav = useNavItems();
  const active = nav.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)));
  const title = active?.label ?? 'HotHotLeads';
  const showProductSwitcher = loc.pathname.startsWith('/chat');
  return (
    <header className="hidden md:flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--app)] px-6 h-12 shrink-0">
      <h1 className="text-sm font-semibold text-[var(--text)] truncate">{title}</h1>
      <div className="flex items-center gap-2 shrink-0">
        {showProductSwitcher && (
          <>
            <ProductSwitcher />
            <div className="hidden sm:block w-px h-5 bg-[var(--border)]" />
          </>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}

function CommandHint() {
  const { setOpen } = useCommandPalette();
  return (
    <div className="px-3 pt-3 pb-1">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-between w-full h-7 px-2 rounded-md border border-[var(--border)] bg-[var(--app)] font-mono text-[10px] text-[var(--text-tertiary)] hover:text-[var(--text)] hover:border-[var(--border-strong)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
      >
        <span>Search & run</span>
        <span>⌘K</span>
      </button>
    </div>
  );
}

function DesktopSidebar() {
  const nav = useNavItems();
  const { isPlatformAdmin } = useAuth();
  return (
    <aside className="hidden md:flex w-56 shrink-0 min-h-0 flex-col overflow-y-auto border-r border-[var(--border)] bg-[var(--surface-2)]">
      <div className="flex items-center h-12 px-4 border-b border-[var(--border)]">
        <NavLink to="/products" aria-label="HotHotLeads home" className="block">
          <Logo className="h-7" />
        </NavLink>
      </div>
      <div className="px-2 pt-2">
        <OrgSwitcher />
      </div>
      <CommandHint />
      <nav className="flex-1 flex flex-col gap-0.5 px-2 py-3">
        {nav.map(({ to, icon: Icon, label, end, soon }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-2.5 h-9 px-2.5 rounded-md',
                'text-sm text-[var(--text-secondary)] transition-colors duration-150',
                'hover:text-[var(--text)] hover:bg-[var(--surface-hover)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]',
                isActive && 'text-[var(--text)] bg-[var(--surface)] font-medium',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4', isActive && 'text-[var(--accent)]')} />
                <span className="truncate">{label}</span>
                {soon && <Badge className="ml-auto">Soon</Badge>}
                {isActive && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[2px] rounded-full bg-[var(--accent)]"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="px-2 pb-3 space-y-1">
        {isPlatformAdmin && (
          <NavLink
            to="/platform"
            className="flex items-center gap-2.5 h-9 px-2.5 rounded-md text-sm text-[var(--text-secondary)] hover:text-[var(--text)] hover:bg-[var(--surface-hover)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>Platform</span>
          </NavLink>
        )}
        <UserMenu />
      </div>
    </aside>
  );
}

function MobileTopBar() {
  const loc = useLocation();
  return (
    <header className="md:hidden flex items-center justify-between h-12 px-4 border-b border-[var(--border)] bg-[var(--app)]">
      <NavLink to="/products" aria-label="HotHotLeads home">
        <Logo className="h-7" />
      </NavLink>
      <div className="flex items-center gap-2">
        {loc.pathname.startsWith('/chat') && <ProductSwitcher />}
        <ThemeToggle />
        <UserMenu compact />
      </div>
    </header>
  );
}

function MobileTabBar() {
  const nav = useNavItems();
  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)]">
      {/* Column count follows the entitlement-filtered items; Tailwind cannot generate it dynamically. */}
      <div className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
        {nav.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px]',
                'text-[var(--text-tertiary)] transition-colors duration-150',
                isActive && 'text-[var(--text)]',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('h-4 w-4', isActive && 'text-[var(--accent)]')} />
                <span className="font-medium">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

function SupportModeBanner() {
  const { activeOrg, isSupportMode, organizations, switchOrganization } = useAuth();
  const navigate = useNavigate();
  if (!isSupportMode || !activeOrg) return null;
  return (
    <div className="flex items-center justify-between gap-3 h-7 px-4 bg-[var(--accent-soft)] text-[var(--accent-soft-text)] text-xs">
      <span className="truncate">
        Support mode · <strong>{activeOrg.name}</strong>
      </span>
      <button
        type="button"
        className="font-medium underline-offset-2 hover:underline"
        onClick={() => void switchOrganization(organizations[0]?.id ?? null).then(() => navigate('/platform'))}
      >
        Exit
      </button>
    </div>
  );
}

export function AppShell() {
  return (
    // The shell is clipped to the viewport so the document itself never scrolls:
    // only <main> (and the sidebar, when the window is too short) scroll.
    <div className="flex flex-col h-full overflow-hidden bg-[var(--app)]">
      <SupportModeBanner />
      <AgentActivityStrip />
      <div className="flex flex-1 min-h-0">
        <DesktopSidebar />
        <div className="flex-1 flex flex-col min-w-0 min-h-0 pb-16 md:pb-0">
          <MobileTopBar />
          <PageHeader />
          {/* The page scrolls inside main so the sidebar and header stay put.
              overscroll-contain stops a wheel/trackpad scroll past the end of the
              page from chaining to the document and dragging the sidebar with it. */}
          <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            <Outlet />
          </main>
        </div>
        <MobileTabBar />
      </div>
    </div>
  );
}

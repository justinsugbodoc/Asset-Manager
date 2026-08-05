import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Calendar, FileText, MessageSquare, CreditCard, User, Bell, Pill, ShieldCheck, LogOut, PanelLeftClose, PanelLeftOpen, EyeOff } from 'lucide-react';
import Logo from '@/components/brand/logo';
import { useAuth } from '@/hooks/use-auth';
import { useSidebarMode } from '@/hooks/use-sidebar-mode';

type ShellProps = {
  children: ReactNode;
  title: string;
};

export default function AppShell({ children, title }: ShellProps) {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();
  const { sidebarMode, setSidebarMode } = useSidebarMode();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Calendar, label: 'Appointments', path: '/appointments' },
    { icon: FileText, label: 'Records', path: '/records' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: Pill, label: 'Medications', path: '/medications' },
    { icon: CreditCard, label: 'Billing', path: '/billing' },
    { icon: User, label: 'Profile', path: '/profile' },
    { icon: ShieldCheck, label: 'Insurance Claims', path: '/insurance-claims' }
  ];

  return (
    <div className="flex h-[100dvh] w-full bg-slate-50 dark:bg-background overflow-hidden">
      
      {/* Desktop Sidebar (lg and up) */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-border bg-card transition-[width,opacity] duration-200 lg:flex ${
          sidebarMode === 'hidden' ? 'w-0 overflow-hidden border-r-0 opacity-0' : sidebarMode === 'collapsed' ? 'w-[76px]' : 'w-64'
        }`}
        aria-hidden={sidebarMode === 'hidden'}
      >
        <div className={`flex h-16 items-center border-b border-border ${sidebarMode === 'collapsed' ? 'justify-center px-3' : 'justify-between px-5'}`}>
          <Logo compact={sidebarMode === 'collapsed'} />
          {sidebarMode !== 'collapsed' && (
            <button
              type="button"
              onClick={() => setSidebarMode('collapsed')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Collapse sidebar to icons"
              title="Collapse sidebar to icons"
            >
              <PanelLeftClose className="h-5 w-5" />
            </button>
          )}
        </div>
        
        {sidebarMode === 'collapsed' && (
          <div className="flex justify-center border-b border-border py-2">
            <button
              type="button"
              onClick={() => setSidebarMode('expanded')}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Expand sidebar"
              title="Expand sidebar"
            >
              <PanelLeftOpen className="h-5 w-5" />
            </button>
          </div>
        )}

        <nav className={`flex-1 overflow-y-auto py-4 ${sidebarMode === 'collapsed' ? 'px-2' : 'px-3'} space-y-1`}>
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                href={item.path}
                title={sidebarMode === 'collapsed' ? item.label : undefined}
                aria-label={sidebarMode === 'collapsed' ? item.label : undefined}
                className={`flex items-center rounded-lg text-sm font-medium transition-colors ${
                  sidebarMode === 'collapsed' ? 'justify-center px-3 py-3' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {sidebarMode !== 'collapsed' && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
        <div className={`shrink-0 border-t border-border p-3 ${sidebarMode === 'collapsed' ? 'space-y-2' : ''}`}>
          {sidebarMode === 'collapsed' && (
            <button
              type="button"
              onClick={() => setSidebarMode('hidden')}
              className="flex w-full items-center justify-center rounded-lg px-3 py-2.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Hide sidebar"
              title="Hide sidebar"
            >
              <EyeOff className="h-5 w-5" />
            </button>
          )}
          <button
            type="button"
            onClick={() => { logout(); setLocation('/login'); }}
            className={`flex w-full items-center rounded-lg text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive ${
              sidebarMode === 'collapsed' ? 'justify-center px-3 py-2.5' : 'gap-3 px-3 py-2.5'
            }`}
            aria-label="Sign out"
            title={sidebarMode === 'collapsed' ? 'Sign out' : undefined}
          >
            <LogOut className="h-5 w-5 shrink-0" />
            {sidebarMode !== 'collapsed' && <span>Sign out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-border bg-card/50 backdrop-blur-sm z-10 shrink-0 sticky top-0">
          <div className="flex min-w-0 items-center gap-3">
            {sidebarMode === 'hidden' && (
              <button
                type="button"
                onClick={() => setSidebarMode('collapsed')}
                className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:flex"
                aria-label="Show sidebar"
                title="Show sidebar"
              >
                <PanelLeftOpen className="h-5 w-5" />
              </button>
            )}
            <h1 className="truncate text-lg font-semibold text-foreground">{title}</h1>
          </div>
          <button aria-label="Notifications" className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted">
            <Bell className="h-5 w-5" />
            <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full border-2 border-card bg-destructive" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
          <div className="w-full max-w-[1440px]">
            {children}
          </div>
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[68px] bg-card border-t border-border flex items-center justify-around px-1 z-50 pb-safe">
        {navItems.map((item) => {
          // Keep the mobile bar focused on the most-used patient actions.
          if (item.path === '/billing' || item.path === '/medications' || item.path === '/insurance-claims') return null;

          const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path));
          return (
            <Link 
              key={item.path} 
              href={item.path}
              className={`flex flex-col items-center justify-center w-16 h-14 gap-1 rounded-lg ${
                isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`flex items-center justify-center p-1 rounded-full ${isActive ? 'bg-primary/10' : ''}`}>
                <item.icon className={`h-5 w-5 ${isActive ? 'fill-primary/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              <span className="text-[10px] font-medium tracking-tight leading-none">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

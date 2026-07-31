import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Home, Calendar, FileText, MessageSquare, CreditCard, User, Bell, Pill, ShieldCheck, LogOut } from 'lucide-react';
import Logo from '@/components/brand/logo';
import { useAuth } from '@/hooks/use-auth';

type ShellProps = {
  children: ReactNode;
  title: string;
};

export default function AppShell({ children, title }: ShellProps) {
  const [location, setLocation] = useLocation();
  const { logout } = useAuth();

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
      <aside className="hidden lg:flex w-64 flex-col border-r border-border bg-card">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Logo />
        </div>
        
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path));
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive 
                    ? 'bg-primary text-primary-foreground shadow-sm' 
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          <button
            type="button"
            onClick={() => { logout(); setLocation('/login'); }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-border bg-card/50 backdrop-blur-sm z-10 shrink-0 sticky top-0">
          <h1 className="text-lg font-semibold truncate text-foreground">{title}</h1>
          <button className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full bg-destructive border-2 border-card" />
          </button>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-8 pb-24 lg:pb-8">
          <div className="mx-auto max-w-5xl">
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

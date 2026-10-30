import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Activity, FolderKanban, LayoutDashboard, LogOut, Menu, Moon, Plus, Settings, Sun, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { Backdrop } from './Backdrop';
import { NotificationPopup } from './NotificationPopup';
import { can } from '../../lib/permissions';
import { cn } from '../../lib/cn';
import { Avatar, Button, ButtonLink } from '../ui';
import { NotificationBell } from './NotificationBell';

function navItems(user) {
  return [
    { to: '/',         label: 'Dashboard',    icon: LayoutDashboard, end: true },
    { to: '/projects', label: 'Projects',     icon: FolderKanban },
    can.viewActivity(user) && { to: '/activity', label: 'Activity log', icon: Activity },
    can.manageUsers(user) && { to: '/users', label: 'Team members', icon: Users },
    can.openSettings(user) && { to: '/settings', label: 'Settings', icon: Settings },
    { to: '/profile',  label: 'My profile',   icon: UserRound },
  ].filter(Boolean);
}

// Title shown in the top bar for the current URL
function sectionTitle(pathname) {
  if (pathname === '/projects/new') return 'New project';
  if (pathname.startsWith('/projects/')) return 'Project';
  if (pathname.startsWith('/projects')) return 'Projects';
  if (pathname.startsWith('/activity')) return 'Activity log';
  if (pathname.startsWith('/users')) return 'Team members';
  if (pathname.startsWith('/settings')) return 'Settings';
  if (pathname.startsWith('/profile')) return 'My profile';
  return 'Dashboard';
}

function Brand() {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg shadow-sm">B</span>
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-fg">Belaro</span>
        <span className="block text-[11px] text-fg-subtle">Order pipeline</span>
      </span>
    </Link>
  );
}

function Sidebar({ onNavigate }) {
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-header items-center px-5">
        <Brand />
      </div>

      {can.createProject(user) && (
        <div className="px-3 pt-2 pb-3">
          <ButtonLink to="/projects/new" icon={Plus} className="w-full" onClick={onNavigate}>New project</ButtonLink>
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        <p className="px-2.5 pb-1.5 text-[11px] font-medium tracking-wide text-fg-subtle uppercase">Workspace</p>
        {navItems(user).map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'group flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium transition-colors',
              isActive ? 'bg-primary-soft text-primary-soft-fg' : 'text-fg-muted hover:bg-surface-muted hover:text-fg',
            )}
          >
            <Icon className="size-4 shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-1.5">
          <Avatar name={user?.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-fg">{user?.name}</p>
            <p className="truncate text-xs text-fg-subtle capitalize">{user?.roles?.join(', ')}</p>
          </div>
          <Button variant="ghost" size="icon-sm" icon={LogOut} onClick={logout} title="Sign out" aria-label="Sign out" />
        </div>
      </div>
    </div>
  );
}

export function AppLayout({ children }) {
  const [open, setOpen] = useState(false);
  const { dark, toggle } = useTheme();
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen overflow-hidden">
      <Backdrop />
      <NotificationPopup />
      {/* Desktop sidebar */}
      <aside className="hidden w-sidebar shrink-0 border-r border-border bg-surface backdrop-blur-xl lg:block print:hidden">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-overlay" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-sidebar border-r border-border bg-surface shadow-lg backdrop-blur-xl">
            <Button variant="ghost" size="icon-sm" icon={X} onClick={() => setOpen(false)} aria-label="Close navigation" className="absolute top-3.5 right-3" />
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-30 flex h-header shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur sm:px-6 lg:px-8 print:hidden">
          <Button variant="ghost" size="icon-sm" icon={Menu} onClick={() => setOpen(true)} aria-label="Open navigation" className="lg:hidden" />
          <p className="flex-1 truncate text-sm font-medium text-fg">{sectionTitle(pathname)}</p>
          <NotificationBell />
          <Button
            variant="ghost"
            size="icon-sm"
            icon={dark ? Sun : Moon}
            onClick={toggle}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          />
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

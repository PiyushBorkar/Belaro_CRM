import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Outlet, useLocation } from 'react-router';
import { ShieldAlert, WifiOff } from 'lucide-react';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './components/auth/LoginPage';
import { Button, PageSpinner, Spinner } from './components/ui';
import { useAuth } from './features/auth/AuthContext';
import { can } from './lib/permissions';

const DashboardPage      = lazy(() => import('./components/dashboard/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const ProjectsListPage   = lazy(() => import('./components/projects/ProjectsListPage').then((m) => ({ default: m.ProjectsListPage })));
const CreateProjectPage  = lazy(() => import('./components/projects/CreateProjectPage').then((m) => ({ default: m.CreateProjectPage })));
const ProjectDetailPage  = lazy(() => import('./components/projects/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const UsersPage          = lazy(() => import('./components/users/UsersPage').then((m) => ({ default: m.UsersPage })));
const ActivityPage       = lazy(() => import('./components/activity/ActivityPage').then((m) => ({ default: m.ActivityPage })));
const SettingsPage       = lazy(() => import('./components/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const ProfilePage        = lazy(() => import('./components/profile/ProfilePage').then((m) => ({ default: m.ProfilePage })));

// Old links used query strings (?p=project&id=12). Map them to the new paths.
function legacyPath(search) {
  const params = new URLSearchParams(search);
  const p = params.get('p');
  const id = params.get('id');

  if (p === 'project' && id) return `/projects/${id}`;
  if (p === 'projects') return '/projects';
  if (p === 'create')   return '/projects/new';
  if (p === 'users')    return '/users';
  if (p === 'profile')  return '/profile';
  if (p === 'dashboard') return '/';
  return null;
}

function AccessDenied() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-danger-soft text-danger-soft-fg">
          <ShieldAlert className="size-5" />
        </div>
        <p className="text-base font-semibold text-fg">Access denied</p>
        <p className="mt-1 text-sm text-fg-muted">Your account does not have access to Belaro.</p>
        <Button variant="secondary" className="mt-6 w-full" onClick={logout}>Sign out</Button>
      </div>
    </div>
  );
}

// Logged-in shell: sends guests to /login (remembering where they were going)
function ProtectedLayout() {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  if (!can.useApp(user)) return <AccessDenied />;

  return (
    <AppLayout>
      <Suspense fallback={<PageSpinner />}>
        <Outlet />
      </Suspense>
    </AppLayout>
  );
}

// Permission guard for a group of routes; anyone else goes back to the dashboard
function RequirePermission({ check }) {
  const { user } = useAuth();
  return check(user) ? <Outlet /> : <Navigate to="/" replace />;
}

function LoginRoute() {
  const { user } = useAuth();
  const location = useLocation();

  if (user) {
    const from = location.state?.from;
    const to = from ? `${from.pathname}${from.search ?? ''}` : '/';
    return <Navigate to={to} replace />;
  }
  return <LoginPage />;
}

function DashboardRoute() {
  const { search } = useLocation();
  const legacy = legacyPath(search);

  if (legacy) return <Navigate to={legacy} replace />;
  return <DashboardPage />;
}

// The saved session couldn't be checked (server unreachable) — keep it and let the user retry
function ServerUnreachable() {
  const { restoreError, retryRestore, logout } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex size-11 items-center justify-center rounded-xl bg-warning-soft text-warning-soft-fg">
          <WifiOff className="size-5" />
        </div>
        <p className="text-base font-semibold text-fg">Can't reach the server</p>
        <p className="mt-1 text-sm text-fg-muted">You're still signed in. Check your connection and try again.</p>
        <p className="mt-2 text-xs text-fg-subtle">{restoreError?.message}</p>
        <div className="mt-6 flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={logout}>Sign out</Button>
          <Button className="flex-1" onClick={retryRestore}>Retry</Button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { checking, restoreError } = useAuth();

  if (restoreError) return <ServerUnreachable />;

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Spinner className="size-7" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<ProtectedLayout />}>
        <Route index element={<DashboardRoute />} />
        <Route path="projects" element={<ProjectsListPage />} />
        <Route path="projects/:id" element={<ProjectDetailPage />} />
        <Route path="profile" element={<ProfilePage />} />

        <Route element={<RequirePermission check={can.createProject} />}>
          <Route path="projects/new" element={<CreateProjectPage />} />
        </Route>

        <Route element={<RequirePermission check={can.manageUsers} />}>
          <Route path="users" element={<UsersPage />} />
        </Route>

        <Route element={<RequirePermission check={can.viewActivity} />}>
          <Route path="activity" element={<ActivityPage />} />
        </Route>

        <Route element={<RequirePermission check={can.openSettings} />}>
          <Route path="settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

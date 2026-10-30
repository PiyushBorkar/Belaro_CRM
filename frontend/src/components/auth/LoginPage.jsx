import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';
import { Alert, Button, Field, Input } from '../ui';
import { Backdrop } from '../layout/Backdrop';
import { USE_MOCK } from '../../services/api';

// Demo mode only (src/mock): one account per role, all with the password "password"
const DEMO_ACCOUNTS = [
  ['manager@belaro.test', 'Manager'],
  ['designer@belaro.test', 'Designer'],
  ['production@belaro.test', 'Production'],
  ['supervisor@belaro.test', 'Supervisor'],
  ['admin@belaro.test', 'Admin'],
];

function DemoAccounts({ onPick }) {
  const [reset, setReset] = useState(false);
  return (
    <div className="mt-8 rounded-xl border border-border bg-surface-muted/60 p-4">
      <p className="text-xs font-semibold text-fg">Demo mode</p>
      <p className="mt-0.5 text-xs text-fg-muted">Data lives in this browser. Pick an account (password: password).</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {DEMO_ACCOUNTS.map(([email, role]) => (
          <button key={email} type="button" onClick={() => onPick(email)}
            className="cursor-pointer rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-fg transition-colors hover:border-primary hover:text-primary">
            {role}
          </button>
        ))}
      </div>
      <button type="button" disabled={reset}
        onClick={() => import('../../mock/db').then((m) => { m.resetDemo(); setReset(true); })}
        className="mt-3 cursor-pointer text-xs text-fg-subtle underline underline-offset-2 hover:text-fg disabled:cursor-default disabled:no-underline">
        {reset ? 'Demo data reset.' : 'Reset demo data'}
      </button>
    </div>
  );
}

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <Backdrop />
      {/* Form */}
      <div className="flex flex-col px-6 py-10 sm:px-12">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-fg shadow-sm">B</span>
          <span className="text-sm font-semibold tracking-tight text-fg">Belaro</span>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">Welcome back</h1>
          <p className="mt-1.5 text-sm text-fg-muted">Sign in to your workspace to continue.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && <Alert tone="danger">{error}</Alert>}

            <Field label="Email">
              {(id) => (
                <div className="relative">
                  <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                  <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
                    autoComplete="email" placeholder="you@company.com" className="h-10 pl-9" />
                </div>
              )}
            </Field>

            <Field label="Password">
              {(id) => (
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle" />
                  <Input id={id} type={showPass ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                    required autoComplete="current-password" placeholder="••••••••" className="h-10 px-9" />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer text-fg-subtle transition-colors hover:text-fg"
                  >
                    {showPass ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </Field>

            <Button type="submit" size="lg" loading={loading} className="w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {USE_MOCK && <DemoAccounts onPick={(e) => { setEmail(e); setPassword('password'); }} />}
        </div>

        <p className="text-xs text-fg-subtle">Accounts are created by your administrator.</p>
      </div>

      {/* Showcase panel */}
      <div className="relative hidden overflow-hidden border-l border-border bg-surface-muted/60 backdrop-blur-sm lg:block">
        <div
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--border-strong) 1px, transparent 0)', backgroundSize: '22px 22px' }}
        />
        <div className="relative flex h-full flex-col justify-center px-16">
          <div className="max-w-md">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Order pipeline CRM</p>
            <h2 className="mt-3 text-3xl leading-tight font-semibold tracking-tight text-fg">
              Every order, from first visit to installation.
            </h2>
            <p className="mt-4 text-sm leading-6 text-fg-muted">
              Designers, production and managers work from one shared timeline, so nothing waits on a phone call.
            </p>

            <div className="mt-10 space-y-3">
              {[
                ['Token received', 'success'],
                ['Design finalised', 'success'],
                ['In production', 'primary'],
                ['Installation', 'neutral'],
              ].map(([label, tone]) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 shadow-xs">
                  <span className={
                    tone === 'success' ? 'size-2 rounded-full bg-success'
                      : tone === 'primary' ? 'size-2 rounded-full bg-primary ring-4 ring-primary-soft'
                        : 'size-2 rounded-full bg-border-strong'
                  } />
                  <span className="text-sm font-medium text-fg">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

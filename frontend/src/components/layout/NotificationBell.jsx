import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Bell, CheckCheck } from 'lucide-react';
import { cn } from '../../lib/cn';
import { formatDateTime } from '../../lib/format';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '../../services/queries';
import { Button, EmptyState } from '../ui';

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unread = data?.unread ?? 0;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  function openItem(n) {
    if (!n.read) markRead.mutate(n.id);
    setOpen(false);
    if (n.project_id) navigate(`/projects/${n.project_id}`);
  }

  return (
    <div ref={ref} className="relative">
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen((o) => !o)} aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`} className="relative">
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="tabular absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-on-color">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {/* Opaque: inside the header's backdrop-blur a nested blur can't see the page below */}
      {open && (
        <div className="absolute top-full right-0 z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface-solid shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-fg">Notifications</p>
            {unread > 0 && (
              <Button variant="ghost" size="sm" icon={CheckCheck} onClick={() => markAll.mutate()}>Mark all read</Button>
            )}
          </div>
          <div className="scroll-thin max-h-96 overflow-y-auto">
            {!data?.data?.length ? (
              <EmptyState icon={Bell} title="You're all caught up" className="py-10" />
            ) : (
              data.data.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openItem(n)}
                  className={cn('flex w-full cursor-pointer gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-surface-muted', !n.read && 'bg-primary-soft/40')}
                >
                  <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-fg">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs text-fg-muted">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-fg-subtle">{formatDateTime(n.created_at)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowRight, Factory, FolderPlus, Sparkles, Truck } from 'lucide-react';
import { cn } from '../../lib/cn';
import { timeAgo } from '../../lib/format';
import { useMarkNotificationRead, useNotifications } from '../../services/queries';
import { Button, Modal } from '../ui';

// Notifications that also pop up (the rest only appear in the bell). Types come from App\Notifications.
const POPUP_TYPES = {
  ready_for_production:   { icon: Factory,    tone: 'bg-primary-soft text-primary-soft-fg', one: 'New order for production', many: (n) => `${n} new orders for production` },
  ready_for_installation: { icon: Truck,      tone: 'bg-success-soft text-success-soft-fg', one: 'Order dispatched — enter the installation', many: (n) => `${n} orders dispatched` },
  project_assigned:       { icon: FolderPlus, tone: 'bg-info-soft text-info-soft-fg',       one: 'New project assigned to you', many: (n) => `${n} new projects assigned to you` },
};

// "Later" hides an item until the next sign-in (it stays unread in the bell)
const LATER_KEY = 'belaro_popup_later';
function readLater() {
  try { return JSON.parse(sessionStorage.getItem(LATER_KEY)) ?? []; } catch { return []; }
}
function saveLater(ids) {
  try { sessionStorage.setItem(LATER_KEY, JSON.stringify(ids)); } catch { /* storage blocked */ }
}

/** Pops up unread "new work" notifications: new orders for production, dispatched orders and new projects for designers. */
export function NotificationPopup() {
  const navigate = useNavigate();
  const { data } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [later, setLater] = useState(readLater);

  const items = (data?.data ?? []).filter((n) => !n.read && POPUP_TYPES[n.type] && !later.includes(n.id));
  if (!items.length) return null;

  const types = [...new Set(items.map((n) => n.type))];
  const title = types.length > 1 ? 'You have new work' : items.length > 1 ? POPUP_TYPES[types[0]].many(items.length) : POPUP_TYPES[types[0]].one;

  const hide = (ids) => {
    const next = [...later, ...ids];
    setLater(next);
    saveLater(next);
  };
  const remindLater = () => hide(items.map((n) => n.id));
  const gotIt = () => {
    items.forEach((n) => markRead.mutate(n.id));
    hide(items.map((n) => n.id));
  };
  const open = (n) => {
    markRead.mutate(n.id);
    hide([n.id]);
    navigate(`/projects/${n.project_id}`);
  };

  return (
    <Modal
      title={title}
      description={items.length > 1 ? 'Open one to start, or keep them in the bell for later.' : undefined}
      onClose={remindLater}
      footer={
        <>
          <Button variant="secondary" onClick={remindLater}>Later</Button>
          <Button onClick={gotIt}>Got it</Button>
        </>
      }
    >
      <div className="flex items-center gap-2 text-xs font-medium text-primary">
        <Sparkles className="size-4" aria-hidden />
        Just arrived
      </div>
      <ul className="max-h-80 space-y-2.5 overflow-y-auto">
        {items.map((n) => {
          const { icon: Icon, tone } = POPUP_TYPES[n.type];
          return (
            <li key={n.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface-muted/60 p-3">
              <span className={cn('grid size-9 shrink-0 place-items-center rounded-lg', tone)}>
                <Icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-fg">{n.title}</p>
                {n.body && <p className="mt-0.5 text-[13px] text-fg-muted">{n.body}</p>}
                <p className="mt-1 text-[11px] text-fg-subtle">{timeAgo(n.created_at)}</p>
              </div>
              {n.project_id && (
                <Button size="sm" variant="secondary" onClick={() => open(n)}>Open<ArrowRight className="size-3.5" /></Button>
              )}
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}

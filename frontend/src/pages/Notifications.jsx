import { useEffect, useState } from 'react';
import { Bell, CheckCheck, CheckCircle2, TrendingUp, AlertTriangle, Wrench } from 'lucide-react';
import { formatTimestamp } from '../utils/formatDate';
import { useLanguage } from '../context/LanguageContext';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import Loader from '../components/Loader';

const TYPE_ICON = {
  resolved:      { icon: CheckCircle2,  color: 'text-green-600', bg: 'bg-green-50'  },
  upvote:        { icon: TrendingUp,    color: 'text-blue-600',  bg: 'bg-blue-50'   },
  sla:           { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50'  },
  escalated:     { icon: AlertTriangle, color: 'text-red-600',   bg: 'bg-red-50'    },
  fix_submitted: { icon: Wrench,        color: 'text-purple-600', bg: 'bg-purple-50' },
  system:        { icon: Bell,          color: 'text-slate-500', bg: 'bg-slate-50'  },
  comment:       { icon: Bell,          color: 'text-slate-500', bg: 'bg-slate-50'  },
  default:       { icon: Bell,          color: 'text-slate-500', bg: 'bg-slate-50'  },
};

export default function Notifications() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [filter, setFilter]               = useState('all');

  const unread = notifications.filter((n) => !n.isRead).length;

  const fetchNotifications = async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
    } catch {
      // Fallback to empty list — no crash
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchNotifications(); }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/mark-all-read');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // optimistic update anyway
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    }
  };

  const markOneRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
    } catch { /* silent */ }
    setNotifications((prev) =>
      prev.map((n) => n._id === id || n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const handleNotificationClick = async (notification) => {
    const id = notification._id || notification.id;
    
    // Mark as read
    if (!notification.isRead) {
      await markOneRead(id);
    }
    
    // Navigate to issue if issueId exists
    if (notification.issueId) {
      navigate(`/issues/${notification.issueId}`);
    }
  };

  // Poll for new notifications every 30 seconds to update unread count in sidebar
  useEffect(() => {
    const interval = setInterval(() => {
      api.get('/notifications/unread-count')
        .then(({ data }) => {
          // Update sidebar unread count via localStorage or context
          localStorage.setItem('unreadCount', String(data.count || 0));
          // Dispatch custom event for sidebar to pick up
          window.dispatchEvent(new CustomEvent('unreadCountChanged', { detail: data.count || 0 }));
        })
        .catch(() => {});
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const visible = filter === 'unread'
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Notifications</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading ? 'Loading…' : unread > 0 ? `${unread} unread` : 'All caught up'}
          </p>
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Mark all as read
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="mb-4 flex gap-1.5 rounded-xl border border-slate-200 bg-white p-1 w-fit">
        {['all', 'unread'].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold capitalize transition ${
              filter === f ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {f === 'all' ? `All (${notifications.length})` : `Unread (${unread})`}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <Loader text="Loading notifications…" />
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center">
          <Bell className="mx-auto mb-3 h-8 w-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-500">
            {filter === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map((n) => {
            const id  = n._id || n.id;
            const cfg = TYPE_ICON[n.type] || TYPE_ICON.default;
            const Icon = cfg.icon;
            return (
              <div
                key={id}
                onClick={() => handleNotificationClick(n)}
                className={`flex cursor-pointer items-start gap-3.5 rounded-2xl border p-4 transition hover:shadow-sm ${
                  n.isRead ? 'border-slate-100 bg-white' : 'border-blue-100 bg-blue-50/40'
                }`}
              >
                <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${cfg.bg}`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm leading-snug ${n.isRead ? 'text-slate-600' : 'font-medium text-slate-800'}`}>
                    {n.text}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-400">
                    {formatTimestamp(n.createdAt, lang)}
                  </p>
                </div>
                {!n.isRead && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

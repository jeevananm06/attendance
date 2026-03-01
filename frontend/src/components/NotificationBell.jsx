import { useState, useEffect, useRef } from 'react';
import { Bell, DollarSign, CheckCircle, XCircle, CreditCard } from 'lucide-react';
import { notificationsAPI, invalidateCache } from '../api';

const TYPE_CONFIG = {
  salary_paid:    { icon: DollarSign,   color: 'text-green-600',  bg: 'bg-green-50' },
  leave_approved: { icon: CheckCircle,  color: 'text-blue-600',   bg: 'bg-blue-50' },
  leave_rejected: { icon: XCircle,      color: 'text-red-600',    bg: 'bg-red-50' },
  advance_given:  { icon: CreditCard,   color: 'text-purple-600', bg: 'bg-purple-50' },
};

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Poll unread count every 30 seconds
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const res = await notificationsAPI.getUnreadCount();
        setUnreadCount(res.data.count || 0);
      } catch {
        // silently ignore
      }
    };
    fetchCount();
    const interval = setInterval(() => {
      invalidateCache('notifications:count');
      fetchCount();
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleOpen = async () => {
    if (open) { setOpen(false); return; }
    setOpen(true);
    setLoading(true);
    try {
      const res = await notificationsAPI.getAll();
      setNotifications(res.data || []);
      // Mark all as read after opening
      if (unreadCount > 0) {
        await notificationsAPI.markAllRead();
        setUnreadCount(0);
      }
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell size={20} className="text-gray-600 dark:text-gray-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <span className="font-semibold text-gray-800 dark:text-gray-100">Notifications</span>
            {notifications.length > 0 && (
              <button
                onClick={async () => {
                  await notificationsAPI.markAllRead();
                  setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
                  setUnreadCount(0);
                }}
                className="text-xs text-primary-600 hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50 dark:divide-gray-700">
            {loading && (
              <div className="py-8 text-center text-gray-400 text-sm">Loading…</div>
            )}
            {!loading && notifications.length === 0 && (
              <div className="py-8 text-center text-gray-400 text-sm">No notifications yet</div>
            )}
            {!loading && notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.salary_paid;
              const Icon = cfg.icon;
              return (
                <div
                  key={notif.id}
                  className={`flex gap-3 px-4 py-3 ${notif.is_read ? '' : 'bg-blue-50/40 dark:bg-blue-900/20'}`}
                >
                  <div className={`flex-shrink-0 w-8 h-8 rounded-full ${cfg.bg} flex items-center justify-center`}>
                    <Icon size={14} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{notif.title}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{notif.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{timeAgo(notif.created_at)}</p>
                  </div>
                  {!notif.is_read && (
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-1" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;

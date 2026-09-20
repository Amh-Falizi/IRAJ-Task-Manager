import { apiFetchRaw } from "../lib/api";
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Clock,
  AlertTriangle,
  X,
  AtSign,
  UserCheck,
  CheckCircle2,
  GitPullRequest,
  Info
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Task } from '../types';
import { differenceInHours, isPast, parseISO } from 'date-fns';
import { Link } from 'react-router';
import { cn, safeFormatDistanceToNow } from '../lib/utils';

export interface AppNotification {
  id: string;
  taskId?: string;
  title: string;
  message: string;
  type: 'approaching' | 'overdue' | 'mention' | 'assignment' | 'status_change' | 'system' | 'webhook';
  isRead: boolean;
  timestamp: string;
  link?: string;
}

export default function NotificationsDropdown({ expanded, compact }: { expanded?: boolean; compact?: boolean }) {
  const { user, isAuthenticated } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (window as any).__unreadCount = unreadCount;
    window.dispatchEvent(new CustomEvent('unread-notifications-changed', { detail: unreadCount }));
  }, [unreadCount]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadAllNotifications = useCallback(async (signal?: AbortSignal) => {
    if (!isAuthenticated || !user) return;

    try {
      // 1. Fetch persistent server notifications
      const notifRes = await apiFetchRaw('/api/notifications', { signal });
      let serverNotifs: AppNotification[] = [];
      if (notifRes.ok) {
        const notifData = await notifRes.json();
        serverNotifs = (notifData.notifications || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          message: n.message,
          type: n.type || 'system',
          isRead: Boolean(n.isRead),
          timestamp: n.createdAt,
          link: n.link
        }));
      }

      // 2. Fetch deadline-based notifications
      const tasksRes = await apiFetchRaw('/api/tasks', {
        headers: { 'X-Silent-Fetch': 'true' },
        signal
      });

      let deadlineNotifs: AppNotification[] = [];
      if (tasksRes.ok) {
        const allTasks: Task[] = await tasksRes.json();
        const userTasks = allTasks.filter(t => t.assigneeId === user.id && t.status !== 'done');
        const readStateStr = localStorage.getItem(`notifications_${user.id}`);
        const readState = readStateStr ? JSON.parse(readStateStr) : {};

        userTasks.forEach(task => {
          if (!task.deadline) return;
          const deadline = parseISO(task.deadline);
          if (isNaN(deadline.getTime())) return;
          const hoursLeft = differenceInHours(deadline, new Date());

          let type: 'approaching' | 'overdue' | null = null;
          let message = '';

          if (isPast(deadline)) {
            type = 'overdue';
            message = `Overdue by ${safeFormatDistanceToNow(deadline)}`;
          } else if (hoursLeft <= 24) {
            type = 'approaching';
            message = `Due in ${hoursLeft} hours`;
          }

          if (type) {
            const notifId = `deadline_${task.id}_${type}`;
            deadlineNotifs.push({
              id: notifId,
              taskId: task.id,
              title: task.title,
              message,
              type,
              isRead: Boolean(readState[notifId]),
              timestamp: task.deadline,
              link: `/board?taskId=${task.id}`
            });
          }
        });
      }

      // Combine & sort by timestamp descending
      const combined = [...serverNotifs, ...deadlineNotifs];
      combined.sort((a, b) => {
        const tA = new Date(a.timestamp).getTime();
        const tB = new Date(b.timestamp).getTime();
        return (isNaN(tB) ? 0 : tB) - (isNaN(tA) ? 0 : tA);
      });

      setNotifications(combined);
      setUnreadCount(combined.filter(n => !n.isRead).length);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.warn('[Notifications] Fetch warning:', err.message);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    const controller = new AbortController();
    loadAllNotifications(controller.signal);

    // Listen to real-time incoming notification events from RealtimeProvider
    const handleRealtimeNotif = (e: CustomEvent) => {
      const newNotif = e.detail;
      if (!newNotif) return;

      const formatted: AppNotification = {
        id: newNotif.id,
        title: newNotif.title,
        message: newNotif.message,
        type: newNotif.type || 'system',
        isRead: false,
        timestamp: newNotif.createdAt || new Date().toISOString(),
        link: newNotif.link
      };

      setNotifications(prev => [formatted, ...prev.filter(n => n.id !== formatted.id)]);
      setUnreadCount(prev => prev + 1);
    };

    window.addEventListener('realtime:notification-new', handleRealtimeNotif as EventListener);

    // Periodic poll every 90 seconds
    const interval = setInterval(() => loadAllNotifications(), 90000);

    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener('realtime:notification-new', handleRealtimeNotif as EventListener);
    };
  }, [loadAllNotifications]);

  const markAsRead = async (notif: AppNotification, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!user) return;

    setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));

    if (notif.id.startsWith('deadline_')) {
      const readStateStr = localStorage.getItem(`notifications_${user.id}`);
      const readState = readStateStr ? JSON.parse(readStateStr) : {};
      readState[notif.id] = true;
      localStorage.setItem(`notifications_${user.id}`, JSON.stringify(readState));
    } else {
      try {
        await apiFetchRaw(`/api/notifications/${notif.id}/read`, { method: 'PATCH' });
      } catch (err) {
        console.warn('Failed marking notification as read on server:', err);
      }
    }
  };

  const markAllAsRead = async () => {
    if (!user) return;

    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadCount(0);

    // Update local storage for deadlines
    const readStateStr = localStorage.getItem(`notifications_${user.id}`);
    const readState = readStateStr ? JSON.parse(readStateStr) : {};
    notifications.forEach(n => {
      if (n.id.startsWith('deadline_')) {
        readState[n.id] = true;
      }
    });
    localStorage.setItem(`notifications_${user.id}`, JSON.stringify(readState));

    // Update server
    try {
      await apiFetchRaw('/api/notifications/read-all', { method: 'POST' });
    } catch (err) {
      console.warn('Failed marking all as read on server:', err);
    }
  };

  const renderIcon = (type: AppNotification['type']) => {
    switch (type) {
      case 'overdue':
        return <AlertTriangle size={14} className="text-red-400" />;
      case 'approaching':
        return <Clock size={14} className="text-amber-400" />;
      case 'mention':
        return <AtSign size={14} className="text-purple-400" />;
      case 'assignment':
        return <UserCheck size={14} className="text-blue-400" />;
      case 'status_change':
        return <CheckCircle2 size={14} className="text-emerald-400" />;
      case 'webhook':
        return <GitPullRequest size={14} className="text-pink-400" />;
      default:
        return <Info size={14} className="text-cyan-400" />;
    }
  };

  const renderBadge = (type: AppNotification['type']) => {
    switch (type) {
      case 'overdue':
        return <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Overdue</span>;
      case 'approaching':
        return <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">Due soon</span>;
      case 'mention':
        return <span className="text-[10px] font-semibold text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">Mention</span>;
      case 'assignment':
        return <span className="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded">Assignment</span>;
      case 'status_change':
        return <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">Status</span>;
      case 'webhook':
        return <span className="text-[10px] font-semibold text-pink-400 bg-pink-500/10 px-1.5 py-0.5 rounded">Git PR</span>;
      default:
        return null;
    }
  };

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef} onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className="text-subtle hover:text-strong rounded-md transition-all duration-200 relative flex items-center justify-center w-7 h-7 hover:bg-surface-accent/50"
          title="Notifications"
        >
          <Bell size={16} className="shrink-0" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-surface-dim animate-pulse"></span>
          )}
        </button>

        {isOpen && (
          <div className="absolute bottom-12 left-0 bg-surface border border-border-subtle rounded-lg shadow-2xl z-50 overflow-hidden flex flex-col max-h-[440px] w-88">
            <div className="p-3 border-b border-border-subtle flex items-center justify-between bg-surface-dim">
              <div className="flex items-center gap-2">
                <h3 className="text-strong font-bold text-sm tracking-tight">Notifications</h3>
                {unreadCount > 0 && (
                  <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    markAllAsRead();
                  }}
                  className="text-[10px] uppercase font-bold tracking-wider text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
              {notifications.length === 0 ? (
                <div className="text-center py-8 text-subtle text-xs">
                  No new notifications
                </div>
              ) : (
                notifications.map((notif) => (
                  <Link
                    key={notif.id}
                    to={notif.link || '/board'}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "block p-2.5 rounded-lg border border-transparent hover:border-border-subtle hover:bg-surface-accent/30 transition-all cursor-pointer group relative",
                      !notif.isRead && "bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/10"
                    )}
                  >
                    <div className="flex items-start space-x-2.5">
                      <div className="mt-0.5 p-1.5 rounded-md bg-surface-dim border border-border-subtle shrink-0">
                        {renderIcon(notif.type)}
                      </div>
                      <div className="flex-1 min-w-0 pr-6">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {renderBadge(notif.type)}
                          <span className="text-[11px] text-subtle">
                            {safeFormatDistanceToNow(parseISO(notif.timestamp))}
                          </span>
                        </div>
                        <p className={cn(
                          "text-xs font-semibold mt-1 truncate",
                          notif.isRead ? "text-subtle" : "text-strong"
                        )}>
                          {notif.title}
                        </p>
                        <p className="text-[11px] text-subtle mt-0.5 line-clamp-2 leading-relaxed">
                          {notif.message}
                        </p>
                      </div>
                    </div>

                    {!notif.isRead && (
                      <button
                        onClick={(e) => markAsRead(notif, e)}
                        className="absolute top-2.5 right-2.5 text-subtle hover:text-strong p-1 rounded-md hover:bg-surface-accent opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Mark as read"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="text-subtle hover:text-strong rounded-md transition-colors relative flex items-center w-full h-full overflow-hidden hover:bg-surface-accent/30"
        title={!expanded ? "Notifications" : undefined}
      >
        <div className="relative flex items-center justify-center w-10 h-10 shrink-0">
          <Bell size={20} className="shrink-0" />
          {unreadCount > 0 && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface-dim animate-pulse"></span>
          )}
        </div>
        <span className={cn("text-sm font-medium transition-all duration-300 whitespace-nowrap flex items-center justify-between", expanded ? "opacity-100 max-w-full flex-1 pr-2" : "opacity-0 max-w-0")}>
          Notifications
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-2">
              {unreadCount}
            </span>
          )}
        </span>
      </button>

      {isOpen && (
        <div className={cn(
          "absolute bottom-0 bg-surface border border-border-subtle rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[440px]",
          expanded ? "left-full ml-4 w-88 mb-8" : "left-full ml-4 w-88"
        )}>
          <div className="p-3 border-b border-border-subtle flex items-center justify-between bg-surface-dim">
            <div className="flex items-center gap-2">
              <h3 className="text-strong font-bold text-sm tracking-tight">Notifications</h3>
              {unreadCount > 0 && (
                <span className="text-xs bg-red-500/10 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-semibold">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] uppercase font-bold tracking-wider text-blue-400 hover:text-blue-300 transition-colors bg-blue-500/10 px-2 py-1 rounded"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8 text-subtle text-xs">
                No new notifications
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  to={notif.link || '/board'}
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "block p-2.5 rounded-lg border border-transparent hover:border-border-subtle hover:bg-surface-accent/30 transition-all cursor-pointer group relative",
                    !notif.isRead && "bg-blue-500/5 hover:bg-blue-500/10 border-blue-500/10"
                  )}
                >
                  <div className="flex items-start space-x-2.5">
                    <div className="mt-0.5 p-1.5 rounded-md bg-surface-dim border border-border-subtle shrink-0">
                      {renderIcon(notif.type)}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {renderBadge(notif.type)}
                        <span className="text-[11px] text-subtle">
                          {safeFormatDistanceToNow(parseISO(notif.timestamp))}
                        </span>
                      </div>
                      <p className={cn(
                        "text-xs font-semibold mt-1 truncate",
                        notif.isRead ? "text-subtle" : "text-strong"
                      )}>
                        {notif.title}
                      </p>
                      <p className="text-[11px] text-subtle mt-0.5 line-clamp-2 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  </div>

                  {!notif.isRead && (
                    <button
                      onClick={(e) => markAsRead(notif, e)}
                      className="absolute top-2.5 right-2.5 text-subtle hover:text-strong p-1 rounded-md hover:bg-surface-accent opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Mark as read"
                    >
                      <X size={13} />
                    </button>
                  )}
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

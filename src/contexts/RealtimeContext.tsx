import React, { createContext, useContext, useEffect, useState, ReactNode, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

export interface RealtimeEvent {
  type: string;
  data: any;
  timestamp: string;
}

interface RealtimeContextType {
  isConnected: boolean;
  lastEvent: RealtimeEvent | null;
  getLastEvent: () => RealtimeEvent | null;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  lastEvent: null,
  getLastEvent: () => null,
  reconnect: () => {}
});

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { info } = useToast();
  const infoRef = useRef(info);
  infoRef.current = info;

  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(false);
  const lastEventRef = useRef<RealtimeEvent | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const eventSourceRef = useRef<EventSource | null>(null);
  const isCancelledRef = useRef(false);

  const connect = useCallback(() => {
    if (isCancelledRef.current || !isAuthenticated || !user) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      const eventSource = new EventSource('/api/events', { withCredentials: true });
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!isCancelledRef.current) {
          isConnectedRef.current = true;
          setIsConnected(true);
          retryCountRef.current = 0; // Reset retry counter on successful open
        }
      };

      eventSource.addEventListener('connected', () => {
        isConnectedRef.current = true;
        setIsConnected(true);
        retryCountRef.current = 0;
      });

      // Task created event
      eventSource.addEventListener('task:created', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const eventObj = { type: 'task:created', data, timestamp: new Date().toISOString() };
          lastEventRef.current = eventObj;
          window.dispatchEvent(new CustomEvent('realtime:task-changed', { detail: eventObj }));
        } catch (err) {
          console.error('[Realtime] Parse error:', err);
        }
      });

      // Task updated event
      eventSource.addEventListener('task:updated', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const eventObj = { type: 'task:updated', data, timestamp: new Date().toISOString() };
          lastEventRef.current = eventObj;
          window.dispatchEvent(new CustomEvent('realtime:task-changed', { detail: eventObj }));
        } catch (err) {
          console.error('[Realtime] Parse error:', err);
        }
      });

      // Task deleted event
      eventSource.addEventListener('task:deleted', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const eventObj = { type: 'task:deleted', data, timestamp: new Date().toISOString() };
          lastEventRef.current = eventObj;
          window.dispatchEvent(new CustomEvent('realtime:task-changed', { detail: eventObj }));
        } catch (err) {
          console.error('[Realtime] Parse error:', err);
        }
      });

      // Task comment added event
      eventSource.addEventListener('task:comment_added', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const eventObj = { type: 'task:comment_added', data, timestamp: new Date().toISOString() };
          lastEventRef.current = eventObj;
          window.dispatchEvent(new CustomEvent('realtime:task-changed', { detail: eventObj }));
        } catch (err) {
          console.error('[Realtime] Parse error:', err);
        }
      });

      // User Notification event
      eventSource.addEventListener('notification:new', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const eventObj = { type: 'notification:new', data, timestamp: new Date().toISOString() };
          lastEventRef.current = eventObj;
          window.dispatchEvent(new CustomEvent('realtime:notification-new', { detail: data }));

          if (data.title && data.message && infoRef.current) {
            infoRef.current(`${data.title}: ${data.message}`);
          }
        } catch (err) {
          console.error('[Realtime] Parse error:', err);
        }
      });

      eventSource.onerror = () => {
        isConnectedRef.current = false;
        setIsConnected(false);
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }

        // Apply exponential backoff with max retry ceiling
        if (!isCancelledRef.current && isAuthenticated) {
          if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

          retryCountRef.current += 1;
          // Stop hammering server after 10 consecutive failures until user re-focuses or manually reconnects
          if (retryCountRef.current > 10) {
            console.warn('[Realtime] Max connection retries reached. Pausing auto-reconnect until tab re-focus.');
            return;
          }

          const delayMs = Math.min(1500 * Math.pow(1.5, retryCountRef.current - 1), 30000);
          reconnectTimeoutRef.current = setTimeout(connect, delayMs);
        }
      };
    } catch (err) {
      console.warn('[Realtime] EventSource initialization failed:', err);
      if (!isCancelledRef.current && isAuthenticated) {
        retryCountRef.current += 1;
        const delayMs = Math.min(2000 * Math.pow(1.5, retryCountRef.current - 1), 30000);
        reconnectTimeoutRef.current = setTimeout(connect, delayMs);
      }
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    isCancelledRef.current = false;

    if (!isAuthenticated || !user) {
      isConnectedRef.current = false;
      setIsConnected(false);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    connect();

    const handleFocus = () => {
      if (!isConnectedRef.current && isAuthenticated && !isCancelledRef.current) {
        retryCountRef.current = 0;
        connect();
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleFocus);

    return () => {
      isCancelledRef.current = true;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleFocus);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      isConnectedRef.current = false;
      setIsConnected(false);
    };
  }, [isAuthenticated, user?.id, connect]);

  const handleManualReconnect = useCallback(() => {
    retryCountRef.current = 0;
    connect();
  }, [connect]);

  return (
    <RealtimeContext.Provider value={{ isConnected, lastEvent: lastEventRef.current, getLastEvent: () => lastEventRef.current, reconnect: handleManualReconnect }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);

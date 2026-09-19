import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

interface RealtimeEvent {
  type: string;
  data: any;
  timestamp: string;
}

interface RealtimeContextType {
  isConnected: boolean;
  lastEvent: RealtimeEvent | null;
}

const RealtimeContext = createContext<RealtimeContextType>({
  isConnected: false,
  lastEvent: null
});

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const { info } = useToast();
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setIsConnected(false);
      return;
    }

    let eventSource: EventSource | null = null;
    let isCancelled = false;

    const connect = () => {
      if (isCancelled) return;

      try {
        eventSource = new EventSource('/api/events', { withCredentials: true });

        eventSource.onopen = () => {
          if (!isCancelled) {
            setIsConnected(true);
          }
        };

        eventSource.addEventListener('connected', (e: MessageEvent) => {
          setIsConnected(true);
        });

        // Task created event
        eventSource.addEventListener('task:created', (e: MessageEvent) => {
          try {
            const data = JSON.parse(e.data);
            const eventObj = { type: 'task:created', data, timestamp: new Date().toISOString() };
            setLastEvent(eventObj);
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
            setLastEvent(eventObj);
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
            setLastEvent(eventObj);
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
            setLastEvent(eventObj);
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
            setLastEvent(eventObj);
            window.dispatchEvent(new CustomEvent('realtime:notification-new', { detail: data }));
            
            // Show toast
            if (data.title && data.message) {
              info(`${data.title}: ${data.message}`);
            }
          } catch (err) {
            console.error('[Realtime] Parse error:', err);
          }
        });

        eventSource.onerror = (err) => {
          setIsConnected(false);
          if (eventSource) {
            eventSource.close();
            eventSource = null;
          }

          // Reconnect after 5 seconds if still authenticated
          if (!isCancelled) {
            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(connect, 5000);
          }
        };
      } catch (err) {
        console.warn('[Realtime] EventSource connection failed:', err);
        if (!isCancelled) {
          reconnectTimeoutRef.current = setTimeout(connect, 10000);
        }
      }
    };

    connect();

    return () => {
      isCancelled = true;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
      setIsConnected(false);
    };
  }, [isAuthenticated, user, info]);

  return (
    <RealtimeContext.Provider value={{ isConnected, lastEvent }}>
      {children}
    </RealtimeContext.Provider>
  );
}

export const useRealtime = () => useContext(RealtimeContext);

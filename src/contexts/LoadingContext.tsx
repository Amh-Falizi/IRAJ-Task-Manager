import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingContextType {
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

export const LoadingProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [activeRequests, setActiveRequests] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [manualLoading, setManualLoading] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (activeRequests > 0 || manualLoading) {
      // Delay showing the overlay to prevent flickering on fast requests
      timeoutId = setTimeout(() => setShowOverlay(true), 150);
    } else {
      setShowOverlay(false);
    }

    return () => clearTimeout(timeoutId);
  }, [activeRequests, manualLoading]);

  useEffect(() => {
    const originalFetch = window.fetch;

    const wrappedFetch = async (...args: Parameters<typeof fetch>) => {
      // Check for silent requests to avoid showing loader
      let silent = false;
      const [input, init] = args;
      
      let urlStr = '';
      if (typeof input === 'string') urlStr = input;
      else if (input instanceof URL) urlStr = input.toString();
      else if (input instanceof Request) urlStr = input.url;

      // Only track our API requests
      let isApiRequest = urlStr.includes('/api/');

      if (init && init.headers) {
        const headers = new Headers(init.headers);
        if (headers.get('X-Silent-Fetch') === 'true') {
          silent = true;
        }
      } else if (input instanceof Request) {
        if (input.headers.get('X-Silent-Fetch') === 'true') {
          silent = true;
        }
      }

      if (!isApiRequest) {
         silent = true; // Ignore non-API reqs for the loader
      }

      if (!silent) {
        console.log("LoadingContext: starting API fetch", urlStr);
        setActiveRequests((prev) => prev + 1);
      }

      try {
        const response = await originalFetch(...args);
        return response;
      } finally {
        if (!silent) {
          console.log("LoadingContext: ending API fetch", urlStr);
          setActiveRequests((prev) => Math.max(prev - 1, 0));
        }
      }
    };

    try {
      Object.defineProperty(window, 'fetch', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: wrappedFetch
      });
      if (typeof globalThis !== 'undefined') {
        Object.defineProperty(globalThis, 'fetch', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: wrappedFetch
        });
      }
    } catch (e) {
      console.warn("Could not override window.fetch", e);
    }

    return () => {
      try {
        Object.defineProperty(window, 'fetch', {
          configurable: true,
          enumerable: true,
          writable: true,
          value: originalFetch
        });
        if (typeof globalThis !== 'undefined') {
          Object.defineProperty(globalThis, 'fetch', {
            configurable: true,
            enumerable: true,
            writable: true,
            value: originalFetch
          });
        }
      } catch (e) {
        // ignore
      }
    };
  }, []);

  const isLoading = activeRequests > 0 || manualLoading;

  return (
    <LoadingContext.Provider value={{ isLoading, setLoading: setManualLoading }}>
      {children}
      {showOverlay && (
        <div className="fixed inset-0 z-[9999] bg-background/50 backdrop-blur-sm flex items-center justify-center transition-opacity">
          <div className="bg-surface border border-border-strong rounded-xl p-6 shadow-2xl flex flex-col items-center animate-in fade-in zoom-in duration-200">
            <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
            <p className="text-strong font-medium text-sm tracking-wide">Loading...</p>
          </div>
        </div>
      )}
    </LoadingContext.Provider>
  );
};

export const useLoading = () => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { User } from "../types";
import { apiFetchRaw, onUnauthorized } from "../lib/api";
import { can as checkPermission } from "../lib/permissions";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  token?: string | null;
  can: (permission: string) => boolean;
  login: (userOrToken?: any, maybeUser?: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  refetchUser: () => Promise<User | null>;
  loading: boolean;
  settings: Record<string, string>;
  refreshSettings: () => Promise<void>;
  updateSettings: (newSettings: Record<string, string>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({
    manager_prefix: "Engineering",
    developer_prefix: "Lead"
  });

  // Clean up legacy tokens in localStorage if present
  const cleanupLocalStorage = () => {
    try {
      if (localStorage.getItem("token")) {
        localStorage.removeItem("token");
      }
    } catch (e) {
      // ignore
    }
  };

  const refreshSettings = useCallback(async () => {
    try {
      const res = await apiFetchRaw('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  }, []);

  const updateSettings = async (newSettings: Record<string, string>) => {
    const res = await apiFetchRaw('/api/settings', {
      method: "PUT",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(newSettings)
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(prev => ({ ...prev, ...data }));
    } else {
      const errorData = await res.json();
      throw new Error(errorData.error || "Failed to update settings");
    }
  };

  const refetchUser = useCallback(async (): Promise<User | null> => {
    try {
      const res = await apiFetchRaw('/api/auth/me', {
        headers: { 
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      });
      if (res.ok) {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await res.json();
          setUser(data);
          refreshSettings();
          return data;
        }
      }
      setUser(null);
      return null;
    } catch {
      setUser(null);
      return null;
    }
  }, [refreshSettings]);

  // Handle global 401 Unauthorized by logging out
  useEffect(() => {
    const unsubscribe = onUnauthorized(() => {
      cleanupLocalStorage();
      setUser(null);
    });
    return () => unsubscribe();
  }, []);

  // Fetch current user using httpOnly cookie on mount
  useEffect(() => {
    cleanupLocalStorage();
    setLoading(true);
    refetchUser().finally(() => setLoading(false));
  }, [refetchUser]);

  const login = (userOrToken?: any, maybeUser?: User) => {
    cleanupLocalStorage();
    const resolvedUser = maybeUser || (userOrToken && typeof userOrToken === "object" ? userOrToken : null);
    if (resolvedUser) {
      setUser(resolvedUser);
    }
    refreshSettings();
  };

  const logout = () => {
    cleanupLocalStorage();
    setUser(null);
    apiFetchRaw('/api/auth/logout', { method: 'POST' }).catch((err) => console.error("Logout request error:", err));
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const isAuthenticated = !!user;
  // Deprecated backwards-compat placeholder string for any external or lingering references
  const token = user ? "cookie_authenticated" : null;

  const can = useCallback((permission: string) => {
    return checkPermission(user, permission);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, token, can, login, logout, updateUser, refetchUser, loading, settings, refreshSettings, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

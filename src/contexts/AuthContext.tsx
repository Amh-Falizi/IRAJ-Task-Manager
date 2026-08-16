import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (newToken: string | undefined, newUser: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
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

  const refreshSettings = async () => {
    try {
      const res = await fetch('/api/settings');
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const updateSettings = async (newSettings: Record<string, string>) => {
    const res = await fetch('/api/settings', {
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

  // Fetch current user using httpOnly cookie on mount
  useEffect(() => {
    cleanupLocalStorage();
    setLoading(true);
    fetch('/api/auth/me', {
      headers: { 
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
    })
      .then(async (res) => {
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new Error("Invalid session");
          }
          return res.json();
        }
        throw new Error("Unauthenticated");
      })
      .then((data) => {
        setUser(data);
        refreshSettings();
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = (_newToken: string | undefined, newUser: User) => {
    cleanupLocalStorage();
    setUser(newUser);
    refreshSettings();
  };

  const logout = () => {
    cleanupLocalStorage();
    setUser(null);
    fetch('/api/auth/logout', { method: 'POST' }).catch((err) => console.error("Logout request error:", err));
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  // Provide a non-null placeholder string when logged in to preserve component checks (if (token))
  const token = user ? "cookie_authenticated" : null;

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, loading, settings, refreshSettings, updateSettings }}>
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

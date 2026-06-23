import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";
import config from "../config";

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
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
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<Record<string, string>>({
    manager_prefix: "Engineering",
    developer_prefix: "Lead"
  });

  const refreshSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(prev => ({ ...prev, ...data }));
      }
    } catch (err) {
      console.error("Failed to load settings:", err);
    }
  };

  const updateSettings = async (newSettings: Record<string, string>) => {
    if (!token) return;
    const res = await fetch('/api/settings', {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
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

  useEffect(() => {
    if (token) {
      refreshSettings();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      if (!user) {
        setLoading(true);
      }
      fetch('/api/auth/me', {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      })
        .then(async (res) => {
          if (res.ok) {
            const contentType = res.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
              throw new Error("Invalid token");
            }
            return res.json();
          }
          if (res.status === 401 || res.status === 403) {
            throw new Error("Invalid token");
          }
          const text = await res.text();
          console.error("Auth /me failed:", res.status, text);
          throw new Error("Invalid token");
        })
        .then((data) => setUser(data))
        .catch((err) => {
          if (err.message !== "Invalid token") {
            console.error("Auth context catch:", err);
          }
          setToken(null);
          setUser(null);
          localStorage.removeItem("token");
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem("token", newToken);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem("token");
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

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

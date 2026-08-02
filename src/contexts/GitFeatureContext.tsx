import React, { createContext, useContext, useEffect, useState } from 'react';

interface GitFeatureContextType {
  gitEnabled: boolean;
  setGitEnabled: (enabled: boolean) => void;
}

const GitFeatureContext = createContext<GitFeatureContextType | undefined>(undefined);

export function GitFeatureProvider({ children }: { children: React.ReactNode }) {
  const [gitEnabled, setGitEnabledState] = useState<boolean>(() => {
    const saved = localStorage.getItem('git_enabled');
    if (saved !== null) {
      return saved !== 'false';
    }
    // Check if there is an environment variable configuration, default to true
    return import.meta.env.VITE_GIT_ENABLED !== 'false';
  });

  const setGitEnabled = (enabled: boolean) => {
    setGitEnabledState(enabled);
    localStorage.setItem('git_enabled', String(enabled));
    window.dispatchEvent(new Event('git-enabled-changed'));
  };

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('git_enabled');
      if (saved !== null) {
        setGitEnabledState(saved !== 'false');
      } else {
        setGitEnabledState(import.meta.env.VITE_GIT_ENABLED !== 'false');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('git-enabled-changed', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('git-enabled-changed', handleStorageChange);
    };
  }, []);

  return (
    <GitFeatureContext.Provider value={{ gitEnabled, setGitEnabled }}>
      {children}
    </GitFeatureContext.Provider>
  );
}

export function useGitFeature() {
  const context = useContext(GitFeatureContext);
  if (context === undefined) {
    throw new Error('useGitFeature must be used within a GitFeatureProvider');
  }
  return context;
}

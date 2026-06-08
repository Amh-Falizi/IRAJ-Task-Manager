import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LayoutDashboard, KanbanSquare, LogOut, Users, Calendar, FolderKanban, FileText, Map, Sun, Moon, Shield, ChevronLeft, ChevronRight, Workflow } from 'lucide-react';
import { cn } from '../lib/utils';

import NotificationsDropdown from './NotificationsDropdown';

import UserAvatar from './UserAvatar';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Projects', href: '/projects', icon: FolderKanban },
    { name: 'Planning', href: '/planning', icon: Map },
    { name: 'Task Board', href: '/board', icon: KanbanSquare },
    { name: 'Task Graph', href: '/graph', icon: Workflow },
    { name: 'Calendar', href: '/calendar', icon: Calendar },
    { name: 'Documents', href: '/documents', icon: FileText },
    { name: 'Teams', href: '/teams', icon: Users },
  ];

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input, textarea, or contenteditable
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // We shouldn't preventDefault so easily, but here it's fine for simple shortcuts if not inside input
        e.preventDefault();
        toggleTheme();
      } else if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-new-task-modal'));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleTheme]);

  if (user?.role === 'admin') {
    navItems.push({ name: 'Admin', href: '/admin/users', icon: Shield });
  }

  return (
    <div className="flex h-screen bg-page-bg text-primary font-sans overflow-hidden transition-colors duration-200">
      {/* Sidebar */}
      <aside 
        className={cn(
          "flex flex-col py-6 border-r border-border-subtle bg-surface-dim transition-all duration-300 relative",
          isExpanded ? "w-64 px-4" : "w-16 items-center px-0"
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="absolute -right-3 top-8 bg-surface-dim border border-border-subtle rounded-full p-1 text-subtle hover:text-strong z-10 shadow-sm"
          title={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {isExpanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        <div className={cn("bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold mb-8 transition-all shrink-0", isExpanded ? "w-full h-12 text-xl" : "w-10 h-10")}>
          {isExpanded ? "IRAJ" : "Σ"}
        </div>

        <nav className="flex flex-col space-y-4">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.href}
                className={cn(
                  'flex items-center rounded-md transition-colors cursor-pointer',
                  isExpanded ? 'px-3 py-2.5 space-x-3' : 'p-2 justify-center',
                  isActive
                    ? 'text-blue-500 bg-blue-500/10 font-medium'
                    : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                )}
                title={!isExpanded ? item.name : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {isExpanded && <span className="text-sm truncate">{item.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col space-y-4 w-full">
          <div className={cn("flex w-full", isExpanded ? "flex-col space-y-2" : "flex-col items-center space-y-4")}>
             <button
               onClick={toggleTheme}
               className={cn("flex items-center text-subtle hover:text-strong rounded-md transition-colors hover:bg-surface-accent/30", isExpanded ? "px-3 py-2 space-x-3" : "p-2")}
               title={!isExpanded ? `Switch to ${theme === 'light' ? 'dark' : 'light'} mode` : undefined}
             >
               {theme === 'light' ? <Moon size={20} className="shrink-0" /> : <Sun size={20} className="shrink-0" />}
               {isExpanded && <span className="text-sm font-medium">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>}
             </button>
             
             <div className={cn("flex", isExpanded ? "px-3 py-2" : "p-2")}>
                <NotificationsDropdown expanded={isExpanded} />
             </div>
             
             <button
               onClick={logout}
               className={cn("flex items-center text-subtle hover:text-red-500 rounded-md transition-colors hover:bg-surface-accent/30", isExpanded ? "px-3 py-2 space-x-3" : "p-2")}
               title={!isExpanded ? "Logout" : undefined}
             >
               <LogOut size={20} className="shrink-0" />
               {isExpanded && <span className="text-sm font-medium">Logout</span>}
             </button>
             
             <Link 
               to="/profile"
               className={cn("hover:opacity-80 transition-opacity flex items-center mt-4", isExpanded ? "px-3 py-2 space-x-3 bg-surface border border-border-subtle rounded-lg" : "")} 
               title={!isExpanded ? "Profile" : undefined}
             >
               <UserAvatar user={user} showTooltip={!isExpanded} />
               {isExpanded && (
                 <div className="flex flex-col min-w-0">
                   <span className="text-sm font-bold text-strong truncate">{user?.name}</span>
                   <span className="text-[10px] text-muted truncate">{user?.email}</span>
                 </div>
               )}
             </Link>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-page-bg transition-colors duration-200">
        <Outlet />
      </main>
    </div>
  );
}

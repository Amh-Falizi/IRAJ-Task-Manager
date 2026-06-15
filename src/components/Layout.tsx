import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LayoutDashboard, KanbanSquare, LogOut, Users, Calendar, FolderKanban, FileText, Map, Sun, Moon, Shield, PanelLeftClose, PanelLeft, Workflow, Settings, ChevronUp, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import NotificationsDropdown from './NotificationsDropdown';

import { Tooltip } from './Tooltip';
import UserAvatar from './UserAvatar';
import WelcomeModal from './WelcomeModal';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);

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
      <WelcomeModal />
      {/* Sidebar */}
      <aside 
        className={cn(
          "tour-sidebar flex flex-col py-6 border-r border-border-subtle bg-surface-dim transition-all duration-300 relative",
          isExpanded ? "w-64 px-4" : "w-16 items-center px-0"
        )}
      >
        <div className={cn("flex w-full mb-8 shrink-0", isExpanded ? "flex-row items-center space-x-3" : "flex-col items-center space-y-3")}>
          <div className={cn("bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold transition-all shrink-0", isExpanded ? "h-10 flex-1 text-lg" : "w-10 h-10")}>
            {isExpanded ? "IRAJ" : "Σ"}
          </div>
          <Tooltip content={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"} position="right">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-2 shrink-0 text-subtle hover:text-strong hover:bg-surface-accent rounded-md transition-colors flex items-center justify-center"
            >
              {isExpanded ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            </button>
          </Tooltip>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 flex flex-col space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Tooltip key={item.name} content={isExpanded ? undefined : item.name} position="right">
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center rounded-md transition-colors cursor-pointer',
                    isExpanded ? 'px-3 py-2 space-x-3 w-full' : 'w-10 h-10 justify-center mx-auto',
                    isActive
                      ? 'text-blue-500 bg-blue-500/10 font-medium'
                      : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                  )}
                >
                  <Icon className="w-5 h-5 shrink-0" />
                  {isExpanded && <span className="text-sm truncate">{item.name}</span>}
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        <div className="mt-auto px-2 pt-4 flex flex-col space-y-1 w-full border-t border-border-subtle/50">
          <AnimatePresence>
            {isSettingsExpanded && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: isExpanded ? 4 : 8 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className={cn("flex w-full overflow-hidden", isExpanded ? "flex-col space-y-1 bg-surface/50 border border-border-subtle/30 rounded-lg p-1" : "flex-col items-center space-y-2")}
              >
                 <Tooltip content={isExpanded ? undefined : `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} position="right">
                   <button
                     onClick={toggleTheme}
                     className={cn("tour-theme-toggle flex items-center text-subtle hover:text-strong rounded-md transition-colors hover:bg-surface-accent/50", isExpanded ? "px-2 py-2 space-x-3 w-full" : "w-10 h-10 justify-center mx-auto")}
                   >
                     {theme === 'light' ? <Moon size={18} className="shrink-0" /> : <Sun size={18} className="shrink-0" />}
                     {isExpanded && <span className="text-sm">Theme</span>}
                   </button>
                 </Tooltip>
                 
                 <div className={cn("tour-notifications flex", isExpanded ? "px-2 py-2 hover:bg-surface-accent/50 rounded-md transition-colors" : "w-10 h-10 justify-center mx-auto")}>
                    <NotificationsDropdown expanded={isExpanded} />
                 </div>
                 
                 <Tooltip content={isExpanded ? undefined : "Logout"} position="right">
                   <button
                     onClick={logout}
                     className={cn("flex items-center text-subtle hover:text-red-500 rounded-md transition-colors hover:bg-red-500/10", isExpanded ? "px-2 py-2 space-x-3 w-full" : "w-10 h-10 justify-center mx-auto")}
                   >
                     <LogOut size={18} className="shrink-0" />
                     {isExpanded && <span className="text-sm">Logout</span>}
                   </button>
                 </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>

          <Tooltip content={isExpanded ? undefined : (isSettingsExpanded ? "Close Settings" : "Settings")} position="right">
            <button
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              className={cn("flex items-center text-subtle hover:text-strong rounded-md transition-colors hover:bg-surface-accent/30", isExpanded ? "px-3 py-2 space-x-3 w-full justify-between" : "w-10 h-10 justify-center mx-auto")}
            >
              <div className={cn("flex items-center", isExpanded && "space-x-3")}>
                <Settings size={20} className={cn("shrink-0 transition-transform duration-300", isSettingsExpanded && "rotate-90")} />
                {isExpanded && <span className="text-sm font-medium">Settings</span>}
              </div>
              {isExpanded && (isSettingsExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronUp size={16} className="text-muted" />)}
            </button>
          </Tooltip>

          <div className={cn("flex w-full pt-2", !isExpanded && "justify-center")}>
             <Tooltip content={isExpanded ? undefined : "Profile"} position="right">
               <Link 
                 to="/profile"
                 className={cn("tour-user-dropdown hover:opacity-80 transition-opacity flex items-center", isExpanded ? "px-3 py-2 space-x-3 w-full bg-surface border border-border-subtle rounded-lg shadow-sm" : "w-10 h-10 justify-center")} 
               >
                 <UserAvatar user={user} showTooltip={!isExpanded} />
                 {isExpanded && (
                   <div className="flex flex-col min-w-0">
                     <span className="text-sm font-bold text-strong truncate">{user?.name}</span>
                     <span className="text-[10px] text-muted truncate">{user?.email}</span>
                   </div>
                 )}
               </Link>
             </Tooltip>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-page-bg transition-colors duration-200 overflow-hidden relative">
        <div className="flex-1 w-full h-full flex flex-col min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

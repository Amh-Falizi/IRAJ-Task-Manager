import React, { useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { LayoutDashboard, KanbanSquare, LogOut, Users, Calendar, FolderKanban, FileText, Map, Sun, Moon, Shield, PanelLeftClose, PanelLeft, Workflow, Settings, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

import NotificationsDropdown from './NotificationsDropdown';

import { Tooltip } from './Tooltip';
import UserAvatar from './UserAvatar';
import WelcomeModal from './WelcomeModal';
import GlobalSearch from './GlobalSearch';

export default function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isSettingsExpanded, setIsSettingsExpanded] = useState(false);
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({
    Management: true,
    Tasks: true,
  });

  const toggleMenu = (name: string) => {
    if (!isExpanded) {
      setIsExpanded(true);
      setOpenMenus(prev => ({ ...prev, [name]: true }));
    } else {
      setOpenMenus(prev => ({ ...prev, [name]: !prev[name] }));
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { 
      name: 'Management', 
      icon: FolderKanban, 
      children: [
        { name: 'Projects', href: '/projects', icon: FolderKanban },
        { name: 'Planning', href: '/planning', icon: Map },
        { name: 'Documents', href: '/documents', icon: FileText },
      ]
    },
    { 
      name: 'Tasks', 
      icon: KanbanSquare, 
      children: [
        { name: 'Task Board', href: '/board', icon: KanbanSquare },
        { name: 'Task Graph', href: '/graph', icon: Workflow },
        { name: 'Calendar', href: '/calendar', icon: Calendar },
      ]
    },
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
          "tour-sidebar flex flex-col py-6 border-r border-border-subtle bg-surface-dim transition-all duration-300 relative z-50",
          isExpanded ? "w-64 px-3" : "w-16 px-3"
        )}
      >
        <div className="flex flex-col w-full mb-8 shrink-0 space-y-3">
          <div className={cn("bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold transition-all shrink-0 text-center", isExpanded ? "h-10 w-full text-sm leading-tight px-1" : "w-10 h-10 mx-auto")}>
            {isExpanded ? "Anah Assistant" : "A"}
          </div>
          <Tooltip content={isExpanded ? "Collapse Sidebar" : "Expand Sidebar"} position="right">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-10 h-10 shrink-0 text-subtle hover:text-strong hover:bg-surface-accent rounded-md transition-colors flex items-center justify-center"
            >
              {isExpanded ? <PanelLeftClose size={20} /> : <PanelLeft size={20} />}
            </button>
          </Tooltip>
        </div>

        <nav className="flex-1 overflow-y-auto flex flex-col space-y-1 overflow-x-hidden">
          {navItems.map((item) => {
            if (item.children) {
              const Icon = item.icon;
              const isOpen = openMenus[item.name];
              const isAnyChildActive = item.children.some(child => location.pathname === child.href);

              return (
                <div key={item.name} className="flex flex-col space-y-1 w-full relative">
                  <Tooltip content={isExpanded ? undefined : item.name} position="right">
                    <button
                      onClick={() => toggleMenu(item.name)}
                      className={cn(
                        'flex items-center rounded-md transition-all duration-300 cursor-pointer w-full h-10 relative',
                        !isExpanded && isAnyChildActive 
                          ? 'text-blue-500 bg-blue-500/10 font-medium' 
                          : 'text-subtle hover:text-strong hover:bg-surface-accent/30',
                        isExpanded && isOpen && 'text-strong font-medium'
                      )}
                    >
                      <div className="flex items-center justify-center w-10 h-10 shrink-0">
                        <Icon className={cn("w-5 h-5", isAnyChildActive && !isExpanded && "text-blue-500")} />
                      </div>
                      {!isExpanded && (
                        <ChevronRight size={14} className="absolute -right-1 top-1/2 -translate-y-1/2 text-muted" />
                      )}
                      <span 
                        className={cn(
                          "text-sm truncate transition-all duration-300 whitespace-nowrap flex-1 text-left", 
                          isExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0"
                        )}
                      >
                        {item.name}
                      </span>
                      <div className={cn("flex items-center justify-center shrink-0 transition-all duration-300 overflow-hidden", isExpanded ? "opacity-100 w-8" : "opacity-0 w-0")}>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </div>
                    </button>
                  </Tooltip>
                  
                  <AnimatePresence>
                    {isExpanded && isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex flex-col space-y-1 overflow-hidden"
                      >
                        {item.children.map(child => {
                          const ChildIcon = child.icon;
                          const isChildActive = location.pathname === child.href;
                          return (
                            <Link
                              key={child.name}
                              to={child.href}
                              className={cn(
                                'flex items-center rounded-md transition-all duration-300 cursor-pointer overflow-hidden w-full h-9 pl-4',
                                isChildActive
                                  ? 'text-blue-500 bg-blue-500/10 font-medium'
                                  : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                              )}
                            >
                              <div className="flex items-center justify-center w-8 h-8 shrink-0 mr-2">
                                <ChildIcon className="w-4 h-4" />
                              </div>
                              <span className="text-sm truncate whitespace-nowrap">
                                {child.name}
                              </span>
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            }

            const isActive = location.pathname === item.href;
            const Icon = item.icon;
            return (
              <Tooltip key={item.name} content={isExpanded ? undefined : item.name} position="right">
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center rounded-md transition-all duration-300 cursor-pointer overflow-hidden w-full h-10',
                    isActive
                      ? 'text-blue-500 bg-blue-500/10 font-medium'
                      : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                  )}
                >
                  <div className="flex items-center justify-center w-10 h-10 shrink-0">
                    <Icon className="w-5 h-5" />
                  </div>
                  <span 
                    className={cn(
                      "text-sm truncate transition-all duration-300 whitespace-nowrap", 
                      isExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0"
                    )}
                  >
                    {item.name}
                  </span>
                </Link>
              </Tooltip>
            );
          })}
        </nav>

        <div className="mt-auto pt-4 flex flex-col space-y-1 w-full border-t border-border-subtle/50 shrink-0">
          <div className={cn("tour-notifications flex transition-all duration-300 w-full h-10 shrink-0", isExpanded ? "hover:bg-surface-accent/50 rounded-md" : "")}>
            <NotificationsDropdown expanded={isExpanded} />
          </div>

          <AnimatePresence>
            {isSettingsExpanded && (
              <motion.div 
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: isExpanded ? 4 : 8 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className={cn("flex w-full overflow-hidden flex-col shrink-0", isExpanded ? "bg-surface/50 border border-border-subtle/30 rounded-lg p-1 space-y-1" : "space-y-2")}
              >
                 <Tooltip content={isExpanded ? undefined : `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} position="right">
                   <button
                     onClick={toggleTheme}
                     className={cn("tour-theme-toggle flex items-center text-subtle hover:text-strong rounded-md transition-all duration-300 hover:bg-surface-accent/50 overflow-hidden w-full h-10 shrink-0")}
                   >
                     <div className="flex items-center justify-center w-10 h-10 shrink-0">
                       {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                     </div>
                     <span className={cn("text-sm transition-all duration-300 whitespace-nowrap", isExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0")}>Theme</span>
                   </button>
                 </Tooltip>
                 
                 <Tooltip content={isExpanded ? undefined : "Logout"} position="right">
                   <button
                     onClick={logout}
                     className={cn("flex items-center text-subtle hover:text-red-500 rounded-md transition-all duration-300 hover:bg-red-500/10 overflow-hidden w-full h-10 shrink-0")}
                   >
                     <div className="flex items-center justify-center w-10 h-10 shrink-0">
                       <LogOut size={18} />
                     </div>
                     <span className={cn("text-sm transition-all duration-300 whitespace-nowrap", isExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0")}>Logout</span>
                   </button>
                 </Tooltip>
              </motion.div>
            )}
          </AnimatePresence>

          <Tooltip content={isExpanded ? undefined : (isSettingsExpanded ? "Close Settings" : "Settings")} position="right">
            <button
              onClick={() => setIsSettingsExpanded(!isSettingsExpanded)}
              className={cn("flex items-center text-subtle hover:text-strong rounded-md transition-all duration-300 hover:bg-surface-accent/30 overflow-hidden w-full h-10 shrink-0")}
            >
              <div className="flex items-center justify-center w-10 h-10 shrink-0">
                <Settings size={20} className={cn("transition-transform duration-300", isSettingsExpanded && "rotate-90")} />
              </div>
              <span className={cn("text-sm font-medium transition-all duration-300 whitespace-nowrap truncate", isExpanded ? "opacity-100 max-w-full flex-1 text-left" : "opacity-0 max-w-0")}>Settings</span>
              <div className={cn("flex items-center justify-center shrink-0 transition-all duration-300 overflow-hidden", isExpanded ? "opacity-100 w-8" : "opacity-0 w-0")}>
                {isSettingsExpanded ? <ChevronDown size={16} className="text-muted" /> : <ChevronUp size={16} className="text-muted" />}
              </div>
            </button>
          </Tooltip>

          <div className="flex w-full pt-2 transition-all duration-300 shrink-0">
             <Tooltip content={isExpanded ? undefined : "Profile"} position="right">
               <Link 
                 to="/profile"
                 className={cn("tour-user-dropdown hover:opacity-80 transition-all duration-300 flex items-center overflow-hidden w-full", isExpanded ? "h-12 bg-surface border border-border-subtle rounded-lg shadow-sm" : "h-10 rounded-full")} 
               >
                 <div className="flex items-center justify-center w-10 h-10 shrink-0">
                    <UserAvatar user={user} showTooltip={!isExpanded} />
                 </div>
                 <div className={cn("flex flex-col min-w-0 transition-all duration-300", isExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0")}>
                   <span className="text-sm font-bold text-strong truncate">{user?.name}</span>
                   <span className="text-[10px] text-muted truncate">{user?.email}</span>
                 </div>
               </Link>
             </Tooltip>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-page-bg transition-colors duration-200 overflow-hidden relative">
        <header className="h-14 border-b border-border-subtle bg-surface flex items-center px-4 shrink-0 shadow-sm relative z-[100]">
          <GlobalSearch />
        </header>
        <div className="flex-1 w-full h-full flex flex-col min-h-0 relative z-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

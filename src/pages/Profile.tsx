import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "motion/react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { useGitFeature } from "../contexts/GitFeatureContext";
import { cn, getUserColor, getUserGradient, safeFormatDistanceToNow } from "../lib/utils";
import {
  User as UserIcon,
  Settings,
  Activity,
  Shield,
  Clock,
  LogOut,
  Code,
  Briefcase,
  Eye,
  Calendar as CalendarIcon,
  Database,
  GitBranch,
  Github,
  Gitlab,
  ExternalLink,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import UserAvatar from "../components/UserAvatar";
import ProfileGeneralTab from "../components/profile/ProfileGeneralTab";
import ProfileSecurityTab from "../components/profile/ProfileSecurityTab";
import ProfileSkillsTab from "../components/profile/ProfileSkillsTab";
import ProfileActivityTab from "../components/profile/ProfileActivityTab";
import ProfileDataBackupTab from "../components/profile/ProfileDataBackupTab";
import ProfileGitIntegrationTab from "../components/profile/ProfileGitIntegrationTab";

export const STATUS_OPTIONS = [
  { value: "Available", label: "Available", color: "bg-green-500", text: "text-green-500" },
  { value: "Busy", label: "Busy", color: "bg-red-500", text: "text-red-500" },
  { value: "Away", label: "Away", color: "bg-yellow-500", text: "text-yellow-500" },
  { value: "Offline", label: "Offline", color: "bg-gray-500", text: "text-gray-500" },
  { value: "In a Meeting", label: "In a Meeting", color: "bg-purple-500", text: "text-purple-500" },
  { value: "On Vacation", label: "On Vacation", color: "bg-blue-500", text: "text-blue-500" },
];

export default function Profile() {
  const { user, isAuthenticated, updateUser, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { success, error } = useToast();
  const { gitEnabled, setGitEnabled } = useGitFeature();

  const [name, setName] = useState(user?.name || "");
  const [statusText, setStatusText] = useState(user?.status || "Available");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const tabsRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragDistance, setDragDistance] = useState(0);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!tabsRef.current) return;
    setIsDragging(true);
    setDragDistance(0);
    setStartX(e.pageX - tabsRef.current.offsetLeft);
    setScrollLeft(tabsRef.current.scrollLeft);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !tabsRef.current) return;
    const x = e.pageX - tabsRef.current.offsetLeft;
    const dist = Math.abs(x - startX);
    setDragDistance(dist);
    if (dist > 3) {
      e.preventDefault();
      const walk = (x - startX) * 1.5;
      tabsRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const isManagerOrAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'manager';

  const profileTabs = [
    { id: 'general', label: 'General Settings', icon: Settings },
    { id: 'activity', label: 'Recent Activity', icon: Activity },
    { id: 'security', label: 'Security Log', icon: Shield },
    { id: 'skills', label: 'Skills & Expertise', icon: Code },
    ...(isManagerOrAdmin && gitEnabled ? [{ id: 'integrations', label: 'Integrations', icon: GitBranch }] : []),
    ...((user?.role === 'admin' || user?.role === 'super_admin') ? [{ id: 'backup', label: 'Backup & Restore', icon: Database }] : []),
  ];

  const handleNextTab = () => {
    const currentIndex = profileTabs.findIndex(t => t.id === activeTab);
    const nextIndex = (currentIndex + 1) % profileTabs.length;
    const nextTab = profileTabs[nextIndex];
    if (nextTab) {
      setActiveTab(nextTab.id);
      scrollTabIntoView(nextTab.id);
    }
  };

  const handlePrevTab = () => {
    const currentIndex = profileTabs.findIndex(t => t.id === activeTab);
    const prevIndex = (currentIndex - 1 + profileTabs.length) % profileTabs.length;
    const prevTab = profileTabs[prevIndex];
    if (prevTab) {
      setActiveTab(prevTab.id);
      scrollTabIntoView(prevTab.id);
    }
  };

  const scrollTabIntoView = (tabId: string) => {
    setTimeout(() => {
      if (tabsRef.current) {
        const tabElement = tabsRef.current.querySelector(`[data-tab-id="${tabId}"]`);
        if (tabElement) {
          tabElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    }, 50);
  };

  const [skills, setSkills] = useState<{ id: string, name: string }[]>([]);
  const [newSkill, setNewSkill] = useState("");

  const [stats, setStats] = useState({ tasks: 0, projects: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Backup & Restore states
  const [dbInfo, setDbInfo] = useState<any>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [restoring, setRestoring] = useState(false);

  // Git Integrations Connectivity State
  const [integrationsStatus, setIntegrationsStatus] = useState<any>(null);

  useEffect(() => {
    const fetchIntegrationsStatus = async () => {
      try {
        const res = await fetch("/api/integrations/status", {
          headers: { }
        });
        if (res.ok) {
          const data = await res.json();
          setIntegrationsStatus(data);
        }
      } catch (e) {
        console.error("Failed to fetch integrations status:", e);
      }
    };
    if (isAuthenticated) fetchIntegrationsStatus();
  }, [isAuthenticated]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setStatusText(user.status || "Available");
    }
  }, [user]);

  useEffect(() => {
    if (user?.skills) {
      setSkills(user.skills.map((s, i) => ({ id: i.toString(), name: s })));
    }
  }, [user?.skills]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/users/me/stats", {
          headers: { }
        });
        if (res.ok) {
          const data = await res.json();
          setStats({ tasks: data.tasks, projects: data.projects });
          setActivities(data.recentActivity || []);
        }
      } catch (e) {
        console.error(e);
      }
    }
    if (isAuthenticated) fetchStats();
  }, [isAuthenticated]);

  /**
   * Fetches database engine details and record statistics from the server.
   * Maps results to local component state `dbInfo` to power status visualizers.
   */
  const fetchDbInfo = async () => {
    setLoadingInfo(true);
    try {
      const res = await fetch("/api/backup/info", {
        headers: { }
      });
      if (res.ok) {
        const data = await res.json();
        setDbInfo(data);
      }
    } catch (e) {
      console.error("Failed to fetch database information:", e);
    } finally {
      setLoadingInfo(false);
    }
  };

  // Automatically trigger database metadata fetch when user switches to the Backup tab
  useEffect(() => {
    if (activeTab === 'backup' && isAuthenticated) {
      fetchDbInfo();
    }
  }, [activeTab, isAuthenticated]);

  /**
   * Initiates download of the live binary SQLite database file.
  /**
   * Exports all database tables as a single portable JSON file.
   * Downloads formatted output that can be restored into SQLite or Postgres.
   */
  const handleJsonDownload = async () => {
    try {
      const res = await fetch("/api/backup/export-json", {
        headers: { }
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = "workspace-backup.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        success("JSON database backup downloaded successfully!");
      } else {
        const err = await res.json();
        error(err.error || "Failed to download JSON backup.");
      }
    } catch (e: any) {
      error(`Download failed: ${e.message}`);
    }
  };

  /**
   * Handles portable `.json` database restoration.
   * Parses the file content, structures the payload, and sends a transaction-backed import request.
   * Reloads the page in 2 seconds to force a clean reload of all layout states.
   * 
   * @param {File} file - Selected JSON backup file.
   */
  const handleJsonRestore = async (file: File) => {
    if (!window.confirm("Are you absolutely sure you want to restore from this JSON backup? ALL current tables will be cleared and replaced with backup data.")) {
      return;
    }
    
    setRestoring(true);
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      
      const res = await fetch("/api/backup/restore-json", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(jsonData)
      });
      
      if (res.ok) {
        success("Database restored successfully from JSON backup! Page will reload in 2 seconds.");
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        const errData = await res.json();
        error(errData.error || "Failed to restore JSON database.");
      }
    } catch (e: any) {
      error(`Error: ${e.message}`);
    } finally {
      setRestoring(false);
    }
  };

  const saveSkills = async (newSkillsList: { id: string, name: string }[]) => {
    try {
      const stringSkills = newSkillsList.map(s => s.name);
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name: user?.name, skills: stringSkills }),
      });
      if (res.ok) {
        const updatedUser = await res.json();
        updateUser(updatedUser);
      }
    } catch(err) {
      error("Failed to save skills");
    }
  };

  const handleAddSkill = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSkill.trim() && !skills.some(s => s.name.toLowerCase() === newSkill.trim().toLowerCase())) {
      const newSkillsList = [...skills, { id: Date.now().toString(), name: newSkill.trim() }];
      setSkills(newSkillsList);
      saveSkills(newSkillsList);
      setNewSkill("");
    }
  };

  const handleRemoveSkill = (id: string) => {
    const newSkillsList = skills.filter(s => s.id !== id);
    setSkills(newSkillsList);
    saveSkills(newSkillsList);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordData.currentPassword || !passwordData.newPassword) return;

    setPasswordSaving(true);
    try {
      const res = await fetch("/api/users/me/password", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(passwordData),
      });

      if (res.ok) {
        const data = await res.json();
        if (user && login) {
          login(undefined, user);
        }
        success("Password changed successfully.");
        setIsChangingPassword(false);
        setPasswordData({ currentPassword: '', newPassword: '' });
      } else {
        const data = await res.json();
        error(data.error || "Failed to change password.");
      }
    } catch (err) {
      error("An unexpected error occurred.");
    } finally {
      setPasswordSaving(false);
    }
  };

  const roleInfo = (() => {
    switch (user?.role) {
      case 'super_admin': return { label: 'Super Admin', icon: Shield, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' };
      case 'admin': return { label: 'Administrator', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      case 'manager': return { label: `${user?.rolePrefix || 'Engineering'} Manager`, icon: Briefcase, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' };
      case 'developer': return { label: `${user?.rolePrefix || 'Lead'} Developer`, icon: Code, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'viewer': return { label: 'QA Analyst', icon: Eye, color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/20' };
      default: return { label: 'Team Member', icon: UserIcon, color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' };
    }
  })();
  const RoleIcon = roleInfo.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !name.trim()) {
      error("Name is required and cannot be empty.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, status: statusText }),
      });

      if (res.ok) {
        const updatedUser = await res.json();
        updateUser(updatedUser);
        success("Profile updated successfully.");
      } else {
        const data = await res.json();
        error(data.error || "Failed to update profile.");
      }
    } catch (err) {
      console.error(err);
      error("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 w-full min-w-0 flex flex-col bg-page-bg">
      {/* Cover and header */}
      <div className={`w-full relative h-48 shrink-0 transition-all duration-300 ${getUserGradient(user?.name)}`}>
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-12 -mt-16 relative z-10 w-full min-w-0">
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 min-w-0">
          {/* Left Column: Avatar & Quick Info */}
          <div className="w-full lg:w-80 shrink-0 min-w-0">
            <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-xl flex flex-col items-center text-center">
              <div className="p-2 bg-surface rounded-full shadow-lg -mt-16 mb-4">
                <UserAvatar
                  user={user}
                  className="w-24 h-24 text-4xl shadow-inner"
                  showTooltip={false}
                />
              </div>
              <h2 className="text-xl font-bold text-strong">{user?.name}</h2>
              <p className="text-sm text-muted mb-2">{user?.email}</p>

              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-surface-dim border-border-subtle mb-4 shadow-sm">
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  STATUS_OPTIONS.find(o => o.value === user?.status)?.color || "bg-green-500"
                )} />
                <span className="text-subtle font-medium">{user?.status || "Available"}</span>
              </div>

              <div className={`w-full flex items-center justify-center space-x-2 border rounded py-2 text-xs font-bold uppercase tracking-wider ${skills.length > 0 ? 'mb-4' : 'mb-6'} ${roleInfo.bg} ${roleInfo.border} ${roleInfo.color}`}>
                <RoleIcon size={14} />
                <span>{roleInfo.label}</span>
              </div>

              {skills.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mb-6">
                  {skills.map(skill => (
                    <span key={skill.id} className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 bg-surface-dim border border-border-subtle rounded text-subtle">
                      {skill.name}
                    </span>
                  ))}
                </div>
              )}

              <div className="w-full grid grid-cols-2 gap-4 border-t border-border-subtle pt-6">
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-strong">{stats.tasks}</span>
                  <span className="text-[10px] text-muted uppercase tracking-widest mt-1">Tasks</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-bold text-strong">{stats.projects}</span>
                  <span className="text-[10px] text-muted uppercase tracking-widest mt-1">Projects</span>
                </div>
              </div>

              {/* Git Integrations Status Card */}
              {isManagerOrAdmin && integrationsStatus && gitEnabled && (
                <div className="w-full border-t border-border-subtle pt-4 mt-4 flex flex-col space-y-2">
                  <div className="flex items-center justify-between text-left px-1">
                    <span className="text-[10px] font-bold text-muted uppercase tracking-widest flex items-center space-x-1">
                      <GitBranch size={12} className="text-blue-500" />
                      <span>Git Connectivity</span>
                    </span>
                    <Link to="/git" className="text-[10px] text-blue-500 hover:underline font-semibold flex items-center space-x-0.5">
                      <span>Manage</span>
                      <ExternalLink size={10} />
                    </Link>
                  </div>

                  {/* GitHub Status Badge */}
                  <div className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all",
                    integrationsStatus.github?.color === 'emerald'
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : integrationsStatus.github?.color === 'amber'
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-slate-500/5 border-slate-500/20 text-slate-500 dark:text-slate-400"
                  )}>
                    <div className="flex items-center space-x-2 min-w-0">
                      <Github size={16} className="shrink-0" />
                      <div className="flex flex-col text-left truncate">
                        <span className="font-bold truncate text-[11px]">GitHub</span>
                        <span className="text-[9px] opacity-80 truncate">{integrationsStatus.github?.details}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center space-x-1 shadow-sm",
                        integrationsStatus.github?.color === 'emerald'
                          ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                          : integrationsStatus.github?.color === 'amber'
                          ? "bg-amber-500/20 text-amber-500 border-amber-500/30"
                          : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", integrationsStatus.github?.color === 'emerald' ? "bg-emerald-500 animate-pulse" : (integrationsStatus.github?.color === 'amber' ? "bg-amber-500 animate-pulse" : "bg-slate-400"))} />
                        <span>{integrationsStatus.github?.label}</span>
                      </span>
                    </div>
                  </div>

                  {/* GitLab Status Badge */}
                  <div className={cn(
                    "flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all",
                    integrationsStatus.gitlab?.color === 'emerald'
                      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      : integrationsStatus.gitlab?.color === 'amber'
                      ? "bg-amber-500/5 border-amber-500/20 text-amber-600 dark:text-amber-400"
                      : "bg-slate-500/5 border-slate-500/20 text-slate-500 dark:text-slate-400"
                  )}>
                    <div className="flex items-center space-x-2 min-w-0">
                      <Gitlab size={16} className="shrink-0" />
                      <div className="flex flex-col text-left truncate">
                        <span className="font-bold truncate text-[11px]">GitLab</span>
                        <span className="text-[9px] opacity-80 truncate">{integrationsStatus.gitlab?.details}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-1 shrink-0 ml-2">
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center space-x-1 shadow-sm",
                        integrationsStatus.gitlab?.color === 'emerald'
                          ? "bg-emerald-500/20 text-emerald-500 border-emerald-500/30"
                          : integrationsStatus.gitlab?.color === 'amber'
                          ? "bg-amber-500/20 text-amber-500 border-amber-500/30"
                          : "bg-slate-500/20 text-slate-400 border-slate-500/30"
                      )}>
                        <span className={cn("w-1.5 h-1.5 rounded-full", integrationsStatus.gitlab?.color === 'emerald' ? "bg-emerald-500 animate-pulse" : (integrationsStatus.gitlab?.color === 'amber' ? "bg-amber-500 animate-pulse" : "bg-slate-400"))} />
                        <span>{integrationsStatus.gitlab?.label}</span>
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Settings Carousel */}
          <div className="flex-1 min-w-0">
            {/* Grabbable Carousel Tabs Header */}
            <div className="relative border-b border-border-subtle mb-8 pt-2">
              <div className="flex items-center">
                {/* Left Carousel Arrow */}
                <button
                  type="button"
                  onClick={handlePrevTab}
                  className="shrink-0 p-2 text-subtle hover:text-strong hover:bg-surface-accent/60 rounded-lg transition-colors mr-1 cursor-pointer active:scale-95"
                  title="Previous Tab"
                  aria-label="Previous Tab"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Grabbable Tab Carousel Track */}
                <div
                  ref={tabsRef}
                  onMouseDown={handleMouseDown}
                  onMouseLeave={handleMouseLeaveOrUp}
                  onMouseUp={handleMouseLeaveOrUp}
                  onMouseMove={handleMouseMove}
                  className={cn(
                    "flex space-x-1 overflow-x-auto no-scrollbar scroll-smooth min-w-0 flex-1 select-none pb-0.5",
                    isDragging ? "cursor-grabbing" : "cursor-grab"
                  )}
                >
                  {profileTabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        data-tab-id={tab.id}
                        type="button"
                        onClick={() => {
                          if (dragDistance > 5) return;
                          setActiveTab(tab.id);
                          scrollTabIntoView(tab.id);
                        }}
                        className={`shrink-0 py-3 px-4 sm:px-6 text-xs font-bold uppercase tracking-wider relative transition-colors ${
                          isActive
                            ? 'text-blue-500'
                            : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                        }`}
                      >
                        <span className="whitespace-nowrap">{tab.label}</span>
                        {isActive && (
                          <motion.div
                            layoutId="activeTabUnderline"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full"
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Right Carousel Arrow */}
                <button
                  type="button"
                  onClick={handleNextTab}
                  className="shrink-0 p-2 text-subtle hover:text-strong hover:bg-surface-accent/60 rounded-lg transition-colors ml-1 cursor-pointer active:scale-95"
                  title="Next Tab"
                  aria-label="Next Tab"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Slide Content with Carousel Animation */}
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="space-y-6 pt-2"
              >
              {activeTab === 'general' && (
                <ProfileGeneralTab
                  user={user}
                  name={name}
                  setName={setName}
                  statusText={statusText}
                  setStatusText={setStatusText}
                  statusOptions={STATUS_OPTIONS}
                  saving={saving}
                  handleSubmit={handleSubmit}
                  theme={theme}
                  toggleTheme={toggleTheme}
                  gitEnabled={gitEnabled}
                  toggleGit={() => setGitEnabled(!gitEnabled)}
                />
              )}

              {activeTab === 'activity' && (
                <ProfileActivityTab activities={activities} />
              )}

              {activeTab === 'security' && (
                <ProfileSecurityTab
                  isChangingPassword={isChangingPassword}
                  setIsChangingPassword={setIsChangingPassword}
                  passwordData={passwordData}
                  setPasswordData={setPasswordData}
                  passwordSaving={passwordSaving}
                  handlePasswordSubmit={handlePasswordSubmit}
                />
              )}

              {activeTab === 'skills' && (
                <ProfileSkillsTab
                  skills={skills}
                  newSkill={newSkill}
                  setNewSkill={setNewSkill}
                  handleAddSkill={handleAddSkill}
                  handleRemoveSkill={handleRemoveSkill}
                />
              )}

              {activeTab === 'backup' && (user?.role === 'admin' || user?.role === 'super_admin') && (
                <ProfileDataBackupTab
                  dbInfo={dbInfo}
                  loadingInfo={loadingInfo}
                  restoring={restoring}
                  handleJsonDownload={handleJsonDownload}
                  handleJsonRestore={handleJsonRestore}
                />
              )}

              {activeTab === 'integrations' && (
                <ProfileGitIntegrationTab integrationsStatus={integrationsStatus} />
              )}
            </motion.div>
          </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import { cn, getUserColor, getUserGradient } from "../lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  User as UserIcon,
  Save,
  Moon,
  Sun,
  Settings,
  Monitor,
  Activity,
  Shield,
  Key,
  Clock,
  LogOut,
  Smartphone,
  Globe,
  Code,
  X,
  Plus,
  Briefcase,
  Eye,
  Calendar as CalendarIcon
} from "lucide-react";
import UserAvatar from "../components/UserAvatar";

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { success, error } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');

  const [skills, setSkills] = useState<{ id: string, name: string }[]>([]);
  const [newSkill, setNewSkill] = useState("");

  const [stats, setStats] = useState({ tasks: 0, projects: 0 });
  const [activities, setActivities] = useState<any[]>([]);
  
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (user?.skills) {
      setSkills(user.skills.map((s, i) => ({ id: i.toString(), name: s })));
    }
  }, [user?.skills]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/users/me/stats", {
          headers: { Authorization: `Bearer ${token}` }
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
    if (token) fetchStats();
  }, [token]);

  const saveSkills = async (newSkillsList: { id: string, name: string }[]) => {
    try {
      const stringSkills = newSkillsList.map(s => s.name);
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(passwordData),
      });

      if (res.ok) {
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
      case 'admin': return { label: 'Administrator', icon: Shield, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' };
      case 'manager': return { label: 'Engineering Manager', icon: Briefcase, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' };
      case 'developer': return { label: 'Lead Developer', icon: Code, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' };
      case 'viewer': return { label: 'QA Analyst', icon: Eye, color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/20' };
      default: return { label: 'Team Member', icon: UserIcon, color: 'text-slate-500', bg: 'bg-slate-500/10', border: 'border-slate-500/20' };
    }
  })();
  const RoleIcon = roleInfo.icon;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setSaving(true);
    try {
      const res = await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name }),
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
    <div className="flex-1 overflow-y-auto bg-page-bg">
      {/* Cover and header */}
      <div className={`relative h-48 flex-shrink-0 ${getUserGradient(user?.name)}`}>
        <div className="absolute inset-0 bg-black/20" />
      </div>

      <div className="max-w-4xl mx-auto px-6 pb-12 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Left Column: Avatar & Quick Info */}
          <div className="flex-shrink-0 md:w-1/3">
            <div className="bg-surface border border-border-subtle rounded-xl p-6 shadow-xl flex flex-col items-center text-center">
              <div className="p-2 bg-surface rounded-full shadow-lg -mt-16 mb-4">
                <UserAvatar
                  user={user}
                  className="w-24 h-24 text-4xl shadow-inner"
                  showTooltip={false}
                />
              </div>
              <h2 className="text-xl font-bold text-strong">{user?.name}</h2>
              <p className="text-sm text-muted mb-4">{user?.email}</p>

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
            </div>
          </div>

          {/* Right Column: Settings */}
          <div className="flex-1">
            {/* Tabs */}
            <div className="flex space-x-1 border-b border-border-subtle mb-6">
              <button
                onClick={() => setActiveTab('general')}
                className={`py-3 px-6 text-xs font-bold uppercase tracking-wider relative transition-colors ${
                  activeTab === 'general' ? 'text-blue-500' : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                }`}
              >
                General Settings
                {activeTab === 'general' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`py-3 px-6 text-xs font-bold uppercase tracking-wider relative transition-colors ${
                  activeTab === 'activity' ? 'text-blue-500' : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                }`}
              >
                Recent Activity
                {activeTab === 'activity' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`py-3 px-6 text-xs font-bold uppercase tracking-wider relative transition-colors ${
                  activeTab === 'security' ? 'text-blue-500' : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                }`}
              >
                Security Log
                {activeTab === 'security' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
                )}
              </button>
              <button
                onClick={() => setActiveTab('skills')}
                className={`py-3 px-6 text-xs font-bold uppercase tracking-wider relative transition-colors ${
                  activeTab === 'skills' ? 'text-blue-500' : 'text-subtle hover:text-strong hover:bg-surface-accent/30'
                }`}
              >
                Skills & Expertise
                {activeTab === 'skills' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-t-full" />
                )}
              </button>
            </div>

            <div className="space-y-6">
              {activeTab === 'general' && (
                <>
                  {/* Personal Information */}
                  <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">

                <Settings size={18} className="text-subtle" />
                <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
                  Personal Information
                </h3>
              </div>
              <div className="p-6">
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div>
                    <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-surface-dim border border-border-subtle rounded px-4 py-2 text-strong focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block mb-2">
                      Role
                    </label>
                    <input
                      type="text"
                      value={user?.role?.toUpperCase() || ""}
                      disabled
                      readOnly
                      className="w-full bg-surface-dim/30 border border-border-subtle rounded px-4 py-2 text-strong opacity-70 cursor-not-allowed"
                    />
                    <p className="text-[10px] text-muted mt-2">
                      Roles are managed by workspace administrators.
                    </p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block mb-2">
                      Email Address
                    </label>
                    <input
                      type="text"
                      value={user?.email || ""}
                      readOnly
                      className="w-full bg-surface-dim/30 border border-border-subtle rounded px-4 py-2 text-muted cursor-not-allowed"
                    />
                    <p className="text-[10px] text-muted mt-2">
                      Email address forms your unique identity.
                    </p>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving || name === user?.name}
                      className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:text-strong/50 text-strong px-6 py-2 rounded font-bold uppercase text-[10px] tracking-widest transition-colors"
                    >
                      {saving ? (
                        <span>Saving...</span>
                      ) : (
                        <>
                          <Save size={14} />
                          <span>Save Changes</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Preferences */}
            <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">
                <Monitor size={18} className="text-subtle" />
                <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
                  Preferences
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-strong">
                      Application Theme
                    </h4>
                    <p className="text-xs text-muted mt-1">
                      Switch between light and dark visual modes.
                    </p>
                  </div>
                  <button
                    onClick={toggleTheme}
                    className="flex items-center space-x-2 bg-surface-dim border border-border-subtle hover:border-blue-500/50 px-4 py-2 rounded transition-colors"
                  >
                    {theme === "dark" ? (
                      <>
                        <Sun size={16} className="text-yellow-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-strong">
                          Light Mode
                        </span>
                      </>
                    ) : (
                      <>
                        <Moon size={16} className="text-blue-500" />
                        <span className="text-xs font-bold uppercase tracking-wider text-strong">
                          Dark Mode
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
                </>
              )}

              {activeTab === 'activity' && (
                <div className="space-y-4">
                  <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">
                      <Activity size={18} className="text-subtle" />
                      <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
                        Recent Activity
                      </h3>
                    </div>
                    <div className="p-0">
                      {activities.length > 0 ? activities.map((activity, i) => (
                        <div key={i} className="p-4 border-b border-border-subtle/50 last:border-0 flex items-start space-x-4 hover:bg-surface-dim/20 transition-colors">
                          <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg shrink-0 mt-1">
                            <Activity size={16} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-strong leading-tight">{activity.taskTitle || "Task"}</h4>
                            <p className="text-xs text-muted mt-1 capitalize">{activity.action}</p>
                            <span className="text-[10px] text-subtle uppercase tracking-wider font-bold mt-2 block">
                              {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      )) : (
                        <div className="p-6 text-center text-sm text-muted">
                          No recent activity found.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-6">
                  <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">
                      <Shield size={18} className="text-subtle" />
                      <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
                        Security Overview
                      </h3>
                    </div>
                    <div className="p-6">
                        <div className="flex flex-col space-y-4">
                          {!isChangingPassword ? (
                            <div className="flex items-center justify-between p-4 border border-border-subtle rounded-lg bg-surface-dim/20">
                              <div className="flex items-center space-x-4">
                                <div className="p-2 bg-green-500/10 text-green-500 rounded-full">
                                  <Key size={18} />
                                </div>
                                <div>
                                  <h4 className="text-sm font-bold text-strong">Password</h4>
                                  <p className="text-xs text-muted mt-1">Manage your account password</p>
                                </div>
                              </div>
                              <button 
                                onClick={() => setIsChangingPassword(true)}
                                className="px-4 py-2 border border-border-subtle rounded hover:border-blue-500 text-xs font-bold tracking-wider uppercase transition-colors"
                              >
                                Change
                              </button>
                            </div>
                          ) : (
                            <div className="p-4 border border-border-subtle rounded-lg bg-surface-dim/30">
                              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                                <div>
                                  <label className="block text-xs font-bold text-strong mb-1 uppercase tracking-wider">Current Password</label>
                                  <input 
                                    type="password" 
                                    value={passwordData.currentPassword}
                                    onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})}
                                    className="w-full bg-surface-dim border border-border-subtle rounded p-2 text-sm text-strong focus:outline-none focus:border-blue-500 transition-colors"
                                    required
                                  />
                                </div>
                                <div>
                                  <label className="block text-xs font-bold text-strong mb-1 uppercase tracking-wider">New Password</label>
                                  <input 
                                    type="password" 
                                    value={passwordData.newPassword}
                                    onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                                    className="w-full bg-surface-dim border border-border-subtle rounded p-2 text-sm text-strong focus:outline-none focus:border-blue-500 transition-colors"
                                    required
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsChangingPassword(false);
                                      setPasswordData({ currentPassword: '', newPassword: '' });
                                    }}
                                    className="flex-1 py-2 text-xs font-bold tracking-wider uppercase border border-border-subtle rounded hover:bg-surface-accent/50 transition-colors text-strong"
                                  >
                                    Cancel
                                  </button>
                                  <button 
                                    type="submit" 
                                    disabled={passwordSaving}
                                    className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-50"
                                  >
                                    {passwordSaving ? "Saving..." : "Save"}
                                  </button>
                                </div>
                              </form>
                            </div>
                          )}

                          <div className="flex items-center justify-between p-4 border border-border-subtle rounded-lg bg-surface-dim/20">
                            <div className="flex items-center space-x-4">
                              <div className="p-2 bg-blue-500/10 text-blue-500 rounded-full">
                                <Smartphone size={18} />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-strong">Two-Factor Authentication</h4>
                                <p className="text-xs text-muted mt-1">Protect your account with 2FA.</p>
                              </div>
                            </div>
                            <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold tracking-wider uppercase transition-colors">
                              Enable
                            </button>
                          </div>
                        </div>
                    </div>
                  </div>

                  <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">
                      <Clock size={18} className="text-subtle" />
                      <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
                        Active Sessions
                      </h3>
                    </div>
                    <div className="p-0">
                      <div className="p-4 flex items-center justify-between hover:bg-surface-dim/20 transition-colors">
                        <div className="flex items-center space-x-4">
                          <Globe size={24} className="text-subtle" />
                          <div>
                            <h4 className="text-sm font-bold text-strong">Chrome on macOS</h4>
                            <p className="text-xs text-muted">Zurich, Switzerland • Current Session</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-1 rounded">Active Now</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'skills' && (
                <div className="space-y-6">
                  <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
                    <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Code size={18} className="text-subtle" />
                        <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
                          Skills & Expertise
                        </h3>
                      </div>
                    </div>
                    <div className="p-6">
                      <form onSubmit={handleAddSkill} className="flex gap-2 mb-6">
                        <input
                          type="text"
                          value={newSkill}
                          onChange={(e) => setNewSkill(e.target.value)}
                          placeholder="Add a new skill (e.g., GraphQL)"
                          className="flex-1 bg-surface-dim border border-border-subtle rounded p-2 text-sm text-strong focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <button
                          type="submit"
                          disabled={!newSkill.trim()}
                          className="bg-blue-600 text-white p-2 rounded-md shadow hover:bg-blue-500 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                          <Plus size={20} />
                        </button>
                      </form>

                      <div className="flex flex-wrap gap-2">
                        {skills.map(skill => (
                          <div 
                            key={skill.id} 
                            className="flex items-center space-x-2 bg-surface-dim border border-border-subtle rounded-full px-4 py-2"
                          >
                            <span className="text-sm font-bold text-strong leading-none mt-[2px]">{skill.name}</span>
                            <button
                              onClick={() => handleRemoveSkill(skill.id)}
                              className="text-subtle hover:text-red-500 focus:outline-none bg-surface-accent/20 hover:bg-red-500/10 rounded-full p-0.5 ml-1 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {skills.length === 0 && (
                          <div className="w-full text-center py-6 text-sm text-muted">
                            No skills added yet. Add your technical expertise above.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

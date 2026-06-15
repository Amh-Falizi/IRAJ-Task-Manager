import React, { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";
import { useToast } from "../contexts/ToastContext";
import {
  User as UserIcon,
  Save,
  Moon,
  Sun,
  Settings,
  Monitor,
  Activity,
  Shield,
} from "lucide-react";
import UserAvatar from "../components/UserAvatar";

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { success, error } = useToast();

  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

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
      <div className="relative h-48 bg-gradient-to-r from-blue-900 via-indigo-900 to-purple-900 flex-shrink-0">
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
              <p className="text-sm text-muted mb-6">{user?.email}</p>

              <div className="w-full flex items-center justify-center space-x-2 bg-surface-dim/50 border border-border-subtle rounded py-2 text-xs font-bold uppercase tracking-wider text-subtle mb-4">
                <Shield size={14} className="text-blue-500" />
                <span>Role: {user?.role}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Settings */}
          <div className="flex-1 space-y-6">
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
          </div>
        </div>
      </div>
    </div>
  );
}

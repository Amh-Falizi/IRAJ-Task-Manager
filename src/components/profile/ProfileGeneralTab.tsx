import React from "react";
import { Settings, Monitor, Moon, Sun, Save } from "lucide-react";
import CustomSelect from "../CustomSelect";
import { cn } from "../../lib/utils";
import { User } from "../../types";

export interface StatusOption {
  value: string;
  label: string;
  color: string;
  text: string;
}

interface ProfileGeneralTabProps {
  user: User | null;
  name: string;
  setName: (name: string) => void;
  statusText: string;
  setStatusText: (status: string) => void;
  statusOptions: StatusOption[];
  saving: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  theme: string;
  toggleTheme: () => void;
  gitEnabled: boolean;
  toggleGit: () => void;
}

export const ProfileGeneralTab: React.FC<ProfileGeneralTabProps> = ({
  user,
  name,
  setName,
  statusText,
  setStatusText,
  statusOptions,
  saving,
  handleSubmit,
  theme,
  toggleTheme,
  gitEnabled,
  toggleGit,
}) => {
  return (
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
                Active Status Tag
              </label>
              <CustomSelect
                value={statusText}
                onChange={setStatusText}
                options={statusOptions.map((opt) => ({
                  value: opt.value,
                  label: opt.label.toUpperCase(),
                  icon: (
                    <span
                      className={cn(
                        "w-2.5 h-2.5 rounded-full ring-2 ring-surface shrink-0 inline-block",
                        opt.color
                      )}
                    />
                  ),
                }))}
                size="md"
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
                disabled={saving}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:text-strong/50 text-strong px-6 py-2 rounded font-bold uppercase text-[10px] tracking-widest transition-colors cursor-pointer"
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
              className="flex items-center space-x-2 bg-surface-dim border border-border-subtle hover:border-blue-500 rounded px-4 py-2 text-xs font-bold uppercase tracking-wider text-strong transition-colors cursor-pointer"
            >
              {theme === "dark" ? (
                <>
                  <Sun size={14} className="text-yellow-500" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon size={14} className="text-blue-500" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>
          </div>

          <div className="pt-6 border-t border-border-subtle flex items-center justify-between">
            <div>
              <h4 className="text-sm font-semibold text-strong">
                Git Operations Feature
              </h4>
              <p className="text-xs text-muted mt-1">
                Enable or disable Git repository and branch views across the workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleGit}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                gitEnabled ? "bg-blue-600" : "bg-surface-dim border-border-subtle"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                  gitEnabled ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
export default ProfileGeneralTab;

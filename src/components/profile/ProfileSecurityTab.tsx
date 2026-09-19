import React from "react";
import { Shield, Key, Smartphone, Clock, Globe } from "lucide-react";

interface ProfileSecurityTabProps {
  isChangingPassword: boolean;
  setIsChangingPassword: (val: boolean) => void;
  passwordData: { currentPassword: string; newPassword: string };
  setPasswordData: React.Dispatch<React.SetStateAction<{ currentPassword: string; newPassword: string }>>;
  passwordSaving: boolean;
  handlePasswordSubmit: (e: React.FormEvent) => void;
}

export const ProfileSecurityTab: React.FC<ProfileSecurityTabProps> = ({
  isChangingPassword,
  setIsChangingPassword,
  passwordData,
  setPasswordData,
  passwordSaving,
  handlePasswordSubmit,
}) => {
  return (
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
                  type="button"
                  onClick={() => setIsChangingPassword(true)}
                  className="px-4 py-2 border border-border-subtle rounded hover:border-blue-500 text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="p-4 border border-border-subtle rounded-lg bg-surface-dim/30">
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-strong mb-1 uppercase tracking-wider">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.currentPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, currentPassword: e.target.value })
                      }
                      className="w-full bg-surface-dim border border-border-subtle rounded p-2 text-sm text-strong focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-strong mb-1 uppercase tracking-wider">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) =>
                        setPasswordData({ ...passwordData, newPassword: e.target.value })
                      }
                      className="w-full bg-surface-dim border border-border-subtle rounded p-2 text-sm text-strong focus:outline-none focus:border-blue-500 transition-colors"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsChangingPassword(false);
                        setPasswordData({ currentPassword: "", newPassword: "" });
                      }}
                      className="flex-1 py-2 text-xs font-bold tracking-wider uppercase border border-border-subtle rounded hover:bg-surface-accent/50 transition-colors text-strong cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={passwordSaving}
                      className="flex-1 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer"
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
              <button
                type="button"
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-bold tracking-wider uppercase transition-colors cursor-pointer"
              >
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
                <p className="text-xs text-muted">Current Session</p>
              </div>
            </div>
            <span className="text-[10px] font-bold text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-1 rounded">
              Active Now
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfileSecurityTab;

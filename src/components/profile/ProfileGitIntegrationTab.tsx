import React from "react";
import { Link } from "react-router";
import { GitBranch, ExternalLink, Github, Gitlab, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

export interface IntegrationServiceStatus {
  label: string;
  color: string;
  repoCount: number;
  hasToken: boolean;
  details: string;
}

export interface IntegrationsStatusData {
  github?: IntegrationServiceStatus;
  gitlab?: IntegrationServiceStatus;
}

interface ProfileGitIntegrationTabProps {
  integrationsStatus: IntegrationsStatusData | null;
}

export const ProfileGitIntegrationTab: React.FC<ProfileGitIntegrationTabProps> = ({
  integrationsStatus,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <GitBranch size={18} className="text-blue-500" />
            <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
              Git & Service Integrations Health
            </h3>
          </div>
          <Link
            to="/git"
            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center space-x-1"
          >
            <span>Manage Repositories</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-xs text-subtle leading-relaxed">
            Visual connectivity badges communicate integration health across linked GitHub and GitLab projects. "Connected" indicates a linked repo with valid token configuration. "Action Required" indicates missing or unverified API tokens.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GitHub Integration Details */}
            <div className="border border-border-subtle rounded-xl p-5 bg-surface-dim/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-zinc-900 text-white rounded-lg">
                    <Github size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-strong">GitHub Integration</h4>
                    <p className="text-xs text-muted">Cloud & Enterprise Repositories</p>
                  </div>
                </div>
                {integrationsStatus?.github && (
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border inline-flex items-center space-x-1.5 shadow-sm",
                      integrationsStatus.github.color === "emerald"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : integrationsStatus.github.color === "amber"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        integrationsStatus.github.color === "emerald"
                          ? "bg-emerald-500 animate-pulse"
                          : integrationsStatus.github.color === "amber"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-slate-400"
                      )}
                    />
                    <span>{integrationsStatus.github.label}</span>
                  </span>
                )}
              </div>

              <div className="text-xs text-subtle space-y-2 bg-surface p-3.5 rounded-lg border border-border-subtle/60">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Linked Repositories:</span>
                  <span className="font-bold text-strong">
                    {integrationsStatus?.github?.repoCount || 0} Projects
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Personal Access Token:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      integrationsStatus?.github?.hasToken ? "text-emerald-500" : "text-slate-400"
                    )}
                  >
                    {integrationsStatus?.github?.hasToken
                      ? "Configured & Active"
                      : "Not Linked (Optional)"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-border-subtle/30">
                  <span className="text-muted">Health Details:</span>
                  <span className="font-medium text-strong">{integrationsStatus?.github?.details}</span>
                </div>
              </div>

              <Link
                to="/git"
                className="w-full py-2 px-4 bg-surface hover:bg-surface-accent border border-border-subtle rounded-lg text-xs font-semibold text-strong flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Settings size={14} />
                <span>Configure GitHub Settings</span>
              </Link>
            </div>

            {/* GitLab Integration Details */}
            <div className="border border-border-subtle rounded-xl p-5 bg-surface-dim/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-orange-600 text-white rounded-lg">
                    <Gitlab size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-strong">GitLab Integration</h4>
                    <p className="text-xs text-muted">Self-Hosted & GitLab SaaS</p>
                  </div>
                </div>
                {integrationsStatus?.gitlab && (
                  <span
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border inline-flex items-center space-x-1.5 shadow-sm",
                      integrationsStatus.gitlab.color === "emerald"
                        ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                        : integrationsStatus.gitlab.color === "amber"
                        ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                        : "bg-slate-500/10 text-slate-400 border-slate-500/20"
                    )}
                  >
                    <span
                      className={cn(
                        "w-2 h-2 rounded-full",
                        integrationsStatus.gitlab.color === "emerald"
                          ? "bg-emerald-500 animate-pulse"
                          : integrationsStatus.gitlab.color === "amber"
                          ? "bg-amber-500 animate-pulse"
                          : "bg-slate-400"
                      )}
                    />
                    <span>{integrationsStatus.gitlab.label}</span>
                  </span>
                )}
              </div>

              <div className="text-xs text-subtle space-y-2 bg-surface p-3.5 rounded-lg border border-border-subtle/60">
                <div className="flex justify-between items-center">
                  <span className="text-muted">Linked Repositories:</span>
                  <span className="font-bold text-strong">
                    {integrationsStatus?.gitlab?.repoCount || 0} Projects
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted">Personal Access Token:</span>
                  <span
                    className={cn(
                      "font-semibold",
                      integrationsStatus?.gitlab?.hasToken ? "text-emerald-500" : "text-slate-400"
                    )}
                  >
                    {integrationsStatus?.gitlab?.hasToken ? "Configured & Active" : "Not Linked"}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1.5 border-t border-border-subtle/30">
                  <span className="text-muted">Health Details:</span>
                  <span className="font-medium text-strong">{integrationsStatus?.gitlab?.details}</span>
                </div>
              </div>

              <Link
                to="/git"
                className="w-full py-2 px-4 bg-surface hover:bg-surface-accent border border-border-subtle rounded-lg text-xs font-semibold text-strong flex items-center justify-center space-x-1.5 transition-colors"
              >
                <Settings size={14} />
                <span>Configure GitLab Settings</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfileGitIntegrationTab;

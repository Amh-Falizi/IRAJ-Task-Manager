import React from 'react';
import { Github, Gitlab, Link as LinkIcon, Key, Shield, Sparkles, Copy, Check } from 'lucide-react';

export interface GitSettingsPanelProps {
  repoProvider: 'github' | 'gitlab';
  setRepoProvider: (val: 'github' | 'gitlab') => void;
  defaultBranch: string;
  setDefaultBranch: (val: string) => void;
  repoUrl: string;
  setRepoUrl: (val: string) => void;
  repoOwner: string;
  setRepoOwner: (val: string) => void;
  repoName: string;
  setRepoName: (val: string) => void;
  repoToken: string;
  setRepoToken: (val: string) => void;
  webhookSecret: string;
  setWebhookSecret: (val: string) => void;
  hasWebhookSecret: boolean;
  generatingSecret: boolean;
  handleGenerateWebhookSecret: () => void;
  handleSaveSettings: (e: React.FormEvent) => void;
  savingSettings: boolean;
  isManagerOrAdmin: boolean;
  selectedProjectId: string;
  copiedWebhookUrl: boolean;
  setCopiedWebhookUrl: (val: boolean) => void;
  copiedSecret: boolean;
  setCopiedSecret: (val: boolean) => void;
}

export const GitSettingsPanel: React.FC<GitSettingsPanelProps> = ({
  repoProvider,
  setRepoProvider,
  defaultBranch,
  setDefaultBranch,
  repoUrl,
  setRepoUrl,
  repoOwner,
  setRepoOwner,
  repoName,
  setRepoName,
  repoToken,
  setRepoToken,
  webhookSecret,
  setWebhookSecret,
  hasWebhookSecret,
  generatingSecret,
  handleGenerateWebhookSecret,
  handleSaveSettings,
  savingSettings,
  isManagerOrAdmin,
  selectedProjectId,
  copiedWebhookUrl,
  setCopiedWebhookUrl,
  copiedSecret,
  setCopiedSecret,
}) => {
  if (!isManagerOrAdmin) {
    return (
      <div className="p-8 text-center space-y-3 bg-surface-dim rounded-xl border border-border-subtle my-4">
        <Shield size={36} className="mx-auto text-amber-500" />
        <h3 className="text-sm font-bold text-strong">Integration Settings Restricted</h3>
        <p className="text-xs text-muted max-w-md mx-auto">
          Repository integration configurations (URL, Personal Access Tokens, default branch) can only be altered by Project Managers, System Administrators, or the Project Owner.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSaveSettings} className="max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-subtle mb-1">
            Git Provider
          </label>
          <div className="flex space-x-2">
            <button
              type="button"
              onClick={() => setRepoProvider('github')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 border rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                repoProvider === 'github'
                  ? 'bg-blue-500/10 border-blue-500 text-blue-400'
                  : 'bg-surface-dim border-border-subtle text-muted hover:text-strong'
              }`}
            >
              <Github size={16} />
              <span>GitHub</span>
            </button>
            <button
              type="button"
              onClick={() => setRepoProvider('gitlab')}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 border rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                repoProvider === 'gitlab'
                  ? 'bg-amber-500/10 border-amber-500 text-amber-400'
                  : 'bg-surface-dim border-border-subtle text-muted hover:text-strong'
              }`}
            >
              <Gitlab size={16} />
              <span>GitLab</span>
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-subtle mb-1">
            Default Branch
          </label>
          <input
            type="text"
            value={defaultBranch}
            onChange={(e) => setDefaultBranch(e.target.value)}
            placeholder="main"
            className="w-full px-3 py-2 text-xs font-mono bg-surface-dim border border-border-subtle rounded-lg text-strong focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-subtle mb-1">
          Repository URL
        </label>
        <div className="relative">
          <input
            type="text"
            value={repoUrl}
            onChange={(e) => {
              setRepoUrl(e.target.value);
              try {
                const parsed = new URL(e.target.value);
                const parts = parsed.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
                if (parts.length >= 2) {
                  setRepoOwner(parts[0]);
                  setRepoName(parts.slice(1).join('/'));
                }
              } catch (err) {}
            }}
            placeholder="https://github.com/owner/repository"
            className="w-full pl-8 pr-3 py-2 text-xs bg-surface-dim border border-border-subtle rounded-lg text-strong focus:outline-none focus:border-blue-500"
          />
          <LinkIcon size={14} className="absolute left-2.5 top-2.5 text-muted" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-subtle mb-1">
            Owner / Organization
          </label>
          <input
            type="text"
            value={repoOwner}
            onChange={(e) => setRepoOwner(e.target.value)}
            placeholder="e.g. facebook or devteam"
            className="w-full px-3 py-2 text-xs bg-surface-dim border border-border-subtle rounded-lg text-strong focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-subtle mb-1">
            Repository Name
          </label>
          <input
            type="text"
            value={repoName}
            onChange={(e) => setRepoName(e.target.value)}
            placeholder="e.g. react or backend-api"
            className="w-full px-3 py-2 text-xs bg-surface-dim border border-border-subtle rounded-lg text-strong focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-bold uppercase tracking-wider text-subtle mb-1 flex items-center justify-between">
          <span>Personal Access Token (PAT)</span>
          <span className="text-[10px] text-muted font-normal lowercase">Enables live branch listing & remote creation</span>
        </label>
        <input
          type="password"
          value={repoToken}
          onChange={(e) => setRepoToken(e.target.value)}
          placeholder="github_pat_... or glpat-..."
          className="w-full px-3 py-2 text-xs font-mono bg-surface-dim border border-border-subtle rounded-lg text-strong focus:outline-none focus:border-blue-500"
        />
      </div>

      <div className="pt-2 border-t border-border-subtle">
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-bold uppercase tracking-wider text-subtle">
            Inbound Webhook Secret (HMAC-SHA256)
          </label>
          <button
            type="button"
            onClick={handleGenerateWebhookSecret}
            disabled={generatingSecret}
            className="text-[11px] font-semibold text-blue-500 hover:text-blue-400 flex items-center space-x-1"
          >
            <Sparkles size={12} />
            <span>{generatingSecret ? 'Generating...' : 'Generate New Secret'}</span>
          </button>
        </div>
        <input
          type="password"
          value={webhookSecret}
          onChange={(e) => setWebhookSecret(e.target.value)}
          placeholder={hasWebhookSecret ? "••••••••" : "Paste secret or click generate above"}
          className="w-full px-3 py-2 text-xs font-mono bg-surface-dim border border-border-subtle rounded-lg text-strong focus:outline-none focus:border-blue-500"
        />

        {selectedProjectId && (
          <div className="mt-3 p-3 bg-surface-hover border border-border-subtle rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-strong uppercase tracking-wider">Payload URL for {repoProvider === 'github' ? 'GitHub' : 'GitLab'}</span>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/api/webhooks/${repoProvider}?projectId=${selectedProjectId}`;
                  navigator.clipboard.writeText(url);
                  setCopiedWebhookUrl(true);
                  setTimeout(() => setCopiedWebhookUrl(false), 2000);
                }}
                className="text-[11px] font-semibold text-blue-500 hover:text-blue-400 flex items-center space-x-1"
              >
                {copiedWebhookUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                <span>{copiedWebhookUrl ? 'Copied' : 'Copy Payload URL'}</span>
              </button>
            </div>
            <p className="font-mono text-[11px] text-muted break-all select-all bg-surface-dim p-2 rounded border border-border-subtle/50">
              {`${window.location.origin}/api/webhooks/${repoProvider}?projectId=${selectedProjectId}`}
            </p>
          </div>
        )}
      </div>

      <div className="pt-2 flex justify-end space-x-3">
        <button
          type="submit"
          disabled={savingSettings}
          className="flex items-center space-x-2 px-5 py-2.5 text-xs font-bold uppercase tracking-wider bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-all shadow-md disabled:opacity-50"
        >
          <Key size={14} />
          <span>{savingSettings ? 'Saving...' : 'Save Repository Settings'}</span>
        </button>
      </div>
    </form>
  );
};

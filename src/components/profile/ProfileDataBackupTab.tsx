import React from "react";
import { Database, Download, Upload, FileJson, AlertTriangle } from "lucide-react";

export interface DatabaseInfo {
  dbType: string;
  sqliteSize: number;
  stats?: {
    users?: number;
    tasks?: number;
    projects?: number;
    teams?: number;
    documents?: number;
  };
}

interface ProfileDataBackupTabProps {
  dbInfo: DatabaseInfo | null;
  loadingInfo: boolean;
  restoring: boolean;
  handleJsonDownload: () => void;
  handleJsonRestore: (file: File) => void;
}

export const ProfileDataBackupTab: React.FC<ProfileDataBackupTabProps> = ({
  dbInfo,
  loadingInfo,
  restoring,
  handleJsonDownload,
  handleJsonRestore,
}) => {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Database Info Card */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm animate-slide-up">
        <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">
          <Database size={18} className="text-subtle" />
          <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
            Database Engine Status
          </h3>
        </div>
        <div className="p-6">
          {loadingInfo ? (
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-border-subtle/50 rounded w-1/4"></div>
              <div className="h-10 bg-border-subtle/30 rounded w-full"></div>
            </div>
          ) : dbInfo ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 border border-border-subtle rounded-lg bg-surface-dim/20">
                  <span className="text-[10px] text-muted uppercase tracking-widest block mb-1">
                    Database Engine
                  </span>
                  <span className="text-lg font-bold text-strong">
                    {dbInfo.dbType}
                  </span>
                </div>
                {dbInfo.dbType === "SQLite" && (
                  <div className="p-4 border border-border-subtle rounded-lg bg-surface-dim/20">
                    <span className="text-[10px] text-muted uppercase tracking-widest block mb-1">
                      SQLite File Size
                    </span>
                    <span className="text-lg font-bold text-strong">
                      {(dbInfo.sqliteSize / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-[10px] text-muted uppercase tracking-widest mb-3">
                  Record Statistics
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  <div className="p-3 border border-border-subtle/50 rounded-lg text-center bg-surface-dim/10">
                    <span className="text-xl font-bold text-strong">
                      {dbInfo.stats?.users || 0}
                    </span>
                    <span className="text-[9px] text-muted uppercase tracking-wider block mt-1">
                      Users
                    </span>
                  </div>
                  <div className="p-3 border border-border-subtle/50 rounded-lg text-center bg-surface-dim/10">
                    <span className="text-xl font-bold text-strong">
                      {dbInfo.stats?.tasks || 0}
                    </span>
                    <span className="text-[9px] text-muted uppercase tracking-wider block mt-1">
                      Tasks
                    </span>
                  </div>
                  <div className="p-3 border border-border-subtle/50 rounded-lg text-center bg-surface-dim/10">
                    <span className="text-xl font-bold text-strong">
                      {dbInfo.stats?.projects || 0}
                    </span>
                    <span className="text-[9px] text-muted uppercase tracking-wider block mt-1">
                      Projects
                    </span>
                  </div>
                  <div className="p-3 border border-border-subtle/50 rounded-lg text-center bg-surface-dim/10">
                    <span className="text-xl font-bold text-strong">
                      {dbInfo.stats?.teams || 0}
                    </span>
                    <span className="text-[9px] text-muted uppercase tracking-wider block mt-1">
                      Teams
                    </span>
                  </div>
                  <div className="p-3 border border-border-subtle/50 rounded-lg text-center bg-surface-dim/10">
                    <span className="text-xl font-bold text-strong">
                      {dbInfo.stats?.documents || 0}
                    </span>
                    <span className="text-[9px] text-muted uppercase tracking-wider block mt-1">
                      Docs
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-sm text-muted">
              Failed to load database stats.
            </div>
          )}
        </div>
      </div>

      {/* Backup Utilities */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">
          <Download size={18} className="text-subtle" />
          <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
            Export Database Backups
          </h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 border border-border-subtle rounded-lg bg-surface-dim/10 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-strong font-bold text-sm mb-2">
                  <FileJson size={16} className="text-green-500" />
                  Portable JSON Schema (.json)
                </div>
                <p className="text-xs text-muted mb-4 leading-relaxed">
                  Export database tables in plain JSON. This format is fully portable and can be used to transfer data between SQLite and PostgreSQL backends easily.
                </p>
              </div>
              <button
                type="button"
                onClick={handleJsonDownload}
                className="w-full py-2.5 bg-green-500 hover:bg-green-600 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Download size={14} />
                Download JSON File
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Restore Utilities */}
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">
          <Upload size={18} className="text-subtle" />
          <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
            Restore Database Backups
          </h3>
        </div>
        <div className="p-6 space-y-6">
          <div className="p-4 bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-lg flex items-start gap-3">
            <AlertTriangle size={20} className="shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">Critical Warning</h4>
              <p className="text-xs mt-1 leading-relaxed">
                Restoring a database replaces ALL current records with the contents of the uploaded file. Active sessions will be terminated and you may be logged out. Make sure you have exported a backup first.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 border border-border-subtle rounded-lg bg-surface-dim/10">
              <div className="flex items-center gap-2 text-strong font-bold text-sm mb-2">
                <FileJson size={16} className="text-green-500" />
                Restore JSON File
              </div>
              <p className="text-xs text-muted mb-4 leading-relaxed">
                Upload a portable workspace `.json` backup file to restore records across any engine.
              </p>
              <label className="block w-full">
                <div className="w-full py-2.5 border border-dashed border-border-subtle hover:border-green-500 rounded text-center cursor-pointer transition-colors flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider text-strong">
                  <Upload size={14} />
                  {restoring ? "Uploading..." : "Select File"}
                </div>
                <input
                  type="file"
                  accept=".json"
                  disabled={restoring}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleJsonRestore(file);
                  }}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfileDataBackupTab;

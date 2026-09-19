import React from "react";
import { Activity } from "lucide-react";
import { safeFormatDistanceToNow } from "../../lib/utils";

export interface UserActivityItem {
  taskTitle?: string;
  action: string;
  createdAt: string;
}

interface ProfileActivityTabProps {
  activities: UserActivityItem[];
}

export const ProfileActivityTab: React.FC<ProfileActivityTabProps> = ({ activities }) => {
  return (
    <div className="space-y-4">
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center gap-2">
          <Activity size={18} className="text-subtle" />
          <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
            Recent Activity
          </h3>
        </div>
        <div className="p-0">
          {activities.length > 0 ? (
            activities.map((activity, i) => (
              <div
                key={i}
                className="p-4 border-b border-border-subtle/50 last:border-0 flex items-start space-x-4 hover:bg-surface-dim/20 transition-colors"
              >
                <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg shrink-0 mt-1">
                  <Activity size={16} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-strong leading-tight">
                    {activity.taskTitle || "Task"}
                  </h4>
                  <p className="text-xs text-muted mt-1 capitalize">{activity.action}</p>
                  <span className="text-[10px] text-subtle uppercase tracking-wider font-bold mt-2 block">
                    {safeFormatDistanceToNow(activity.createdAt, { addSuffix: true })}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="p-6 text-center text-sm text-muted">
              No recent activity found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
export default ProfileActivityTab;

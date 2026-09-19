import React from 'react';
import { TaskActivity, User, Task } from '../../types';
import { safeFormatDate } from '../../lib/utils';
import UserAvatar from '../UserAvatar';

export interface TaskActivityListProps {
  activities: TaskActivity[];
  users: User[];
  tasks?: Task[];
  loading: boolean;
  emptyMessage: string;
  showTaskRef?: boolean;
}

export const TaskActivityList: React.FC<TaskActivityListProps> = ({
  activities,
  users,
  tasks,
  loading,
  emptyMessage,
  showTaskRef = false
}) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <span className="text-xs text-subtle uppercase tracking-widest font-bold animate-pulse">Loading...</span>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-sm text-subtle italic p-4 text-center">{emptyMessage}</div>
    );
  }

  return (
    <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-border-strong before:to-transparent">
      {activities.map(a => {
        const author = users.find(u => u.id === a.userId);
        const taskRef = showTaskRef && tasks ? tasks.find(t => t.id === a.taskId) : null;

        return (
          <div key={a.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
            <div className="flex items-center justify-center w-10 h-10 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-lg relative z-10 rounded-full">
              <UserAvatar user={author} showTooltip={false} className="w-10 h-10 text-base" />
            </div>
            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-3 rounded border border-border-strong bg-surface-accent shadow">
              <div className="flex items-center justify-between mb-1">
                <div className="font-bold text-strong text-xs">{author ? author.name : 'Unknown User'}</div>
                <time className="font-mono text-[9px] text-muted">{safeFormatDate(a.createdAt, 'MMM d, h:mm a')}</time>
              </div>
              <div className="text-xs text-primary">{a.action}</div>
              {taskRef && <div className="text-[10px] text-muted mt-1 uppercase">Task: {taskRef.title}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
};

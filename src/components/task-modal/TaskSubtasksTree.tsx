import React from 'react';
import { Task } from '../../types';
import { cn } from '../../lib/utils';
import { CheckCircle2, Plus } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

export interface TaskSubtasksTreeProps {
  taskId: string;
  subtasks: Task[];
  tasks: Task[];
  isDeveloper: boolean;
  onCreateSubtask?: (parentId: string) => void;
  onUpdateTask?: (taskId: string, currentTask: Task, updates: Partial<Task>) => void;
  getStatusTitle: (id: string) => string;
}

export const TaskSubtasksTree: React.FC<TaskSubtasksTreeProps> = ({
  taskId,
  subtasks,
  tasks,
  isDeveloper,
  onCreateSubtask,
  onUpdateTask,
  getStatusTitle
}) => {
  const { error } = useToast();
  return (
    <div>
      <div className="flex justify-between items-center mb-3 border-b border-border-subtle pb-1">
        <h3 className="text-[10px] font-bold text-subtle uppercase tracking-widest">Subtasks ({subtasks.length})</h3>
        {onCreateSubtask && !isDeveloper && (
          <button 
            onClick={() => onCreateSubtask(taskId)} 
            className="flex items-center space-x-1 text-[9px] font-bold bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-blue-500 hover:bg-blue-500 hover:text-white transition-all hover:scale-105 uppercase tracking-wider"
          >
            <Plus size={10} />
            <span>Add Subtask</span>
          </button>
        )}
      </div>
      {subtasks.length > 0 ? (
        <div className="space-y-2">
          {subtasks.map(st => (
            <div key={st.id} className="flex items-center justify-between bg-surface p-3 rounded border border-border-subtle">
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => {
                    if (onUpdateTask) {
                      if (st.status !== 'done') {
                        const pendingDeps = (st.dependencies || []).filter(depId => {
                          const dep = tasks.find(t => t.id === depId);
                          return dep && dep.status !== 'done';
                        });
                        if (pendingDeps.length > 0) {
                          error(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);
                          return;
                        }
                      }
                      onUpdateTask(st.id, st, { status: st.status === 'done' ? 'todo' : 'done' });
                    }
                  }}
                  className="focus:outline-none shrink-0 cursor-pointer"
                  title={st.status === 'done' ? 'Mark as to do' : 'Mark as done'}
                >
                  <CheckCircle2 size={16} className={cn("transition-colors hover:text-green-400", st.status === 'done' ? 'text-green-500' : 'text-border-strong')} />
                </button>
                <span className={cn("text-sm text-strong", st.status === 'done' && 'line-through text-subtle')}>{st.title}</span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-subtle bg-surface-dim px-2 py-1 rounded">
                {getStatusTitle(st.status)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-subtle italic p-2 mt-2 border border-border-subtle border-dashed rounded text-center">No subtasks found.</div>
      )}
    </div>
  );
};

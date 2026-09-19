import React from 'react';
import { Task, User, Milestone } from '../../types';
import { cn, safeFormatDate } from '../../lib/utils';
import {
  AlertCircle,
  ChevronUp,
  Minus,
  ChevronDown,
  Pencil,
  Trash2,
  GitBranch,
  GitPullRequest,
  CheckCircle2,
  CornerDownRight,
  Calendar,
  UserPlus
} from 'lucide-react';
import UserAvatar from '../UserAvatar';

export interface TaskCardProps {
  task: Task;
  users: User[];
  milestones: Milestone[];
  filteredTasks: Task[];
  tasks: Task[];
  columnId: string;
  draggingTaskId: string | null;
  setDraggingTaskId: (id: string | null) => void;
  selectedTaskIds: Set<string>;
  toggleSelection: (id: string) => void;
  handleEditTask: (task: Task) => void;
  handleDeleteTask: (id: string) => void;
  handleDropTask: (taskId: string, targetColId: string, beforeTaskId?: string, position?: 'before' | 'after') => void;
  handleUpdateTask: (id: string, currentTask: Task, partial: Partial<Task>) => void;
  setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
  gitEnabled: boolean;
  success: (msg: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  users,
  milestones,
  filteredTasks,
  tasks,
  columnId,
  draggingTaskId,
  setDraggingTaskId,
  selectedTaskIds,
  toggleSelection,
  handleEditTask,
  handleDeleteTask,
  handleDropTask,
  handleUpdateTask,
  setTasks,
  gitEnabled,
  success
}) => {
  const assignee = users.find(u => u.id === task.assigneeId);
  const subtasks = filteredTasks.filter(t => t.parentId === task.id);
  const completedSubtasks = subtasks.filter(t => t.status === 'done').length;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('taskId', task.id);
        setTimeout(() => setDraggingTaskId(task.id), 0);
      }}
      onDragEnd={() => setDraggingTaskId(null)}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('columnid') || e.dataTransfer.types.includes('columnId')) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        if (y < rect.height / 2) {
          e.currentTarget.style.borderTopColor = '#3b82f6';
          e.currentTarget.style.borderBottomColor = '#2d3139';
        } else {
          e.currentTarget.style.borderTopColor = '#2d3139';
          e.currentTarget.style.borderBottomColor = '#3b82f6';
        }
      }}
      onDragLeave={(e) => {
        e.currentTarget.style.borderTopColor = '';
        e.currentTarget.style.borderBottomColor = '';
      }}
      onDrop={(e) => {
        const draggedColumnId = e.dataTransfer.getData('columnId');
        if (draggedColumnId) {
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.currentTarget.style.borderTopColor = '';
        e.currentTarget.style.borderBottomColor = '';
        const draggedTaskId = e.dataTransfer.getData('taskId');
        if (!draggedTaskId || draggedTaskId === task.id) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const position = y < rect.height / 2 ? 'before' : 'after';

        handleDropTask(draggedTaskId, columnId, task.id, position);
      }}
      onClick={() => handleEditTask(task)}
      className={cn(
        "task-card p-3 bg-surface-dim border rounded cursor-pointer hover:border-blue-500 transition-colors group flex flex-col",
        draggingTaskId === task.id && "opacity-40",
        task.priority === 'urgent' ? 'border-red-500/40' :
        task.priority === 'high' ? 'border-amber-500/40' :
        task.priority === 'medium' ? 'border-blue-500/40' :
        'border-border-subtle'
      )}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <div 
            className={cn(
              "opacity-0 transition-opacity flex items-center justify-center cursor-pointer p-0.5 lg:group-hover:opacity-100",
              (selectedTaskIds.has(task.id) || selectedTaskIds.size > 0) && "opacity-100"
            )}
            onClick={(e) => {
              e.stopPropagation();
              toggleSelection(task.id);
            }}
          >
            <input 
              type="checkbox" 
              readOnly 
              checked={selectedTaskIds.has(task.id)} 
              className="w-3 h-3 cursor-pointer accent-blue-500" 
            />
          </div>
          <div className={cn(
            "flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0",
            task.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
            task.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
            task.priority === 'medium' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
            'bg-surface-accent text-muted border border-border-strong'
          )}>
            {task.priority === 'urgent' && <AlertCircle size={10} />}
            {task.priority === 'high' && <ChevronUp size={10} />}
            {task.priority === 'medium' && <Minus size={10} />}
            {task.priority === 'low' && <ChevronDown size={10} />}
            <span>{task.priority}</span>
          </div>
        </div>
        <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button 
            className="text-subtle hover:text-blue-400 p-1 rounded hover:bg-blue-500/10"
            title="Edit Task"
            onClick={(e) => { e.stopPropagation(); handleEditTask(task); }}
          >
            <Pencil size={14} />
          </button>
          <button 
            className="text-subtle hover:text-red-400 p-1 rounded hover:bg-red-500/10"
            title="Delete Task"
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); handleDeleteTask(task.id); }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <h4 className="text-xs font-bold text-strong mb-1 leading-snug">{task.title}</h4>
      {gitEnabled && task.branchName ? (
        <div className="flex items-center space-x-1 mb-2 flex-wrap gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(`git checkout ${task.branchName}`);
              success(`Copied: git checkout ${task.branchName}`);
            }}
            title="Click to copy: git checkout branch"
            className="inline-flex items-center space-x-1 text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/20 transition-all truncate max-w-[180px]"
          >
            <GitBranch size={10} className="shrink-0" />
            <span className="truncate">{task.branchName}</span>
          </button>
          {task.prUrl && (
            <a
              href={task.prUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center space-x-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/20 transition-colors"
              title="View Pull Request"
            >
              <GitPullRequest size={9} />
              <span>PR</span>
            </a>
          )}
        </div>
      ) : null}
      {task.milestoneId && (
        <div className="text-[9px] font-bold uppercase tracking-widest text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/20 px-1.5 py-0.5 rounded inline-block mb-2 max-w-full truncate">
          {milestones.find(m => m.id === task.milestoneId)?.name || 'Milestone'}
        </div>
      )}
      
      {(() => {
        const allDeps = task.dependencies || [];
        const pendingDeps = allDeps.filter(depId => {
           const dep = filteredTasks.find(t => t.id === depId);
           return dep && dep.status !== 'done';
        }).length;
        
        if (allDeps.length === 0) return null;
        
        return (
          <div className={cn("text-[9px] font-bold uppercase tracking-widest inline-flex items-center space-x-1 px-1.5 py-0.5 rounded mb-2", pendingDeps > 0 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400")}>
             {pendingDeps > 0 ? (
               <>
                 <AlertCircle size={10} />
                 <span>{pendingDeps} Blocked</span>
               </>
             ) : (
               <>
                 <CheckCircle2 size={10} />
                 <span>Unblocked</span>
               </>
             )}
          </div>
        );
      })()}

      {subtasks.length > 0 && (
        <div className="mb-2 mt-1">
          <div className="flex items-center justify-between text-[9px] font-bold text-subtle uppercase tracking-widest mb-1">
            <span>Subtasks</span>
            <span>{completedSubtasks}/{subtasks.length}</span>
          </div>
          <div className="w-full h-1 bg-surface-accent rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-300",
                completedSubtasks === subtasks.length ? "bg-green-500" : "bg-blue-500"
              )} 
              style={{ width: `${(completedSubtasks / subtasks.length) * 100}%` }}
            />
          </div>
          <div className="flex flex-col mt-2 space-y-1 pl-1 border-l-2 border-border-subtle/50 ml-1">
            {subtasks.map(st => (
              <div 
                key={st.id} 
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('taskId', st.id);
                  setTimeout(() => setDraggingTaskId(st.id), 0);
                }}
                onDragEnd={() => setDraggingTaskId(null)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const y = e.clientY - rect.top;
                  if (y < rect.height / 2) {
                    e.currentTarget.style.borderTopColor = '#3b82f6';
                    e.currentTarget.style.borderBottomColor = '';
                  } else {
                    e.currentTarget.style.borderTopColor = '';
                    e.currentTarget.style.borderBottomColor = '#3b82f6';
                  }
                }}
                onDragLeave={(e) => {
                  e.currentTarget.style.borderTopColor = '';
                  e.currentTarget.style.borderBottomColor = '';
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.currentTarget.style.borderTopColor = '';
                  e.currentTarget.style.borderBottomColor = '';
                  const draggedTaskId = e.dataTransfer.getData('taskId');
                  if (!draggedTaskId || draggedTaskId === st.id) return;
                  
                  const draggedTask = tasks.find(t => t.id === draggedTaskId);
                  if (!draggedTask) return;
                  if (draggedTask.parentId === st.parentId) {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const y = e.clientY - rect.top;
                    const position = y < rect.height / 2 ? 'before' : 'after';
                    handleDropTask(draggedTaskId, columnId, st.id, position);
                  }
                }}
                className={cn(
                  "flex justify-between items-center bg-surface p-1.5 rounded cursor-pointer hover:bg-surface-dim border border-transparent hover:border-border-subtle",
                  draggingTaskId === st.id && "opacity-40"
                )}
                onClick={(e) => { e.stopPropagation(); handleEditTask(st); }}
              >
                <div className="flex items-center space-x-1.5 overflow-hidden">
                  <CornerDownRight size={10} className="text-border-strong shrink-0" />
                  <span className={cn(
                    "text-[10px] truncate max-w-[150px]", 
                    st.status === 'done' ? "line-through text-subtle opacity-50" : "text-muted"
                  )}>
                    {st.title}
                  </span>
                </div>
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  st.status === 'done' ? 'bg-green-500' :
                  st.status === 'in_progress' ? 'bg-blue-500' :
                  st.status === 'review' ? 'bg-amber-500' :
                  'bg-surface-accent'
                )} />
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="mt-auto pt-2 flex items-center justify-between text-[10px] text-muted border-t border-border-subtle">
        <div className="flex items-center space-x-1 font-mono">
          <Calendar size={12} />
          <span>
            {safeFormatDate(task.deadline, 'MMM dd', 'NO DEADLINE').toUpperCase()}
          </span>
        </div>
        <div className="flex items-center space-x-2 relative group/assignee" title={assignee ? assignee.name : 'Unassigned'}>
          <div className="cursor-pointer inline-flex relative">
            {assignee ? (
              <UserAvatar user={assignee} className="w-5 h-5 text-[9px] rounded" showTooltip={false} />
            ) : (
              <div className="w-5 h-5 rounded border border-dashed border-border-strong flex items-center justify-center text-muted group-hover:border-blue-500/50 group-hover:text-blue-400 transition-colors bg-surface-dim group-hover:bg-blue-500/10">
                <UserPlus size={10} />
              </div>
            )}
            <select 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              value={task.assigneeId || ""}
              onChange={(e) => {
                e.stopPropagation();
                const newAssigneeId = e.target.value || null;
                setTasks(tasks.map(t => t.id === task.id ? { ...t, assigneeId: newAssigneeId } : t));
                handleUpdateTask(task.id, task, { assigneeId: newAssigneeId });
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="">Unassigned</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

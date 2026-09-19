import React from 'react';
import { Column } from '../../pages/Board';
import { Task, User, Milestone } from '../../types';
import { Plus, Trash2 } from 'lucide-react';
import { Tooltip } from '../Tooltip';
import { TaskCard } from './TaskCard';

export interface BoardColumnProps {
  column: Column;
  columns: Column[];
  setColumns: React.Dispatch<React.SetStateAction<Column[]>>;
  draggingColumnId: string | null;
  setDraggingColumnId: (id: string | null) => void;
  handleColumnDragEnter: (colId: string) => void;
  editingColumnId: string | null;
  setEditingColumnId: (id: string | null) => void;
  editingColumnTitle: string;
  setEditingColumnTitle: (title: string) => void;
  handleUpdateColumnTitle: (id: string) => void;
  handleDeleteColumn: (id: string) => void;
  handleCreateTaskInColumn: (colId: string) => void;
  columnTasks: Task[];
  filteredTasks: Task[];
  tasks: Task[];
  users: User[];
  milestones: Milestone[];
  userRole?: string;
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

export const BoardColumn: React.FC<BoardColumnProps> = ({
  column,
  columns,
  setColumns,
  draggingColumnId,
  setDraggingColumnId,
  handleColumnDragEnter,
  editingColumnId,
  setEditingColumnId,
  editingColumnTitle,
  setEditingColumnTitle,
  handleUpdateColumnTitle,
  handleDeleteColumn,
  handleCreateTaskInColumn,
  columnTasks,
  filteredTasks,
  tasks,
  users,
  milestones,
  userRole,
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
  return (
    <div 
      className={`w-[290px] sm:w-80 snap-center flex-shrink-0 flex flex-col bg-surface border rounded-lg transition-colors duration-200 ${draggingColumnId === column.id ? 'opacity-50 border-dashed border-blue-500' : 'border-border-subtle'} `}
      onDragEnter={() => {
        if (draggingColumnId) {
          handleColumnDragEnter(column.id);
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.currentTarget.classList.add('border-blue-500/50');
      }}
      onDragLeave={(e) => {
        e.currentTarget.classList.remove('border-blue-500/50');
      }}
      onDrop={async (e) => {
        e.preventDefault();
        e.currentTarget.classList.remove('border-blue-500/50');
        
        const columnId = e.dataTransfer.getData('columnId');
        const taskId = e.dataTransfer.getData('taskId');
        
        if (columnId && columnId !== column.id) {
          setColumns(prev => {
            const newColumns = [...prev];
            const sourceIdx = newColumns.findIndex(c => c.id === columnId);
            const targetIdx = newColumns.findIndex(c => c.id === column.id);
            if (sourceIdx !== -1 && targetIdx !== -1) {
              const [dragged] = newColumns.splice(sourceIdx, 1);
              newColumns.splice(targetIdx, 0, dragged);
            }
            return newColumns;
          });
        } else if (taskId) {
          handleDropTask(taskId, column.id);
        }
        setDraggingColumnId(null);
      }}
    >
      <div 
        className="px-4 py-3 flex justify-between items-center border-b border-border-subtle group cursor-move"
        draggable
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('columnId', column.id);
          setTimeout(() => setDraggingColumnId(column.id), 0);
        }}
        onDragEnd={() => {
          setDraggingColumnId(null);
        }}
      >
        <div className="flex items-center space-x-2 flex-1">
          {editingColumnId === column.id ? (
            <input
              type="text"
              className="text-xs font-bold text-strong uppercase tracking-widest bg-transparent border-b border-blue-500 outline-none w-full"
              value={editingColumnTitle}
              onChange={(e) => setEditingColumnTitle(e.target.value)}
              onBlur={() => handleUpdateColumnTitle(column.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleUpdateColumnTitle(column.id);
                if (e.key === 'Escape') setEditingColumnId(null);
              }}
              autoFocus
            />
          ) : (
            <h3 className="text-xs font-bold text-strong uppercase tracking-widest cursor-pointer" onDoubleClick={() => {
              setEditingColumnId(column.id);
              setEditingColumnTitle(column.title);
            }}>
              {column.title}
            </h3>
          )}
          <span className="bg-surface-accent text-strong px-2 py-0.5 rounded text-[10px] font-medium">
            {columnTasks.length}
          </span>
        </div>
        <div className="flex flex-row items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {userRole !== 'developer' && (
            <Tooltip content={`Add Task to ${column.title}`} position="top">
              <button
                onClick={() => handleCreateTaskInColumn(column.id)}
                className="bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white p-1 rounded transition-colors"
              >
                <Plus size={16} />
              </button>
            </Tooltip>
          )}
          <Tooltip content={`Delete ${column.title}`} position="top">
            <button
              onClick={() => handleDeleteColumn(column.id)}
              className="text-subtle hover:text-red-400"
            >
              <Trash2 size={14} />
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {columnTasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            users={users}
            milestones={milestones}
            filteredTasks={filteredTasks}
            tasks={tasks}
            columnId={column.id}
            draggingTaskId={draggingTaskId}
            setDraggingTaskId={setDraggingTaskId}
            selectedTaskIds={selectedTaskIds}
            toggleSelection={toggleSelection}
            handleEditTask={handleEditTask}
            handleDeleteTask={handleDeleteTask}
            handleDropTask={handleDropTask}
            handleUpdateTask={handleUpdateTask}
            setTasks={setTasks}
            gitEnabled={gitEnabled}
            success={success}
          />
        ))}
      </div>
    </div>
  );
};

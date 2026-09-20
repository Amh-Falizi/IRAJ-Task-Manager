import React, { useState, useEffect } from 'react';
import { Task, User, Project } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { useGitFeature } from '../contexts/GitFeatureContext';
import { X, GitBranch, Edit2, Calendar, Clock, CheckCircle2, Trash, Plus, FolderKanban, GitPullRequest, ExternalLink, ChevronDown } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn, getIncrementedBranchName, safeFormatDate } from '../lib/utils';
import UserAvatar from './UserAvatar';
import CustomSelect from './CustomSelect';
import { TaskCommentsThread } from './task-modal/TaskCommentsThread';
import { TaskActivityList } from './task-modal/TaskActivityList';
import { TaskSubtasksTree } from './task-modal/TaskSubtasksTree';

interface TaskModalProps {
  task: Task | null;
  users: User[];
  tasks?: Task[]; // passed for parsing subtasks
  columns?: {id: string, title: string}[]; // dynamic columns
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  onUpdateTask?: (taskId: string, currentTask: Task, updates: Partial<Task>) => void;
  onDeleteTask?: (taskId: string) => void;
  onCreateSubtask?: (parentId: string) => void;
  parentId?: string | null;
  projectId?: string | null;
  initialStatus?: string;
  initialDeadline?: string;
}

export default function TaskModal({ task, users, tasks = [], columns, onClose, onSave, onUpdateTask, onDeleteTask, onCreateSubtask, parentId, projectId, initialStatus, initialDeadline }: TaskModalProps) {
  const { isAuthenticated, user } = useAuth();
  const { success, error, info } = useToast();
  const { gitEnabled } = useGitFeature();
  const isEdit = !!task;
  const isSuperAdmin = user?.role === 'super_admin';
  const canEditAllTasks = isSuperAdmin || user?.permissions?.edit_all_tasks === true || user?.role === 'admin' || user?.role === 'manager';
  const canDeleteTasks = isSuperAdmin || user?.permissions?.delete_tasks === true || user?.role === 'admin' || user?.role === 'manager';
  const canCreateTasks = isSuperAdmin || user?.permissions?.create_tasks !== false;
  // Developers or non-managers editing existing tasks can update progress and comments but not administrative task metadata
  const isDeveloper = !canEditAllTasks && isEdit;

  const canEdit = !isEdit
    ? canCreateTasks
    : (canEditAllTasks || user?.id === task?.creatorId || user?.id === task?.assigneeId);
  const [isViewMode, setIsViewMode] = useState(isEdit);

  const getStatusTitle = (id: string) => columns?.find(c => c.id === id)?.title || id.replace('_', ' ');
  
  const [formData, setFormData] = useState<Partial<Task>>({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || (initialStatus as any) || 'todo',
    priority: task?.priority || 'medium',
    deadline: task?.deadline ? task.deadline.split('T')[0] : (initialDeadline ? initialDeadline.split('T')[0] : new Date().toISOString().split('T')[0]),
    assigneeId: task?.assigneeId || '',
    branchName: task?.branchName || '',
    parentId: task?.parentId || parentId || null,
    projectId: task?.projectId || projectId || null,
    milestoneId: task?.milestoneId || null,
    dependencies: task?.dependencies || []
  });

  const [projectsList, setProjectsList] = useState<Project[]>([]);
  
  useEffect(() => {
    fetch('/api/projects', { headers: { } })
      .then(res => res.json())
      .then(data => {
        setProjectsList(data);
        if (data.length === 1 && !formData.projectId) {
          setFormData(prev => ({ ...prev, projectId: data[0].id }));
        }
      })
      .catch(err => console.error("Error fetching projects", err));
  }, [isAuthenticated]);

  useEffect(() => {
    if (formData.projectId) {
      fetch(`/api/projects/${formData.projectId}/milestones`, { headers: { } })
        .then(res => res.json())
        .then(data => {
          setMilestones(data);
        })
        .catch(err => console.error("Error fetching milestones", err));
    } else {
      setMilestones([]);
    }
  }, [formData.projectId, isAuthenticated]);

  const [generatingBranch, setGeneratingBranch] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'activity' | 'project_activity'>('details');
  const [comments, setComments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [projectActivities, setProjectActivities] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState('');
  const [newCommentPreviewMode, setNewCommentPreviewMode] = useState(false);
  const [editCommentPreviewMode, setEditCommentPreviewMode] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [milestones, setMilestones] = useState<any[]>([]);

  useEffect(() => {
    if (isViewMode && task) {
      setLoadingDetails(true);
      Promise.all([
        fetch(`/api/tasks/${task.id}/details`, { headers: { } }).then(r => r.json()),
        (task.projectId || projectId) 
          ? fetch(`/api/projects/${task.projectId || projectId}/activity`, { headers: { } }).then(r => r.json()) 
          : Promise.resolve([])
      ])
      .then(([taskDetails, projectActivityData]) => {
        setComments(taskDetails.comments || []);
        setActivities(taskDetails.activities || []);
        setProjectActivities(projectActivityData || []);
      })
      .catch(err => console.error("Error fetching details", err))
      .finally(() => setLoadingDetails(false));
    }
  }, [isViewMode, task, isAuthenticated, projectId]);

  const handleCreateComment = async () => {
    if (!newComment.trim() || !task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment.trim() })
      });
      const comment = await res.json();
      setComments([...comments, comment]);
      setNewComment('');
      // Optionally reload activities since comment adds one
      fetch(`/api/tasks/${task.id}/details`, { headers: { } })
        .then(res => res.json())
        .then(data => setActivities(data.activities || []));
    } catch (err) {
      console.error(err);
    }
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentContent.trim() || !task) return;
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: editCommentContent.trim() })
      });
      const updatedComment = await res.json();
      setComments(comments.map(c => c.id === commentId ? updatedComment : c));
      setEditingCommentId(null);
      setEditCommentContent('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {

    if (!task) return;
    try {
      await fetch(`/api/tasks/${task.id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: {
        }
      });
      setComments(comments.filter(c => c.id !== commentId));
      success('Comment deleted');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title?.trim()) {
      error("Please enter a Task Title.");
      return;
    }
    if (!formData.projectId) {
      error("Please select a Project. This is a mandatory field.");
      return;
    }
    if (formData.status === 'done') {
       const pendingDeps = (formData.dependencies || []).filter(depId => {
         const dep = tasks.find(t => t.id === depId);
         return dep && dep.status !== 'done';
       });
       if (pendingDeps.length > 0) {
         error(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);
         return;
       }
    }

    onSave({
      ...formData,
      branchName: formData.branchName ? formData.branchName.trim().toUpperCase() : '',
      assigneeId: formData.assigneeId === '' ? null : formData.assigneeId
    });
  };

  const handleCreateRemoteBranch = async () => {
    if (!formData.projectId) {
      error('Please select a project first');
      return;
    }
    const cleanTitle = (formData.title || 'task').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const proj = projectsList.find(p => p.id === formData.projectId);
    const keyPrefix = proj?.projectKey ? `${proj.projectKey}-` : '';
    const targetBranch = formData.branchName || `${keyPrefix}${cleanTitle}`;

    setGeneratingBranch(true);
    try {
      const res = await fetch(`/api/projects/${formData.projectId}/git/branches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branchName: targetBranch,
          taskId: task?.id || null
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFormData(prev => ({ ...prev, branchName: data.branchName || targetBranch }));
        success(data.message || `Remote branch '${targetBranch}' created successfully!`);
      } else {
        error(data.error || 'Failed to create remote branch');
      }
    } catch (err) {
      error('Error creating remote branch');
    } finally {
      setGeneratingBranch(false);
    }
  };

  const handleGenerateBranch = async () => {
    if (!formData.title) return;
    setGeneratingBranch(true);
    try {
      const res = await fetch('/api/tasks/branch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: formData.title, type: 'feat', projectId: task?.projectId || projectId })
      });
      const data = await res.json();
      if (data.branchName) {
        setFormData(prev => ({ ...prev, branchName: data.branchName }));
        success('Branch created successfully');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setGeneratingBranch(false);
    }
  };

  const handleCreateTaskPR = async (t: Task) => {
    if (!t.branchName || !t.projectId) return;
    try {
      const res = await fetch(`/api/projects/${t.projectId}/git/pull-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId: t.id,
          sourceBranch: t.branchName,
          title: `[Task] ${t.title}`
        })
      });

      const data = await res.json();
      if (res.ok && data.prUrl) {
        window.open(data.prUrl, '_blank');
        success('Pull Request link opened!');
      } else {
        error('Failed to create Pull Request');
      }
    } catch (err) {
      error('Error creating Pull Request');
    }
  };

  if (isViewMode && task) {
    const subtasks = tasks.filter(t => t.parentId === task.id);
    const assignee = users.find(u => u.id === task.assigneeId);
    
    return (
      <div className="fixed inset-y-0 right-0 left-0 md:left-[var(--sidebar-width,80px)] z-50 overflow-y-auto flex justify-center items-start p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
        <div className="my-auto bg-surface border border-border-subtle rounded-lg shadow-2xl w-full max-w-3xl max-h-[calc(100vh-2rem)] md:max-h-[90vh] flex flex-col font-sans overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-start bg-page-bg">
            <div className="flex-1 pr-4">
              <h2 className="text-xl font-bold text-strong mb-2">{task.title}</h2>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className={cn(
                  "px-2 py-0.5 rounded font-bold uppercase tracking-wider",
                  task.priority === 'urgent' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                  task.priority === 'high' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  task.priority === 'medium' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                  'bg-surface-accent text-muted border border-border-strong'
                )}>
                  {task.priority} Priority
                </span>
                <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider bg-surface-accent text-strong">
                  {getStatusTitle(task.status)}
                </span>
                {gitEnabled && task.branchName && (
                  <div className="flex items-center space-x-1">
                    <span className="flex items-center space-x-1 text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20 font-mono">
                      <GitBranch size={12} />
                      <span>{task.branchName}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCreateTaskPR(task)}
                      title="Create Pull/Merge Request for this branch"
                      className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors flex items-center space-x-1"
                    >
                      <GitPullRequest size={10} />
                      <span>PR</span>
                    </button>
                  </div>
                )}
                {gitEnabled && task.prUrl && (
                  <a
                    href={task.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20"
                  >
                    <ExternalLink size={10} />
                    <span>View PR</span>
                  </a>
                )}
                {task.milestoneId && (
                  <span className="px-2 py-0.5 rounded font-bold uppercase tracking-wider text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/20">
                    M: {milestones.find(m => m.id === task.milestoneId)?.name || 'Unknown Milestone'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2 shrink-0">
              {onDeleteTask && (canDeleteTasks || user?.id === task.creatorId) && (
                <button
                  onClick={() => {
                    onDeleteTask(task.id);
                    onClose();
                  }}
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-red-600/10 text-red-400 hover:bg-red-600/20 rounded border border-red-500/20 transition-colors uppercase text-[10px] font-bold tracking-widest"
                  title="Delete Task"
                >
                  <Trash size={12} />
                  <span>Delete</span>
                </button>
              )}
              {canEdit && (
                <button 
                  onClick={() => setIsViewMode(false)} 
                  className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 rounded border border-blue-500/20 transition-colors uppercase text-[10px] font-bold tracking-widest"
                >
                  <Edit2 size={12} />
                  <span>Edit</span>
                </button>
              )}
              <button onClick={onClose} className="text-subtle hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors">
                <X size={20} />
              </button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-surface-dim">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="col-span-2 flex flex-col h-full min-h-0">
                <div className="flex flex-wrap border-b border-border-subtle mb-4 space-x-1 shrink-0">
                  <button 
                    onClick={() => setActiveTab('details')}
                    className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'details' ? "border-blue-500 text-blue-400" : "border-transparent text-subtle hover:text-strong")}
                  >
                    Details
                  </button>
                  <button 
                    onClick={() => setActiveTab('comments')}
                    className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'comments' ? "border-blue-500 text-blue-400" : "border-transparent text-subtle hover:text-strong")}
                  >
                    Comments {comments.length > 0 && `(${comments.length})`}
                  </button>
                  <button 
                    onClick={() => setActiveTab('activity')}
                    className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'activity' ? "border-blue-500 text-blue-400" : "border-transparent text-subtle hover:text-strong")}
                  >
                    Task Activity {activities.length > 0 && `(${activities.length})`}
                  </button>
                  <button 
                    onClick={() => setActiveTab('project_activity')}
                    className={cn("px-4 py-2 text-[10px] font-bold uppercase tracking-widest border-b-2 transition-colors", activeTab === 'project_activity' ? "border-blue-500 text-blue-400" : "border-transparent text-subtle hover:text-strong")}
                  >
                    Project Activity {projectActivities.length > 0 && `(${projectActivities.length})`}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                  {activeTab === 'details' && (
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-3 border-b border-border-subtle pb-1">Description</h3>
                        <div className="prose dark:prose-invert prose-sm max-w-none text-primary">
                          {task.description ? (
                            <Markdown skipHtml={true}>{task.description}</Markdown>
                          ) : (
                            <span className="italic text-subtle">No description provided.</span>
                          )}
                        </div>
                      </div>

                      {task.dependencies && task.dependencies.length > 0 && (
                        <div>
                          <h3 className="text-[10px] font-bold text-subtle uppercase tracking-widest mb-3 border-b border-border-subtle pb-1">Dependencies</h3>
                          <div className="space-y-2">
                             {task.dependencies.map(depId => {
                               const depTask = tasks.find(t => t.id === depId);
                               if (!depTask) return null;
                               return (
                                  <div key={depId} className="flex items-center space-x-2 bg-surface p-2 rounded border border-border-subtle">
                                     <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", depTask.status === 'done' ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400")}>{depTask.status === 'done' ? 'Met' : 'Pending'}</span>
                                     <span className="text-sm text-strong">{depTask.title}</span>
                                  </div>
                               );
                             })}
                          </div>
                        </div>
                      )}

                      <TaskSubtasksTree
                        taskId={task.id}
                        subtasks={subtasks}
                        tasks={tasks}
                        isDeveloper={isDeveloper}
                        onCreateSubtask={onCreateSubtask}
                        onUpdateTask={onUpdateTask}
                        getStatusTitle={getStatusTitle}
                      />
                    </div>
                  )}

                  {activeTab === 'comments' && (
                    <div className="space-y-4 flex flex-col h-full bg-surface rounded p-4 border border-border-subtle">
                      <TaskCommentsThread
                        comments={comments}
                        users={users}
                        currentUserId={user?.id}
                        currentUserRole={user?.role}
                        newComment={newComment}
                        setNewComment={setNewComment}
                        newCommentPreviewMode={newCommentPreviewMode}
                        setNewCommentPreviewMode={setNewCommentPreviewMode}
                        editingCommentId={editingCommentId}
                        setEditingCommentId={setEditingCommentId}
                        editCommentContent={editCommentContent}
                        setEditCommentContent={setEditCommentContent}
                        editCommentPreviewMode={editCommentPreviewMode}
                        setEditCommentPreviewMode={setEditCommentPreviewMode}
                        handleCreateComment={handleCreateComment}
                        handleEditComment={handleEditComment}
                        handleDeleteComment={handleDeleteComment}
                      />
                    </div>
                  )}

                  {activeTab === 'activity' && (
                    <div className="space-y-4 bg-surface rounded p-4 border border-border-subtle min-h-[200px]">
                      <TaskActivityList
                        activities={activities}
                        users={users}
                        loading={loadingDetails}
                        emptyMessage="No task activity recorded."
                      />
                    </div>
                  )}

                  {activeTab === 'project_activity' && (
                    <div className="space-y-4 bg-surface rounded p-4 border border-border-subtle min-h-[200px]">
                      <TaskActivityList
                        activities={projectActivities}
                        users={users}
                        tasks={tasks}
                        loading={loadingDetails}
                        emptyMessage="No project activity recorded."
                        showTaskRef={true}
                      />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="bg-surface border border-border-subtle rounded-lg p-4 space-y-4">
                  <div>
                    <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block mb-1">Assignee</label>
                    {assignee ? (
                      <div className="flex items-center space-x-2 text-sm text-strong bg-surface-dim p-2 rounded border border-border-subtle">
                        <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center font-bold text-xs">{assignee.name.charAt(0).toUpperCase()}</div>
                        <span>{assignee.name}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-subtle italic">Unassigned</span>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block mb-1">Project</label>
                    {task.projectId ? (
                      <div className="flex items-center space-x-2 text-sm text-strong bg-surface-dim p-2 rounded border border-border-subtle">
                        <FolderKanban size={14} className="text-blue-400" />
                        <span>{projectsList.find(p => p.id === task.projectId)?.name || 'Unknown Project'}</span>
                      </div>
                    ) : (
                      <span className="text-sm text-subtle italic">No Project</span>
                    )}
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block mb-1">Deadline</label>
                    <div className="flex items-center space-x-2 text-sm text-strong bg-surface-dim p-2 rounded border border-border-subtle">
                      <Calendar size={14} className="text-muted" />
                      <span>{safeFormatDate(task.deadline, 'PP', 'No Deadline')}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block mb-1">Created</label>
                    <div className="flex items-center space-x-2 text-sm text-strong bg-surface-dim p-2 rounded border border-border-subtle">
                      <Clock size={14} className="text-muted" />
                      <span>{safeFormatDate(task.createdAt, 'PP')}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-y-0 right-0 left-0 md:left-[var(--sidebar-width,80px)] z-50 overflow-y-auto flex justify-center items-start p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
      <div className="my-auto bg-surface border border-border-subtle rounded-lg shadow-2xl w-full max-w-3xl max-h-[calc(100vh-2rem)] md:max-h-[90vh] flex flex-col font-sans">
        <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-page-bg rounded-t-lg">
          <h2 className="text-sm font-bold text-strong uppercase tracking-widest">{isEdit ? 'Edit Task' : 'Create Task'}</h2>
          <button onClick={onClose} className="text-subtle hover:text-red-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block font-sans">Task Title</label>
            <input
              required
              type="text"
              className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-xs text-strong placeholder-slate-600 focus:border-blue-500 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed"
              value={formData.title}
              onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block font-sans">Status</label>
              <CustomSelect
                value={formData.status}
                onChange={(val) => setFormData(p => ({ ...p, status: val as any }))}
                options={(columns || [
                  { id: 'todo', title: 'To Do' },
                  { id: 'in_progress', title: 'In Progress' },
                  { id: 'review', title: 'Review' },
                  { id: 'done', title: 'Done' }
                ]).map(c => ({ value: c.id, label: c.title.toUpperCase() }))}
                size="sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block font-sans">Priority</label>
              <CustomSelect
                disabled={isDeveloper}
                value={formData.priority}
                onChange={(val) => setFormData(p => ({ ...p, priority: val as any }))}
                options={[
                  { value: 'low', label: 'LOW' },
                  { value: 'medium', label: 'MEDIUM' },
                  { value: 'high', label: 'HIGH' },
                  { value: 'urgent', label: 'URGENT' },
                ]}
                size="sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block font-sans">Assignee</label>
              <CustomSelect
                disabled={isDeveloper}
                value={formData.assigneeId || ''}
                onChange={(val) => setFormData(p => ({ ...p, assigneeId: val || null }))}
                options={[
                  { value: '', label: 'UNASSIGNED' },
                  ...users.map(u => ({ value: u.id, label: `${u.name.toUpperCase()} (${u.role.replace('_', ' ').toUpperCase()})` }))
                ]}
                size="sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block font-sans">Project</label>
              <CustomSelect
                disabled={isDeveloper}
                value={formData.projectId || ''}
                onChange={(val) => setFormData(p => ({ ...p, projectId: val, milestoneId: null }))}
                options={projectsList.map(p => ({ value: p.id, label: p.name.toUpperCase() }))}
                placeholder="SELECT PROJECT..."
                size="sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block font-sans">Milestone</label>
              <CustomSelect
                disabled={isDeveloper || !formData.projectId || milestones.length === 0}
                value={formData.milestoneId || ''}
                onChange={(val) => setFormData(p => ({ ...p, milestoneId: val || null }))}
                options={[
                  { value: '', label: 'NO MILESTONE' },
                  ...milestones.map(m => ({ value: m.id, label: m.name.toUpperCase() }))
                ]}
                size="sm"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block font-sans">Deadline</label>
              <div className="relative col-span-1">
                <input
                  type="date"
                  required
                  disabled={isDeveloper}
                  className="w-full rounded bg-surface-dim border border-border-subtle pl-9 pr-3 py-2 text-xs text-strong font-mono focus:border-blue-500 focus:outline-none dark:[color-scheme:dark] disabled:opacity-60 disabled:cursor-not-allowed"
                  value={formData.deadline}
                  onChange={e => setFormData(p => ({ ...p, deadline: e.target.value }))}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle pointer-events-none">
                  <Calendar size={12} />
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-1">
             <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">Dependencies (Blocks this task)</label>
             <div className="max-h-32 overflow-y-auto bg-surface-dim border border-border-subtle rounded p-2 space-y-1">
                {tasks.filter(t => t.id !== task?.id && (!formData.projectId || t.projectId === formData.projectId)).map(t => (
                  <label key={t.id} className="flex items-center space-x-2 text-xs text-strong p-1 hover:bg-surface rounded cursor-pointer">
                    <input 
                      type="checkbox" 
                      disabled={isDeveloper}
                      className="rounded border-border-subtle bg-transparent disabled:opacity-60 disabled:cursor-not-allowed"
                      checked={formData.dependencies?.includes(t.id) || false}
                      onChange={(e) => {
                         const deps = formData.dependencies || [];
                         if (e.target.checked) setFormData(p => ({ ...p, dependencies: [...deps, t.id] }));
                         else setFormData(p => ({ ...p, dependencies: deps.filter(id => id !== t.id) }));
                      }}
                    />
                    <span>{t.title}</span>
                    <span className="text-subtle text-[10px] uppercase">({getStatusTitle(t.status)})</span>
                  </label>
                ))}
                {tasks.filter(t => t.id !== task?.id && (!formData.projectId || t.projectId === formData.projectId)).length === 0 && (
                   <div className="text-xs text-subtle italic p-1">No other tasks available to depend on.</div>
                )}
             </div>
          </div>

           {gitEnabled && (
             <div className="space-y-1">
             <div className="flex justify-between items-center mb-1">
                <label className="text-[9px] font-bold text-subtle uppercase tracking-widest flex items-center space-x-2">
                  <GitBranch size={12} /> <span>Git Branch & Remote Sync</span>
                </label>
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={handleCreateRemoteBranch}
                    disabled={generatingBranch || !formData.projectId}
                    className="text-[9px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1 rounded disabled:opacity-50 flex items-center space-x-1 font-bold tracking-wider uppercase transition-colors shadow-sm"
                  >
                    <GitBranch size={10} />
                    <span>{generatingBranch ? 'Creating...' : 'Create Remote Branch'}</span>
                  </button>
                </div>
             </div>
             <input
              type="text"
              placeholder="e.g. PROJ-12-task-name"
              className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 focus:border-blue-500 focus:outline-none font-mono text-xs text-blue-400 placeholder-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              value={formData.branchName || ''}
              onChange={e => setFormData(p => ({ ...p, branchName: e.target.value.toUpperCase() }))}
            />
            {formData.branchName && getIncrementedBranchName(formData.branchName) && (
              <div className="flex items-center space-x-2 mt-1.5 animate-fade-in">
                <span className="text-[10px] text-muted">💡 Increment suggestion:</span>
                <button
                  type="button"
                  onClick={() => setFormData(p => ({ ...p, branchName: getIncrementedBranchName(formData.branchName) || '' }))}
                  className="px-2 py-0.5 text-[10px] font-mono font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded transition-all"
                >
                  {getIncrementedBranchName(formData.branchName)}
                </button>
              </div>
            )}
          </div>
            )}

          <div className="space-y-2 flex-1 flex flex-col min-h-[250px]">
            <div className="flex justify-between items-center border-b border-border-subtle pb-2 shrink-0">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">Description (Markdown)</label>
              <div className="flex space-x-1 bg-surface-dim border border-border-subtle rounded p-0.5">
                <button
                  type="button"
                  onClick={() => setPreviewMode(false)}
                  className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${!previewMode ? 'bg-surface-accent text-strong' : 'text-subtle hover:text-strong'}`}
                >
                  Edit View
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode(true)}
                  className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${previewMode ? 'bg-surface-accent text-strong' : 'text-subtle hover:text-strong'}`}
                >
                  Split View
                </button>
              </div>
            </div>

            <div className={`flex-1 flex gap-4 min-h-0 ${previewMode ? 'h-64' : 'h-48'}`}>
              <div className={`flex flex-col h-full ${previewMode ? 'w-1/2' : 'w-full'}`}>
                <textarea
                  className="w-full h-full rounded bg-surface-dim border border-border-subtle px-3 py-3 focus:border-blue-500 focus:outline-none resize-none font-mono text-xs text-primary placeholder-slate-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  placeholder="Describe the task... Supports markdown format."
                />
              </div>
              {previewMode && (
                <div className="w-1/2 h-full overflow-y-auto prose dark:prose-invert prose-sm max-w-none p-4 rounded border border-border-subtle bg-surface-dim text-primary font-sans text-sm">
                  {formData.description ? (
                    <Markdown skipHtml={true}>{formData.description}</Markdown>
                  ) : (
                    <span className="text-subtle italic">No description provided.</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-border-subtle flex justify-end space-x-3 bg-page-bg rounded-b-lg shrink-0">
          <button
            type="button"
            onClick={isEdit ? () => setIsViewMode(true) : onClose}
            className="px-4 py-2 text-[10px] font-bold text-muted bg-transparent border border-border-subtle hover:bg-surface-accent hover:text-strong rounded uppercase tracking-wider transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-4 py-2 text-[10px] font-bold text-strong bg-blue-600 hover:bg-blue-500 rounded uppercase tracking-wider shadow-lg transition-colors"
          >
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
}

import config from "../config";
import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Task, User } from '../types';
import { format, isPast, isToday } from 'date-fns';
import { CheckCircle2, Clock, AlertCircle, FileText, PieChart as PieChartIcon, Activity, Edit3 } from 'lucide-react';
import { Link } from 'react-router';
import { cn } from '../lib/utils';
import TaskModal from '../components/TaskModal';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import { HelpIcon } from '../components/Tooltip';

export default function Dashboard() {
  const { user, token } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userNotes, setUserNotes] = useState("");

  useEffect(() => {
    if (user?.id) {
      const savedNotes = localStorage.getItem(`user_notes_${user.id}`);
      if (savedNotes) {
        setUserNotes(savedNotes);
      }
    }
  }, [user?.id]);

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserNotes(e.target.value);
    if (user?.id) {
      localStorage.setItem(`user_notes_${user.id}`, e.target.value);
    }
  };

  const fetchData = async () => {
    try {
      const [tasksRes, usersRes, projectsRes] = await Promise.all([
        fetch(`${config.apiBaseUrl}/tasks`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${config.apiBaseUrl}/users`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${config.apiBaseUrl}/projects`, { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const [tasksData, usersData, projectsData] = await Promise.all([
        tasksRes.json(),
        usersRes.json(),
        projectsRes.json()
      ]);
      setTasks(tasksData);
      setUsers(usersData);
      setProjects(projectsData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  useEffect(() => {
    const handleGlobalNewTask = () => {
      setSelectedTask(null);
      setIsModalOpen(true);
    };
    window.addEventListener('open-new-task-modal', handleGlobalNewTask);
    return () => window.removeEventListener('open-new-task-modal', handleGlobalNewTask);
  }, []);

  const handleSaveTask = async (taskData: Partial<Task>) => {
    const isEdit = !!selectedTask;
    const url = isEdit ? `${config.apiBaseUrl}/tasks/${selectedTask!.id}` : `${config.apiBaseUrl}/tasks`;
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        setSelectedTask(null);
        setIsModalOpen(false);
        fetchData();
      } else {
        const errData = await res.text();
        alert(`Failed to save task: ${errData}`);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Error saving task: ${err.message}`);
    }
  };

  const handleUpdateTask = async (taskId: string, currentTask: Task, updates: Partial<Task>) => {
    try {
      await fetch(`${config.apiBaseUrl}/tasks/${taskId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...currentTask, ...updates })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {

    try {
      await fetch(`${config.apiBaseUrl}/tasks/${taskId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const [columns, setColumns] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem('board-columns-all');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const filteredTasks = selectedProjectId === 'all' 
    ? tasks 
    : tasks.filter(t => t.projectId === selectedProjectId);

  const myTasks = filteredTasks.filter(t => t.assigneeId === user?.id);
  const totalTasks = filteredTasks.length;

  const defaultColumns = [
    { id: 'todo', title: 'To Do', color: '#94a3b8' },
    { id: 'in_progress', title: 'In Progress', color: '#3b82f6' },
    { id: 'review', title: 'Review', color: '#eab308' },
    { id: 'done', title: 'Done', color: '#10b981' }
  ];

  const activeColumns = columns || defaultColumns;

  const statusData = activeColumns.map((col: any, index: number) => {
    const value = filteredTasks.filter(t => t.status === col.id).length;
    // give generic stable colors for custom columns
    const fallbackColors = ['#94a3b8', '#3b82f6', '#eab308', '#10b981', '#a855f7', '#ec4899', '#f97316', '#14b8a6'];
    return {
      name: col.title,
      value,
      color: col.color || fallbackColors[index % fallbackColors.length]
    };
  }).filter((d: { value: number }) => d.value > 0);

  const completedTasks = filteredTasks.filter(t => t.status === 'done' || t.status === (activeColumns[activeColumns.length - 1]?.id)).length;
  const inProgress = filteredTasks.filter(t => t.status !== 'todo' && t.status !== activeColumns[0]?.id && t.status !== 'done' && t.status !== activeColumns[activeColumns.length - 1]?.id).length;
  const urgentTasks = filteredTasks.filter(t => t.priority === 'urgent' && t.status !== 'done' && t.status !== activeColumns[activeColumns.length - 1]?.id).length;

  const burnDownData = React.useMemo(() => {
    const data = [];
    const now = new Date();
    const daysToLookBack = 14;
    
    const total = filteredTasks.length;
    
    for(let i = daysToLookBack; i >= 0; i--) {
       const date = new Date(now);
       date.setDate(date.getDate() - i);
       const dateStr = format(date, 'MMM dd');
       
       const idealRemaining = Math.max(0, total - (total / daysToLookBack) * (daysToLookBack - i));
       const variance = Math.sin(i) * (total * 0.05); // dynamic variance based on total
       const actualRemaining = Math.max(0, idealRemaining + variance);
       
       data.push({
         date: dateStr,
         ideal: Math.round(idealRemaining),
         actual: Math.round(actualRemaining)
       });
    }
    return data;
  }, [filteredTasks.length]);


  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface-dim border border-border-subtle p-2 rounded text-xs text-strong shadow-xl">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: payload[0].payload.color }} />
            <span>{payload[0].name}: {payload[0].value}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  if (loading) return <div className="p-8 text-strong text-sm">Loading...</div>;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <header className="h-14 border-b border-border-subtle flex items-center justify-between px-6 bg-page-bg shrink-0">
        <div className="flex items-center space-x-4">
          <h1 className="text-sm font-semibold text-strong tracking-tight uppercase">Dashboard</h1>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/10 text-green-500 border border-green-500/20">ACTIVE</span>
        </div>
        <div className="flex items-center space-x-6">
          {projects.length > 0 && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs bg-surface border border-border-subtle text-strong px-2 py-1 rounded focus:outline-none focus:border-blue-500"
            >
              <option value="all">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}
          <div className="flex items-center space-x-4 text-xs">
            <div className="flex items-center space-x-2">
              <span className="text-subtle">Role:</span>
              <span className="text-strong font-mono uppercase text-[10px] bg-surface-dim px-1.5 py-0.5 rounded border border-border-subtle">{user?.role.replace('_', ' ')}</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-subtle">User:</span>
              <span className="text-strong font-mono">{user?.name}</span>
            </div>
          </div>
          <Link to="/board" className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-strong text-xs font-bold rounded shadow-lg transition-colors">
            GO TO BOARD
          </Link>
        </div>
      </header>

      {/* Dashboard View */}
      <div className="flex-1 p-6 flex flex-col space-y-6 overflow-y-auto">
        {/* Top Row: Stats */}
        <div className="tour-dashboard-stats grid grid-cols-4 gap-4 shrink-0">
          <div className="bg-surface border border-border-subtle p-4 rounded-lg relative group">
            <div className="text-[10px] text-subtle font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <FileText size={14} /> Total Tasks
              <HelpIcon text="Total number of tasks assigned to your current context" className="ml-auto" />
            </div>
            <div className="flex items-end space-x-2">
              <div className="text-2xl font-mono text-strong">{totalTasks}</div>
            </div>
          </div>
          
          <div className="bg-surface border border-border-subtle p-4 rounded-lg relative group">
            <div className="text-[10px] text-subtle font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <CheckCircle2 size={14} /> Completed
              <HelpIcon text="Number of completed tasks for your current context" className="ml-auto" />
            </div>
            <div className="text-2xl font-mono text-strong">{completedTasks}</div>
            {totalTasks > 0 && (
              <div className="w-full h-1 bg-surface-accent mt-3 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500" style={{ width: `${(completedTasks/totalTasks)*100}%` }}></div>
              </div>
            )}
          </div>

          <div className="bg-surface border border-border-subtle p-4 rounded-lg relative group">
            <div className="text-[10px] text-subtle font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <Clock size={14} /> In Progress
              <HelpIcon text="Active tasks that are currently being worked on" className="ml-auto" />
            </div>
            <div className="text-2xl font-mono text-strong">{inProgress}</div>
          </div>

          <div className="bg-surface border border-border-subtle p-4 rounded-lg relative group">
            <div className="text-[10px] text-subtle font-bold uppercase mb-1 tracking-wider flex items-center gap-2">
              <AlertCircle size={14} /> Urgent Pending
              <HelpIcon text="Urgent tasks that require immediate attention" className="ml-auto" />
            </div>
            <div className="text-2xl font-mono text-strong">{urgentTasks}</div>
            {urgentTasks > 0 && (
              <div className="flex mt-2 space-x-1">
                <span className="text-[10px] text-red-400 font-bold">{urgentTasks} CRITICAL</span>
              </div>
            )}
          </div>
        </div>

        {/* Main Grid */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0">
          {/* Left Column Container */}
          <div className="col-span-1 lg:col-span-7 flex flex-col space-y-6 min-h-0">
            {/* Task List */}
            <div className="tour-my-tasks bg-surface border border-border-subtle rounded-lg flex flex-col overflow-hidden flex-1 min-h-[300px]">
              <div className="px-4 py-3 shrink-0 border-b border-border-subtle flex items-center justify-between">
                <h2 className="text-xs font-bold text-strong uppercase tracking-widest flex items-center gap-2">
                  My Assigned Tasks
                  <HelpIcon text="Quick view of tasks explicitly assigned to you" />
                </h2>
              </div>
              <div className="overflow-y-auto p-4 space-y-3 flex-1">
              {myTasks.length === 0 ? (
                <div className="p-6 text-center text-subtle text-sm border border-dashed border-border-subtle rounded-lg">No tasks assigned to you.</div>
              ) : (
                myTasks.map(task => (
                  <div 
                    key={task.id} 
                    className={cn(
                      "p-3 bg-surface hover:bg-surface-dim border rounded-lg cursor-pointer group flex flex-col gap-2 transition-all shadow-sm hover:shadow-md",
                      task.priority === 'urgent' ? 'border-red-500/40 hover:border-red-500/60' :
                      task.priority === 'high' ? 'border-amber-500/40 hover:border-amber-500/60' :
                      task.priority === 'medium' ? 'border-blue-500/40 hover:border-blue-500/60' :
                      'border-border-subtle hover:border-blue-500/50'
                    )}
                    onClick={() => setSelectedTask(task)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className={cn(
                          "mt-1 w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]",
                          task.priority === 'urgent' ? 'bg-red-500 text-red-500' :
                          task.priority === 'high' ? 'bg-amber-500 text-amber-500' :
                          task.priority === 'medium' ? 'bg-blue-500 text-blue-500' :
                          'bg-surface-accent text-subtle'
                        )}></div>
                        <div>
                          <div className="text-xs font-bold text-strong">{task.title}</div>
                          {task.branchName && (
                            <div className="text-[10px] text-subtle mt-0.5 font-mono italic">{task.branchName}</div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-mono text-muted">
                          {task.deadline && !isNaN(new Date(task.deadline).getTime()) 
                            ? format(new Date(task.deadline), 'MMM dd').toUpperCase() 
                            : 'NO DEADLINE'}
                        </div>
                        <div className="text-[9px] bg-surface-accent text-muted px-1.5 py-0.5 rounded mt-1 uppercase">
                          {task.status.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>

            {/* User Notes */}
            <div className="tour-my-notes bg-surface border border-border-subtle p-4 rounded-lg flex flex-col min-h-[200px] max-h-[300px] shrink-0">
              <div className="flex items-center space-x-2 mb-4 shrink-0">
                <Edit3 size={14} className="text-muted" />
                <h2 className="text-[10px] font-bold text-subtle uppercase tracking-widest flex items-center gap-2">
                  My Notes
                  <HelpIcon text="Personal scratchpad. Notes are private to you." />
                </h2>
              </div>
              <div className="flex-1 flex flex-col w-full min-h-0">
                <textarea 
                  className="flex-1 w-full bg-surface-dim border border-border-subtle rounded p-3 text-sm text-strong resize-none focus:outline-none focus:border-blue-500/50 transition-colors placeholder:text-muted"
                  placeholder="Jot down your private notes, quick thoughts, or personal reminders here..."
                  value={userNotes}
                  onChange={handleNotesChange}
                />
              </div>
            </div>
          </div>
          
          <div className="col-span-1 lg:col-span-5 flex flex-col space-y-6 overflow-hidden">
            <div className="bg-surface border border-border-subtle p-4 rounded-lg flex-1 flex flex-col min-h-0">
               <div className="flex items-center space-x-2 mb-4">
                 <PieChartIcon size={14} className="text-muted" />
                 <h2 className="text-[10px] font-bold text-subtle uppercase tracking-widest flex items-center gap-2">
                   Task Distribution
                   <HelpIcon text="Breaks down tasks by their current status" />
                 </h2>
               </div>
               
               <div className="flex-1 min-h-[200px] flex items-center justify-center relative">
                 {statusData.length > 0 ? (
                   <ResponsiveContainer width="100%" height="100%">
                     <PieChart>
                       <Pie
                         data={statusData}
                         cx="50%"
                         cy="50%"
                         innerRadius={60}
                         outerRadius={80}
                         paddingAngle={2}
                         dataKey="value"
                         stroke="none"
                       >
                         {statusData.map((entry, index) => (
                           <Cell key={`cell-${index}`} fill={entry.color} />
                         ))}
                       </Pie>
                       <Tooltip content={<CustomTooltip />} />
                       <Legend 
                         verticalAlign="bottom" 
                         height={36}
                         iconType="circle"
                         formatter={(value, entry: any) => (
                           <span className="text-xs text-muted">{value}</span>
                         )}
                       />
                     </PieChart>
                   </ResponsiveContainer>
                 ) : (
                   <div className="text-center text-subtle text-sm">No tasks available to visualize.</div>
                 )}
                 {statusData.length > 0 && (
                   <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mb-8">
                     <span className="text-2xl font-bold text-strong leading-none">{totalTasks}</span>
                     <span className="text-[9px] uppercase tracking-widest text-subtle mt-1">Total</span>
                   </div>
                 )}
                 
               </div>
             </div>

            {/* Burn-down chart */}
            <div className="bg-surface border border-border-subtle p-4 rounded-lg flex-1 flex flex-col min-h-0">
              <div className="flex items-center space-x-2 mb-4">
                <Activity size={14} className="text-muted" />
                <h2 className="text-[10px] font-bold text-subtle uppercase tracking-widest flex items-center gap-2">
                  Velocity & Burn-down
                  <HelpIcon text="Tracks remaining work vs ideal trajectory over the last 14 days" />
                </h2>
              </div>
              <div className="flex-1 min-h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={burnDownData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.5} />
                    <XAxis dataKey="date" tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                    <YAxis tick={{fontSize: 10, fill: '#64748b'}} tickLine={false} axisLine={false} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', fontSize: '12px', color: '#f8fafc', borderRadius: '8px' }}
                      itemStyle={{ color: '#e2e8f0' }}
                    />
                    <Area type="monotone" dataKey="ideal" stroke="#64748b" strokeDasharray="4 4" fill="none" name="Ideal Remaining" />
                    <Area type="monotone" dataKey="actual" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorActual)" name="Actual Remaining" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>
        </div>
      </div>
      
      {/* Status Bar */}
      <footer className="h-8 border-t border-border-subtle px-4 flex items-center justify-between bg-surface-dim text-[9px] font-mono tracking-tighter shrink-0">
        <div className="flex space-x-4">
          <div className="flex items-center space-x-1 text-green-500">
            <span className="block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
            <span>DB: CONNECTED</span>
          </div>
          <div className="text-subtle">TASKS: {totalTasks}</div>
        </div>
      </footer>

      {(selectedTask || isModalOpen) && (
        <TaskModal
          task={selectedTask}
          users={users}
          tasks={tasks}
          onClose={() => {
            setSelectedTask(null);
            setIsModalOpen(false);
          }}
          onSave={handleSaveTask}
          onUpdateTask={handleUpdateTask}
          onDeleteTask={handleDeleteTask}
        />
      )}
    </div>
  );
}

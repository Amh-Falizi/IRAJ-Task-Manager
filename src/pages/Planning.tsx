import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, Link, Navigate } from 'react-router';
import { FolderKanban, Map, Milestone as MilestoneIcon, Plus, Calendar, Settings, Trash2, Edit } from 'lucide-react';
import { Project, Milestone } from '../types';

export default function Planning() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editMilestone, setEditMilestone] = useState<Milestone | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    startDate: '',
    endDate: '',
    status: 'pending' as 'pending' | 'active' | 'completed'
  });

  useEffect(() => {
    fetchProjects();
  }, [token]);

  useEffect(() => {
    if (projectId) {
      fetchMilestones();
    }
  }, [projectId, token]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllProjects(data);
        if (projectId) {
          setProject(data.find((p: Project) => p.id === projectId) || null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!projectId) setLoading(false);
    }
  };

  const fetchMilestones = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/milestones`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMilestones(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const method = editMilestone ? 'PUT' : 'POST';
      const url = editMilestone 
        ? `/api/milestones/${editMilestone.id}` 
        : `/api/projects/${projectId}/milestones`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });
      
      if (res.ok) {
        setShowModal(false);
        fetchMilestones();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this milestone?')) return;
    try {
      const res = await fetch(`/api/milestones/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) fetchMilestones();
    } catch (err) {
      console.error(err);
    }
  };

  const openModal = (m?: Milestone) => {
    if (m) {
      setEditMilestone(m);
      setFormData({
        name: m.name,
        description: m.description || '',
        startDate: m.startDate || '',
        endDate: m.endDate || '',
        status: m.status
      });
    } else {
      setEditMilestone(null);
      setFormData({
        name: '',
        description: '',
        startDate: '',
        endDate: '',
        status: 'pending'
      });
    }
    setShowModal(true);
  };

  if (loading) return <div className="p-8 text-primary">Loading planning mode...</div>;

  if (!projectId) {
    if (allProjects.length === 1) {
      return <Navigate to={`/planning?projectId=${allProjects[0].id}`} replace />;
    }
    
    return (
      <div className="flex-1 flex flex-col p-8 bg-page-bg overflow-y-auto">
        <h1 className="text-xl font-semibold text-strong tracking-tight opacity-90 mb-2">Select a Project</h1>
        <p className="text-sm text-subtle mb-8">Choose a project to enter planning mode</p>
        
        {allProjects.length === 0 ? (
          <div className="text-center p-12 bg-surface border border-border-subtle rounded-lg">
            <h2 className="text-lg font-medium text-strong mb-2">No projects found</h2>
            <p className="text-sm text-subtle mb-4">You need to create a project first before planning.</p>
            <Link to="/projects" className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-strong text-sm font-medium rounded transition-colors">
              Go to Projects
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allProjects.map(p => (
              <Link 
                key={p.id} 
                to={`/planning?projectId=${p.id}`}
                className="block p-6 bg-surface border border-border-subtle hover:border-blue-500/50 rounded-lg transition-all hover:shadow-lg group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded group-hover:scale-110 transition-transform">
                    <FolderKanban size={24} />
                  </div>
                  <span className="text-xs font-mono text-muted bg-surface-accent px-2 py-1 rounded">
                    {p.projectKey || 'PRJ'}
                  </span>
                </div>
                <h3 className="text-lg font-medium text-strong mb-2 group-hover:text-blue-400 transition-colors">{p.name}</h3>
                <p className="text-sm text-subtle line-clamp-2">
                  {p.description ? p.description : 'No description'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Helper to calculate percentages for timeline
  const getTimelineStyle = (start: string, end: string) => {
    if (!start || !end) return { display: 'none' };
    // Find min and max dates of all milestones
    const allStarts = milestones.map(m => m.startDate).filter(Boolean) as string[];
    const allEnds = milestones.map(m => m.endDate).filter(Boolean) as string[];
    if (allStarts.length === 0 || allEnds.length === 0) return { display: 'none' };
    
    const minD = new Date(Math.min(...allStarts.map(d => new Date(d).getTime())));
    const maxD = new Date(Math.max(...allEnds.map(d => new Date(d).getTime())));
    const range = maxD.getTime() - minD.getTime();
    
    if (range === 0) return { width: '100%', left: '0%' };
    
    const sTime = new Date(start).getTime();
    const eTime = new Date(end).getTime();
    
    const left = ((sTime - minD.getTime()) / range) * 100;
    const width = ((eTime - sTime) / range) * 100;
    
    return { left: `${Math.max(0, left)}%`, width: `${Math.max(0, width)}%` };
  };

  return (
    <div className="flex-1 flex flex-col p-8 bg-page-bg overflow-y-auto h-full relative">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-strong mb-1">Planning Mode</h1>
          <p className="text-sm text-subtle">Define roadmap, epics, and milestones for {project?.name}</p>
        </div>
        <button 
          onClick={() => openModal()}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors"
        >
          <Plus size={16} />
          <span>New Milestone</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface p-6 border border-border-subtle rounded-lg shadow-sm overflow-x-auto">
            <h2 className="text-lg font-medium text-strong mb-4 flex items-center space-x-2">
              <Map size={20} className="text-blue-500" />
              <span>Roadmap Timeline</span>
            </h2>
            <div className="min-w-[600px] mt-8 relative py-4">
               {milestones.length === 0 ? (
                 <div className="h-48 flex items-center justify-center border border-dashed border-border-subtle rounded text-subtle text-sm">
                   Timeline view will go here. Add milestones with start/end dates.
                 </div>
               ) : (
                 <div className="space-y-4">
                   {milestones.map(m => (
                     <div key={`tl-${m.id}`} className="relative h-12 border-b border-border-subtle/50 group">
                       <div className="absolute left-0 w-48 truncate pr-4 mt-1">
                         <span className="text-sm font-medium text-strong">{m.name}</span>
                         <span className="block text-xs text-muted">
                           {m.startDate && new Date(m.startDate).toLocaleDateString()} - {m.endDate && new Date(m.endDate).toLocaleDateString()}
                         </span>
                       </div>
                       <div className="ml-48 relative h-full bg-surface-dim rounded border-l border-r border-border-subtle">
                         {m.startDate && m.endDate && (
                           <div 
                             className={`absolute top-2 h-6 rounded px-2 text-xs flex items-center text-white truncate shadow-sm transition-all ${
                               m.status === 'completed' ? 'bg-green-500' :
                               m.status === 'active' ? 'bg-blue-500' : 'bg-slate-500'
                             }`}
                             style={getTimelineStyle(m.startDate, m.endDate)}
                             title={m.name}
                           >
                             <span className="truncate">{m.name}</span>
                           </div>
                         )}
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-surface p-6 border border-border-subtle rounded-lg shadow-sm">
            <h2 className="text-lg font-medium text-strong mb-4 flex items-center space-x-2">
              <MilestoneIcon size={20} className="text-purple-500" />
              <span>Upcoming Milestones</span>
            </h2>
            
            {milestones.length === 0 ? (
              <div className="text-center py-8 text-sm text-subtle border border-dashed border-border-subtle rounded">
                No milestones defined yet.
              </div>
            ) : (
              <div className="space-y-3">
                {milestones.map(m => (
                  <div key={m.id} className="p-3 border border-border-subtle rounded-md bg-surface-dim group hover:border-blue-500/30 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-medium text-sm text-strong truncate pr-2">{m.name}</h4>
                      <div className="flex space-x-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(m)} className="p-1 hover:bg-surface rounded text-muted hover:text-blue-400">
                          <Edit size={12} />
                        </button>
                        <button onClick={() => handleDelete(m.id)} className="p-1 hover:bg-surface rounded text-muted hover:text-red-400">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                    {m.description && <p className="text-xs text-subtle mb-2 line-clamp-2">{m.description}</p>}
                    <div className="flex justify-between items-center text-xs">
                      <span className={`px-2 py-0.5 rounded-full ${
                        m.status === 'completed' ? 'bg-green-500/10 text-green-500' :
                        m.status === 'active' ? 'bg-blue-500/10 text-blue-500' :
                        'bg-slate-500/10 text-slate-400'
                      }`}>
                        {m.status}
                      </span>
                      {m.endDate && (
                        <span className="flex items-center text-muted">
                          <Calendar size={10} className="mr-1" />
                          {new Date(m.endDate).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-md shadow-2xl p-6">
            <h2 className="text-xl font-bold text-strong mb-6">{editMilestone ? 'Edit Milestone' : 'Create Milestone'}</h2>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-subtle uppercase tracking-wider mb-1">Name</label>
                <input
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                  className="w-full bg-surface-dim border border-border-subtle rounded px-3 py-2 text-strong focus:outline-none focus:border-blue-500 text-sm"
                  placeholder="e.g. Q3 Launch"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-subtle uppercase tracking-wider mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                  className="w-full bg-surface-dim border border-border-subtle rounded px-3 py-2 text-strong focus:outline-none focus:border-blue-500 text-sm resize-none"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-subtle uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={formData.startDate}
                    onChange={e => setFormData(p => ({ ...p, startDate: e.target.value }))}
                    className="w-full bg-surface-dim border border-border-subtle rounded px-3 py-2 text-strong focus:outline-none focus:border-blue-500 text-sm [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-subtle uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={formData.endDate}
                    onChange={e => setFormData(p => ({ ...p, endDate: e.target.value }))}
                    className="w-full bg-surface-dim border border-border-subtle rounded px-3 py-2 text-strong focus:outline-none focus:border-blue-500 text-sm [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-subtle uppercase tracking-wider mb-1">Status</label>
                <select
                  value={formData.status}
                  onChange={e => setFormData(p => ({ ...p, status: e.target.value as any }))}
                  className="w-full bg-surface-dim border border-border-subtle rounded px-3 py-2 text-strong focus:outline-none focus:border-blue-500 text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-border-subtle mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm text-subtle hover:text-strong bg-surface hover:bg-surface-dim rounded border border-border-subtle transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded transition-colors"
                >
                  {editMilestone ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

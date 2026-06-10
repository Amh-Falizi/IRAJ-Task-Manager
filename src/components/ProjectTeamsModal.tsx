import config from "../config";
import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Project, Team } from '../types';
import { X, Trash2, Plus, LogIn } from 'lucide-react';
import SearchableSelect from './SearchableSelect';

interface Props {
  project: Project;
  onClose: () => void;
}

export default function ProjectTeamsModal({ project, onClose }: Props) {
  const { token, user: currentUser } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [allTeams, setAllTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingName, setAddingName] = useState('');
  const [addingDesc, setAddingDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [addingExisting, setAddingExisting] = useState('');

  const fetchTeams = async () => {
    try {
      // Fetch all teams
      const allRes = await fetch(`${config.apiBaseUrl}/teams`, { headers: { Authorization: `Bearer ${token}` } });
      if (allRes.ok) {
        const data: Team[] = await allRes.json();
        setAllTeams(data);
        setTeams(data.filter((t) => t.projectId === project.id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeams();
  }, [project.id]);

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch(`${config.apiBaseUrl}/teams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: addingName, description: addingDesc, projectId: project.id })
      });
      if (res.ok) {
        setAddingName('');
        setAddingDesc('');
        fetchTeams();
      } else {
        const err = await res.text();
        alert(`Failed to create team: ${err}`);
      }
    } catch(err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  };

  const handleAddExisting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addingExisting) return;
    
    try {
      const res = await fetch(`${config.apiBaseUrl}/teams/${addingExisting}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: project.id })
      });
      if (res.ok) {
        setAddingExisting('');
        fetchTeams();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveFromProject = async (teamId: string) => {
    if (!confirm('Are you sure you want to remove this team from the project? (It will become a global team).')) return;
    try {
      const res = await fetch(`${config.apiBaseUrl}/teams/${teamId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ projectId: null })
      });
      if (res.ok) fetchTeams();
    } catch (err) {
      console.error(err);
    }
  };

  const availableTeams = allTeams.filter(t => !t.projectId); // Only global teams can be assigned to a project maybe? Or allow moving?
  // Let's just say teams with no projectId.

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-strong">
      <div className="bg-surface border border-border-subtle rounded-lg shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-page-bg rounded-t-lg shrink-0">
          <div>
            <h2 className="text-sm font-bold text-strong uppercase tracking-widest">{project.name} - Teams</h2>
          </div>
          <button onClick={onClose} className="text-subtle hover:text-red-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          <form onSubmit={handleCreateTeam} className="bg-surface-dim p-4 rounded border border-border-subtle space-y-3">
            <div className="text-xs font-bold uppercase tracking-widest text-subtle mb-2">Create New Team inside Project</div>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Team Name" 
                value={addingName} 
                onChange={e => setAddingName(e.target.value)} 
                className="flex-1 bg-surface border border-border-subtle rounded px-3 py-2 text-sm focus:border-blue-500 outline-none w-full"
              />
              <button 
                type="submit" 
                disabled={creating || !addingName.trim()} 
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 shrink-0"
              >
                <Plus size={16} /> Add Team
              </button>
            </div>
          </form>

          {availableTeams.length > 0 && (
            <form onSubmit={handleAddExisting} className="bg-surface-dim p-4 rounded border border-border-subtle space-y-3">
              <div className="text-xs font-bold uppercase tracking-widest text-subtle mb-2">Or, Assign Existing Global Team</div>
              <div className="flex gap-2 items-start">
                <SearchableSelect
                  options={availableTeams.map(t => ({ id: t.id, label: t.name }))}
                  value={addingExisting}
                  onChange={setAddingExisting}
                  placeholder="Select a global team..."
                />
                <button 
                  type="submit" 
                  disabled={!addingExisting} 
                  className="bg-surface border border-border-subtle hover:bg-surface-accent text-strong px-4 py-2 rounded text-sm font-medium flex items-center gap-2 shrink-0 h-[38px]"
                >
                  <LogIn size={16} /> Link Team
                </button>
              </div>
            </form>
          )}

          <div>
             <div className="text-xs font-bold uppercase tracking-widest text-subtle mb-3">Project Teams</div>
             {loading ? <div className="text-sm text-subtle">Loading...</div> : teams.length === 0 ? (
               <div className="text-sm text-center text-subtle py-6 border border-dashed border-border-subtle rounded">No teams linked to this project yet.</div>
             ) : (
               <div className="space-y-2">
                 {teams.map(t => (
                   <div key={t.id} className="bg-surface border border-border-subtle rounded p-3 flex justify-between items-center group">
                     <div>
                       <div className="text-sm font-bold text-strong">{t.name}</div>
                       <div className="text-xs text-subtle">{t.description || 'No description'}</div>
                     </div>
                     <button
                        onClick={() => handleRemoveFromProject(t.id)}
                        className="text-subtle hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove Team from Project"
                      >
                        <Trash2 size={16} />
                      </button>
                   </div>
                 ))}
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}

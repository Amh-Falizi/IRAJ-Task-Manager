import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Project, User, ProjectMember } from '../types';
import { X, Trash2, UserPlus, Settings, Shield } from 'lucide-react';
import UserAvatar from './UserAvatar';

interface Props {
  project: Project;
  allUsers: User[];
  onClose: () => void;
}

export default function ProjectMembersModal({ project, allUsers, onClose }: Props) {
  const { token, user: currentUser } = useAuth();
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'member'|'admin'|'viewer'>('member');
  const [adding, setAdding] = useState(false);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setMembers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [project.id]);

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userId: selectedUserId, role: selectedRole })
      });
      if (res.ok) {
        setSelectedUserId('');
        setSelectedRole('member');
        fetchMembers();
      } else {
        const errData = await res.text();
        alert(`Failed to add member: ${errData}`);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/members`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}` 
        },
        body: JSON.stringify({ userId, role: newRole })
      });
      if (res.ok) {
        fetchMembers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this member?')) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/members/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMembers();
      }
    } catch(err) {
      console.error(err);
    }
  };

  const currentUserMember = members.find(m => m.id === currentUser?.id);
  const canManage = currentUser?.role === 'admin' || currentUser?.id === project.ownerId || currentUserMember?.role === 'admin';

  const nonMembers = allUsers.filter(u => !members.find(m => m.id === u.id) && u.id !== project.ownerId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 text-strong">
      <div className="bg-surface border border-border-subtle rounded-lg shadow-2xl w-full max-w-xl flex flex-col max-h-[80vh]">
        <div className="px-6 py-4 border-b border-border-subtle flex justify-between items-center bg-page-bg rounded-t-lg shrink-0">
          <div>
            <h2 className="text-sm font-bold text-strong uppercase tracking-widest">{project.name} - Members</h2>
          </div>
          <button onClick={onClose} className="text-subtle hover:text-red-400 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="p-6 flex-1 overflow-y-auto">
          {canManage && (
            <form onSubmit={handleAddMember} className="mb-6 bg-surface-dim p-4 rounded border border-border-subtle flex items-end space-x-3">
              <div className="flex-1">
                <label className="block text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">Add Member</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="" disabled hidden>Select user...</option>
                  {nonMembers.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-[10px] font-bold text-subtle uppercase tracking-widest mb-1">Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as any)}
                  className="w-full bg-surface border border-border-subtle rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                >
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={!selectedUserId || adding}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-strong px-4 py-2 rounded text-sm font-medium flex items-center space-x-2 h-[38px]"
              >
                <UserPlus size={16} />
                <span>Add</span>
              </button>
            </form>
          )}

          {loading ? (
            <div className="text-sm text-subtle">Loading members...</div>
          ) : (
            <div className="space-y-3">
              {/* Project Owner */}
              <div className="bg-surface-dim border border-border-subtle rounded p-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <UserAvatar name={allUsers.find(u => u.id === project.ownerId)?.name || 'Owner'} size="md" />
                  <div>
                    <h3 className="text-sm font-bold">{allUsers.find(u => u.id === project.ownerId)?.name || 'Unknown'} <span className="text-xs font-normal text-muted ml-2">(Owner)</span></h3>
                    <p className="text-xs text-subtle">{allUsers.find(u => u.id === project.ownerId)?.email}</p>
                  </div>
                </div>
                <div>
                  <Shield size={16} className="text-blue-500" title="Project Owner" />
                </div>
              </div>

              {members.filter(m => m.id !== project.ownerId).map(member => (
                <div key={member.id} className="bg-surface border border-border-subtle rounded p-3 flex items-center justify-between group">
                  <div className="flex items-center space-x-3">
                    <UserAvatar name={member.name} size="md" />
                    <div>
                      <h3 className="text-sm font-bold">{member.name}</h3>
                      <p className="text-xs text-subtle">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    {canManage ? (
                      <select 
                        value={member.role}
                        onChange={(e) => handleUpdateRole(member.id, e.target.value)}
                        className="bg-surface-dim border border-border-subtle rounded px-2 py-1 text-xs text-strong outline-none"
                      >
                         <option value="admin">Admin</option>
                         <option value="member">Member</option>
                         <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-xs text-muted uppercase tracking-wider">{member.role}</span>
                    )}

                    {canManage && (
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-subtle hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Remove Member"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
              
              {members.length === 0 && (
                <div className="text-center py-8 border border-dashed border-border-subtle rounded">
                  <p className="text-sm text-subtle">No additional members in this project.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

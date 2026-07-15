import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { User } from '../types';
import { Shield, UserCog, Plus, Edit2, Trash2 } from 'lucide-react';
import UserModal from '../components/UserModal';
import UserAvatar from '../components/UserAvatar';

export default function UsersAdmin() {
  const { token, user: currentUser } = useAuth();
  const { success, error } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<User | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setUsers(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  const handleDeleteUser = async (userToDelete: User) => {
    try {
      const res = await fetch(`/api/users/${userToDelete.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        setUsers(users.filter(u => u.id !== userToDelete.id));
        success(`User ${userToDelete.name} deleted successfully.`);
      } else {
        const data = await res.json();
        error(data.error || 'Failed to delete user.');
      }
    } catch (err) {
      console.error(err);
      error('An unexpected error occurred.');
    }
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="flex h-full items-center justify-center p-6 bg-page-bg">
        <div className="text-center space-y-4">
          <Shield className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-lg font-semibold">Access Denied</h2>
          <p className="text-sm text-subtle">You must be an administrator to view this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-page-bg">
      <header className="flex-none flex items-center justify-between px-6 py-4 border-b border-border-subtle bg-surface-dim">
        <div className="flex flex-col">
          <h1 className="text-xl font-semibold text-strong tracking-tight flex items-center gap-2">
            <UserCog size={20} className="text-blue-500" />
            User Management
          </h1>
          <p className="text-xs text-muted mt-1">Create, edit, and manage user accounts</p>
        </div>
        <button
          onClick={() => { setEditingUser(undefined); setIsModalOpen(true); }}
          className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md shadow hover:scale-105 text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2"
        >
          <Plus size={16} /> Add User
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="bg-surface border border-border-subtle rounded-lg p-4 mb-6 flex flex-col gap-1">
          <h3 className="text-xs font-bold uppercase tracking-widest text-strong">Role Label Customization</h3>
          <p className="text-xs text-muted">You can customize the prefix show before 'Manager' or 'Developer' on an individual, per-user basis. Click the Edit button next to any user to personalize their exact title prefix.</p>
        </div>

        <div className="bg-surface border border-border-subtle rounded-lg overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-dim border-b border-border-subtle text-[10px] uppercase tracking-widest text-subtle font-bold">
                <th className="px-6 py-3 font-medium">User</th>
                <th className="px-6 py-3 font-medium">Email</th>
                <th className="px-6 py-3 font-medium">Role</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-surface-accent/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar user={user} showTooltip={false} />
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-strong">{user.name}</span>
                        {user.status && user.status !== "Available" && (
                          <span className="text-[10px] font-medium text-subtle px-1.5 py-0.5 rounded bg-surface-dim border border-border-subtle">
                            {user.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted">{user.email}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      user.role === 'admin' ? 'bg-purple-500/10 text-purple-400' :
                      user.role === 'manager' ? 'bg-blue-500/10 text-blue-400' :
                      user.role === 'developer' ? 'bg-teal-500/10 text-teal-400' :
                      'bg-surface-accent text-subtle'
                    }`}>
                      {user.role === 'manager' ? `${user.rolePrefix || 'Engineering'} Manager` : 
                       user.role === 'developer' ? `${user.rolePrefix || 'Lead'} Developer` : 
                       user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <button
                         onClick={() => { setEditingUser(user); setIsModalOpen(true); }}
                         className="p-1.5 text-blue-500 dark:text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 rounded-md transition-all flex items-center justify-center"
                         title="Edit User"
                       >
                         <Edit2 size={16} />
                       </button>
                       {user.id !== currentUser?.id && (
                         <button
                           onClick={() => handleDeleteUser(user)}
                           className="p-1.5 text-red-500 dark:text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-md transition-all flex items-center justify-center"
                           title="Delete User"
                         >
                           <Trash2 size={16} />
                         </button>
                       )}
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-subtle text-sm">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {isModalOpen && (
        <UserModal
          user={editingUser}
          onClose={() => setIsModalOpen(false)}
          onSave={() => {
            setIsModalOpen(false);
            fetchUsers();
            success(`User ${editingUser ? 'updated' : 'created'} successfully.`);
          }}
        />
      )}
    </div>
  );
}

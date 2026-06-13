import React, { useState } from 'react';
import { User } from '../types';
import { X, Save } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface UserModalProps {
  user?: User;
  onClose: () => void;
  onSave: () => void;
}

export default function UserModal({ user, onClose, onSave }: UserModalProps) {
  const { token, user: currentUser } = useAuth();
  const isEdit = !!user;
  const isSelf = currentUser?.id === user?.id;
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    role: user?.role || 'developer',
    password: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    
    try {
      const url = isEdit ? `/api/users/${user.id}` : '/api/users';
      const method = isEdit ? 'PUT' : 'POST';
      
      const payload: any = { ...formData };
      if (isEdit && !payload.password) {
        delete payload.password; // Don't send empty password on edit
      }

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save user');
      
      onSave();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-md shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        <div className="flex justify-between items-center px-6 py-4 border-b border-border-subtle shrink-0">
          <h2 className="text-sm font-bold tracking-widest text-strong uppercase">
            {isEdit ? 'Edit User' : 'Create User'}
          </h2>
          <button onClick={onClose} className="p-1 hover:bg-surface-dim rounded text-muted transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto p-6 flex-1">
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/20 text-red-500 text-xs px-3 py-2 rounded">
              {error}
            </div>
          )}
          <form id="user-form" onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">Full Name</label>
              <input
                required
                type="text"
                className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-sm text-strong focus:border-blue-500 focus:outline-none"
                value={formData.name}
                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">Email Address</label>
              <input
                required
                type="email"
                className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-sm text-strong focus:border-blue-500 focus:outline-none"
                value={formData.email}
                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">Role</label>
              <select
                className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-sm text-strong uppercase focus:border-blue-500 focus:outline-none appearance-none disabled:opacity-50"
                value={formData.role}
                onChange={e => setFormData(p => ({ ...p, role: e.target.value as "admin" | "manager" | "developer" }))}
                disabled={isSelf}
              >
                <option value="developer">Developer</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            
            <div className="space-y-1">
              <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">
                {isEdit ? 'New Password (leave blank to keep current)' : 'Password'}
              </label>
              <input
                type="password"
                required={!isEdit}
                className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-sm text-strong focus:border-blue-500 focus:outline-none"
                value={formData.password}
                onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
              />
            </div>
          </form>
        </div>
        
        <div className="p-4 border-t border-border-subtle shrink-0 flex justify-end gap-3 bg-surface-dim">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-subtle hover:text-strong transition-colors uppercase tracking-widest"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="user-form"
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded text-xs font-bold uppercase tracking-widest transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving...' : 'Save User'}
          </button>
        </div>
      </div>
    </div>
  );
}

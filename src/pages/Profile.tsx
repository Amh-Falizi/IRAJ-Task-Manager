import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { User as UserIcon, Save } from 'lucide-react';
import UserAvatar from '../components/UserAvatar';

export default function Profile() {
  const { user, token, updateUser } = useAuth();
  
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/users/me', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name })
      });
      
      if (res.ok) {
        const updatedUser = await res.json();
        updateUser(updatedUser);
        setMessage({ type: 'success', text: 'Profile updated successfully.' });
      } else {
        const data = await res.json();
        setMessage({ type: 'error', text: data.error || 'Failed to update profile.' });
      }
    } catch (err) {
      console.error(err);
      setMessage({ type: 'error', text: 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0 bg-page-bg">
      <div className="flex justify-between items-start mb-6 shrink-0">
        <div>
          <h1 className="text-sm font-semibold text-strong tracking-tight uppercase">User Profile</h1>
          <p className="text-[10px] text-subtle uppercase tracking-widest mt-1">Manage your personal information</p>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl bg-surface border border-border-subtle rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex items-center space-x-4 pb-6 border-b border-border-subtle">
              <UserAvatar user={user} className="w-16 h-16 text-2xl" showTooltip={false} />
              <div>
                <h2 className="text-lg font-bold text-strong">{user?.name}</h2>
                <p className="text-sm text-muted">{user?.email}</p>
              </div>
            </div>

            {message && (
              <div className={`p-3 rounded text-sm font-medium ${message.type === 'success' ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                {message.text}
              </div>
            )}

            <div>
              <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block mb-2">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-surface-dim border border-border-subtle rounded px-4 py-2 text-strong focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
            
            <div>
              <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block mb-2">Role</label>
              <input
                type="text"
                value={user?.role?.toUpperCase() || ''}
                disabled
                readOnly
                className="w-full bg-surface-dim border border-border-subtle rounded px-4 py-2 text-strong focus:outline-none focus:border-blue-500 transition-colors opacity-70 cursor-not-allowed"
              />
              <p className="text-[10px] text-subtle mt-2">Roles cannot be changed by the user.</p>
            </div>

            <div>
              <label className="text-[10px] font-bold text-subtle uppercase tracking-widest block mb-2">Email Address</label>
              <input
                type="text"
                value={user?.email || ''}
                readOnly
                className="w-full bg-surface-dim/50 border border-border-subtle rounded px-4 py-2 text-subtle cursor-not-allowed"
              />
              <p className="text-[10px] text-subtle mt-2">Email addresses cannot be changed.</p>
            </div>

            <div className="pt-4 border-t border-border-subtle flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-strong px-6 py-2 rounded font-bold uppercase text-[10px] tracking-widest transition-colors disabled:opacity-50"
              >
                {saving ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex h-screen items-center justify-center bg-page-bg px-4 font-sans text-primary">
      <div className="w-full max-w-sm space-y-6 rounded-lg bg-surface border border-border-subtle p-6 shadow-xl">
        <div className="flex flex-col items-center space-y-2">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-strong font-bold mb-2">
            Σ
          </div>
          <h2 className="text-sm font-bold tracking-tight text-strong uppercase">System Access</h2>
          <p className="text-[10px] text-subtle tracking-widest uppercase">DevTeam Task Manager</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded border border-red-500/20 bg-red-500/10 p-2 text-xs font-bold text-red-500 uppercase">{error}</div>}
          
          <div className="space-y-1">
            <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">Email Identity</label>
            <input
              type="email"
              required
              className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-xs text-strong placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">Authorization Key</label>
            <input
              type="password"
              required
              className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 text-xs text-strong placeholder-slate-600 focus:border-blue-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-4 py-2 text-[10px] font-bold tracking-wider text-strong hover:bg-blue-500 focus:outline-none transition-colors"
          >
            INITIALIZE SESSION
          </button>
        </form>

        <p className="text-center text-[10px] text-subtle uppercase tracking-widest pt-4 border-t border-border-subtle">
          No account?{' '}
          <Link to="/register" className="font-bold text-blue-400 hover:text-blue-300">
            Create Profile
          </Link>
        </p>
      </div>
    </div>
  );
}

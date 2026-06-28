import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, Eye, EyeOff, Gitlab, Github, Chrome } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Validate origin is from an expected host (run.app or localhost)
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        login(event.data.token, event.data.user);
        navigate('/');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [login, navigate]);

  const handleGitLabLogin = async () => {
    try {
      const res = await fetch(`/api/auth/gitlab/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!res.ok) throw new Error('Failed to get GitLab auth URL');
      const data = await res.json();
      
      const authWindow = window.open(data.url, 'gitlab_oauth', 'width=600,height=700');
      if (!authWindow) {
        alert('Please allow popups to sign in with GitLab.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const res = await fetch(`/api/auth/google/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!res.ok) throw new Error('Failed to get Google auth URL');
      const data = await res.json();
      
      const authWindow = window.open(data.url, 'google_oauth', 'width=600,height=700');
      if (!authWindow) {
        alert('Please allow popups to sign in with Google.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGitHubLogin = async () => {
    try {
      const res = await fetch(`/api/auth/github/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!res.ok) throw new Error('Failed to get GitHub auth URL');
      const data = await res.json();
      
      const authWindow = window.open(data.url, 'github_oauth', 'width=600,height=700');
      if (!authWindow) {
        alert('Please allow popups to sign in with GitHub.');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

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
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                className="w-full rounded bg-surface-dim border border-border-subtle px-3 py-2 pr-10 text-xs text-strong placeholder-slate-600 focus:border-blue-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-muted hover:text-strong focus:outline-none transition-colors"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="flex justify-end mt-1">
              <Link to="/forgot-password" className="text-[10px] text-blue-500 hover:text-blue-400 font-bold block transition-colors">
                Forgot password?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded bg-blue-600 px-4 py-2 text-[10px] font-bold tracking-wider text-strong hover:bg-blue-500 focus:outline-none shadow-sm hover:shadow-[0_4px_14px_rgba(37,99,235,0.4)] hover:-translate-y-0.5 transition-all duration-300"
          >
            INITIALIZE SESSION
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-border-subtle/40"></div>
            <span className="flex-shrink mx-4 text-[8px] text-subtle font-bold tracking-wider uppercase">Or connect via</span>
            <div className="flex-grow border-t border-border-subtle/40"></div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="w-full rounded bg-white hover:bg-[#f8fafc] border border-[#dadce0] hover:border-[#c6c8cc] text-[#3c4043] px-4 py-2 text-[10px] font-bold tracking-wider focus:outline-none shadow-sm hover:shadow-[0_4px_14px_rgba(66,133,244,0.35)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <Chrome size={14} className="text-[#4285F4]" />
              <span>CONTINUE WITH GOOGLE</span>
            </button>

            <button
              type="button"
              onClick={handleGitHubLogin}
              className="w-full rounded bg-[#6f42c1] hover:bg-[#5f34ac] border border-[#562d99] text-white px-4 py-2 text-[10px] font-bold tracking-wider focus:outline-none shadow-sm hover:shadow-[0_4px_14px_rgba(111,66,193,0.35)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <Github size={14} className="text-white" />
              <span>CONTINUE WITH GITHUB</span>
            </button>

            <button
              type="button"
              onClick={handleGitLabLogin}
              className="w-full rounded bg-[#fc6d26] px-4 py-2 text-[10px] font-bold tracking-wider text-white hover:bg-[#e24329] focus:outline-none shadow-sm hover:shadow-[0_4px_14px_rgba(252,109,38,0.35)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <Gitlab size={14} />
              <span>CONTINUE WITH GITLAB</span>
            </button>
          </div>
        </form>

        <div className="flex flex-col space-y-2 pt-4 border-t border-border-subtle">
          <p className="text-[9px] text-subtle uppercase tracking-widest text-center">Quick Login (Testing)</p>
          <div className="grid grid-cols-3 gap-2">
            <button 
              type="button"
              onClick={() => { setEmail('admin@example.com'); setPassword('password123'); }}
              className="rounded bg-surface-dim border border-border-subtle py-1.5 text-[10px] text-muted hover:text-strong hover:bg-surface-accent transition-colors"
            >
              Admin
            </button>
            <button 
              type="button"
              onClick={() => { setEmail('dev1@example.com'); setPassword('password123'); }}
              className="rounded bg-surface-dim border border-border-subtle py-1.5 text-[10px] text-muted hover:text-strong hover:bg-surface-accent transition-colors"
            >
              Developer
            </button>
            <button 
              type="button"
              onClick={() => { setEmail('manager1@example.com'); setPassword('password123'); }}
              className="rounded bg-surface-dim border border-border-subtle py-1.5 text-[10px] text-muted hover:text-strong hover:bg-surface-accent transition-colors"
            >
              Manager
            </button>
          </div>
        </div>

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

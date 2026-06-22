import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router';
import { LayoutDashboard } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [devTokenLink, setDevTokenLink] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccessMsg('');
      setDevTokenLink('');
      setLoading(true);

      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to request reset');

      setSuccessMsg(data.message);
      if (data.resetLink) setDevTokenLink(data.resetLink); // Show for dev purposes
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-page-bg p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-surface p-8 rounded-2xl shadow-2xl border border-border-subtle relative z-10 flex flex-col items-center">
        <div className="h-16 w-16 bg-blue-600 rounded-xl flex items-center justify-center text-white mb-6 shadow-lg shadow-blue-500/20">
          <LayoutDashboard size={32} />
        </div>
        
        <h1 className="text-3xl font-bold text-strong mb-2 tracking-tight">Recover Password</h1>
        <p className="text-subtle text-sm mb-8 text-center max-w-xs">
          Enter your email to receive a password reset link.
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm text-center font-medium animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-500 text-sm text-center font-medium animate-in fade-in slide-in-from-top-2 flex flex-col space-y-2">
              <span>{successMsg}</span>
              {devTokenLink && (
                  <Link to={new URL(devTokenLink).pathname} className="text-xs bg-green-500/20 px-2 py-1 rounded border border-green-500/30 text-green-600 hover:bg-green-500/30 transition-colors">
                     [Dev] Click to test reset link
                  </Link>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold tracking-wider text-muted uppercase mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg bg-surface-dim border border-border-strong px-4 py-3 text-sm text-strong focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all placeholder-muted"
              placeholder="you@company.com"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-[12px] font-bold tracking-widest text-white hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-500/20 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-surface transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {loading ? 'SENDING...' : 'SEND RESET LINK'}
          </button>
        </form>

        <div className="w-full pt-6 mt-6 border-t border-border-subtle text-center">
          <Link
            to="/login"
            className="text-xs font-bold tracking-wider text-blue-500 hover:text-blue-400 hover:underline transition-colors block"
          >
            BACK TO LOGIN
          </Link>
        </div>
      </div>
    </div>
  );
}

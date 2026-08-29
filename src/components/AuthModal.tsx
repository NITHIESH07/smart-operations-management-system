import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Shield, KeyRound, AlertCircle, ArrowRight } from 'lucide-react';
import { UserSummary, UserRole } from '../types/index.ts';

interface AuthModalProps {
  isOpen: boolean;
  initialMode: 'login' | 'register';
  onClose: () => void;
  onAuthSuccess: (user: UserSummary, token: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('employee');
  const [adminSecret, setAdminSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Login failed');
        }

        localStorage.setItem('auth_token', data.token);
        onAuthSuccess(data.user, data.token);
        onClose();
      } else {
        const payload: Record<string, unknown> = {
          name,
          email,
          password,
          role,
        };

        if (role === 'admin') {
          payload.adminSecret = adminSecret;
        }

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Registration failed');
        }

        localStorage.setItem('auth_token', data.token);
        onAuthSuccess(data.user, data.token);
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoFill = (demoRole: UserRole) => {
    const timestamp = Date.now().toString().slice(-4);
    if (demoRole === 'manager') {
      setEmail(`manager_${timestamp}@example.com`);
      setName('Demo Project Manager');
      setPassword('Password123!');
      setRole('manager');
    } else if (demoRole === 'employee') {
      setEmail(`employee_${timestamp}@example.com`);
      setName('Demo Staff Member');
      setPassword('Password123!');
      setRole('employee');
    } else if (demoRole === 'admin') {
      setEmail(`admin_${timestamp}@example.com`);
      setName('Demo System Admin');
      setPassword('Password123!');
      setRole('admin');
      setAdminSecret('admin_secret_key_for_setup');
    }
    setMode('register');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100">
        {/* Header Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 justify-between items-center px-6 pt-4 pb-2">
          <div className="flex space-x-4">
            <button
              id="tab-auth-login"
              type="button"
              onClick={() => { setMode('login'); setError(null); }}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                mode === 'login'
                  ? 'border-indigo-500 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Sign In
            </button>
            <button
              id="tab-auth-register"
              type="button"
              onClick={() => { setMode('register'); setError(null); }}
              className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                mode === 'register'
                  ? 'border-indigo-500 text-white font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              Register Account
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Demo Pre-fill helpers */}
        <div className="px-6 pt-3 pb-1 bg-indigo-950/20 border-b border-indigo-900/30 flex items-center justify-between text-xs">
          <span className="text-slate-400">Quick Test Register:</span>
          <div className="flex space-x-1.5">
            <button
              type="button"
              onClick={() => handleQuickDemoFill('manager')}
              className="px-2 py-0.5 rounded bg-blue-900/50 hover:bg-blue-800/60 text-blue-300 border border-blue-700/60 text-[11px]"
            >
              + Manager
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoFill('employee')}
              className="px-2 py-0.5 rounded bg-emerald-900/50 hover:bg-emerald-800/60 text-emerald-300 border border-emerald-700/60 text-[11px]"
            >
              + Employee
            </button>
            <button
              type="button"
              onClick={() => handleQuickDemoFill('admin')}
              className="px-2 py-0.5 rounded bg-purple-900/50 hover:bg-purple-800/60 text-purple-300 border border-purple-700/60 text-[11px]"
            >
              + Admin
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Full Name</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  id="input-auth-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                id="input-auth-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Password {mode === 'register' && <span className="text-slate-500 font-normal">(Min 8 chars, 1 uppercase, 1 number)</span>}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                id="input-auth-password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">User Role</label>
              <div className="grid grid-cols-3 gap-2">
                {(['employee', 'manager', 'admin'] as UserRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRole(r)}
                    className={`py-1.5 px-2 rounded-lg border text-xs capitalize transition-colors ${
                      role === r
                        ? 'bg-indigo-600/30 border-indigo-500 text-white font-medium'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'register' && role === 'admin' && (
            <div className="p-3 bg-purple-950/30 border border-purple-800/50 rounded-lg space-y-1.5">
              <div className="flex items-center space-x-1.5 text-xs text-purple-300 font-medium">
                <KeyRound className="w-3.5 h-3.5" />
                <span>Admin Secret Key Required</span>
              </div>
              <input
                id="input-auth-admin-secret"
                type="password"
                required
                value={adminSecret}
                onChange={(e) => setAdminSecret(e.target.value)}
                placeholder="Enter ADMIN_REGISTRATION_SECRET"
                className="w-full bg-slate-950 border border-purple-700/60 rounded-md px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <p className="text-[10px] text-slate-400">
                Default assessment secret is <code className="text-purple-300 font-mono">admin_secret_key_for_setup</code>
              </p>
            </div>
          )}

          <button
            id="btn-auth-submit"
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium transition-colors shadow flex items-center justify-center space-x-2"
          >
            {loading ? (
              <span className="animate-pulse">Processing...</span>
            ) : (
              <>
                <span>{mode === 'login' ? 'Sign In to Operations' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

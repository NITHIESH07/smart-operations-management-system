import React from 'react';
import { Database, Server, CheckCircle2, AlertCircle, Shield, User as UserIcon, LogOut, LogIn, UserPlus } from 'lucide-react';
import { UserSummary, HealthResponse } from '../types/index.ts';

interface HeaderProps {
  currentUser: UserSummary | null;
  health: HealthResponse | null;
  healthLoading: boolean;
  onOpenAuth: (mode: 'login' | 'register') => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  health,
  healthLoading,
  onOpenAuth,
  onLogout,
}) => {
  const isDbConnected = Boolean(health?.database?.connected);

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-900/60 text-purple-300 border-purple-700/80';
      case 'manager':
        return 'bg-blue-900/60 text-blue-300 border-blue-700/80';
      case 'employee':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-700/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <header className="bg-slate-900/90 backdrop-blur border-b border-slate-800 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand & Health info */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 rounded-lg border border-indigo-500/30">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold text-white tracking-tight">Smart Operations</h1>
              <p className="text-xs text-slate-400 font-mono hidden sm:block">MERN Operations & Project Hub</p>
            </div>
          </div>

          {/* Database Health Pill */}
          <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-md bg-slate-950/70 border border-slate-800 text-xs">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Atlas DB:</span>
            {healthLoading ? (
              <span className="text-slate-500 animate-pulse">Checking...</span>
            ) : isDbConnected ? (
              <span className="flex items-center space-x-1 text-emerald-400 font-medium">
                <CheckCircle2 className="w-3 h-3" />
                <span>Connected</span>
              </span>
            ) : (
              <span className="flex items-center space-x-1 text-rose-400 font-medium">
                <AlertCircle className="w-3 h-3" />
                <span>Disconnected</span>
              </span>
            )}
          </div>
        </div>

        {/* User Navigation / Auth Controls */}
        <div className="flex items-center space-x-3">
          {currentUser ? (
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700">
                <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs font-semibold text-indigo-300">
                  {currentUser.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-medium text-white flex items-center space-x-1.5">
                    <span>{currentUser.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded border uppercase font-mono ${getRoleBadge(currentUser.role)}`}>
                      {currentUser.role}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400">{currentUser.email}</div>
                </div>
              </div>

              <button
                id="btn-header-logout"
                onClick={onLogout}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-300 hover:text-white transition-colors"
                title="Log out"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <button
                id="btn-header-login"
                onClick={() => onOpenAuth('login')}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-colors"
              >
                <LogIn className="w-3.5 h-3.5 text-slate-400" />
                <span>Sign In</span>
              </button>
              <button
                id="btn-header-register"
                onClick={() => onOpenAuth('register')}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white shadow transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Register</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

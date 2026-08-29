import React, { useEffect, useState } from 'react';
import { X, Calendar, Clock, Users, Shield, History, Activity as ActivityIcon } from 'lucide-react';
import { ProjectItem, ActivityItem, UserSummary } from '../types/index.ts';

interface ProjectDetailModalProps {
  isOpen: boolean;
  project: ProjectItem | null;
  currentUser: UserSummary | null;
  onClose: () => void;
}

export const ProjectDetailModal: React.FC<ProjectDetailModalProps> = ({
  isOpen,
  project,
  currentUser,
  onClose,
}) => {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  useEffect(() => {
    if (!isOpen || !project) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoadingActivities(true);
    fetch(`/api/projects/${project.projectId}/activities`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load project activity records');
        return res.json();
      })
      .then((data) => {
        setActivities(data.activities || []);
      })
      .catch((err) => {
        console.error('Error fetching activities:', err);
      })
      .finally(() => {
        setLoadingActivities(false);
      });
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Not set';
    }
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleString();
    } catch {
      return dateStr;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
      case 'planned':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-700/80';
      case 'completed':
        return 'bg-blue-950/80 text-blue-300 border-blue-700/80';
      case 'cancelled':
        return 'bg-rose-950/80 text-rose-300 border-rose-700/80';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-2xl w-full text-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/60">
              {project.projectId}
            </span>
            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium capitalize ${getStatusBadge(project.status)}`}>
              {project.status}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Title & Description */}
          <div>
            <h2 className="text-xl font-bold text-white mb-2">{project.name}</h2>
            <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
              {project.description || 'No detailed description provided for this project.'}
            </p>
          </div>

          {/* Timeline Grid */}
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/60 border border-slate-800 rounded-lg text-xs">
            <div className="flex items-center space-x-2">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <div>
                <div className="text-slate-400 text-[11px]">Start Date</div>
                <div className="font-medium text-slate-200">{formatDate(project.startDate)}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-400" />
              <div>
                <div className="text-slate-400 text-[11px]">Target Deadline</div>
                <div className="font-medium text-amber-300">{formatDate(project.deadline)}</div>
              </div>
            </div>
          </div>

          {/* Team Members */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Assigned Team Members ({project.teamMembers?.length || 0})</span>
            </h3>

            {project.teamMembers && project.teamMembers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {project.teamMembers.map((member, idx) => (
                  <div
                    key={member._id || idx}
                    className="flex items-center space-x-2.5 p-2.5 rounded-lg bg-slate-950/50 border border-slate-800"
                  >
                    <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-bold text-indigo-300">
                      {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-slate-200 truncate">{member.name}</div>
                      <div className="text-[10px] text-slate-500 truncate">{member.email}</div>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 uppercase font-mono">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic p-3 bg-slate-950/40 rounded border border-slate-800/60">
                No team members assigned yet.
              </p>
            )}
          </div>

          {/* Activity / Audit Log History */}
          <div>
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center space-x-1.5">
              <History className="w-3.5 h-3.5 text-blue-400" />
              <span>Project Audit History (MongoDB Activity Model)</span>
            </h3>

            <div className="bg-slate-950/70 border border-slate-800 rounded-lg p-3 max-h-60 overflow-y-auto space-y-2.5">
              {loadingActivities ? (
                <p className="text-xs text-slate-500 text-center py-4 animate-pulse">Loading audit history...</p>
              ) : activities.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-4">No activity records recorded for this project</p>
              ) : (
                activities.map((act) => {
                  const actor = typeof act.userId === 'object' && act.userId ? act.userId.name : 'System / User';
                  const actorRole = typeof act.userId === 'object' && act.userId ? act.userId.role : '';
                  const prevObj = act.previousValue as Record<string, unknown> | null;
                  const newObj = act.newValue as Record<string, unknown> | null;

                  return (
                    <div
                      key={act._id}
                      className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 text-xs space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-indigo-300 font-mono text-[11px]">
                            {act.action.replace(/_/g, ' ')}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            by <strong className="text-slate-300">{actor}</strong> {actorRole && `(${actorRole})`}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 shrink-0">
                          {formatDateTime(act.timestamp)}
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <span>Entity:</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">{act.entity || 'Project'}</span>
                      </div>

                      {/* State transition or value diff */}
                      {prevObj && newObj && prevObj.status !== newObj.status && (
                        <div className="p-2 rounded bg-slate-950/80 border border-slate-800/80 text-[11px] flex items-center space-x-2">
                          <span className="text-slate-400">Status Change:</span>
                          <span className="font-mono text-slate-400 uppercase">{String(prevObj.status)}</span>
                          <span className="text-slate-500">→</span>
                          <span className="font-mono text-emerald-300 uppercase font-semibold">{String(newObj.status)}</span>
                        </div>
                      )}

                      {/* Previous & New Values */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                        {prevObj && (
                          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 overflow-hidden">
                            <span className="text-slate-500 font-semibold block mb-0.5">Previous Value:</span>
                            <pre className="font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(prevObj, null, 1)}
                            </pre>
                          </div>
                        )}
                        {newObj && (
                          <div className="p-2 rounded bg-slate-950/60 border border-slate-800/60 overflow-hidden">
                            <span className="text-slate-500 font-semibold block mb-0.5">New Value:</span>
                            <pre className="font-mono text-indigo-300 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(newObj, null, 1)}
                            </pre>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

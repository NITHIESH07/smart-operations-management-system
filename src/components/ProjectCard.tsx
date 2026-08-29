import React from 'react';
import { Calendar, Users, Edit3, Trash2, ArrowUpRight, Clock } from 'lucide-react';
import { ProjectItem, UserSummary } from '../types/index.ts';

interface ProjectCardProps {
  project: ProjectItem;
  currentUser: UserSummary | null;
  onView: (project: ProjectItem) => void;
  onEdit: (project: ProjectItem) => void;
  onDelete: (project: ProjectItem) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  currentUser,
  onView,
  onEdit,
  onDelete,
}) => {
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

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

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'Not set';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all duration-150">
      <div>
        {/* Card Header: Project ID & Status */}
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-xs font-semibold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900/60">
            {project.projectId}
          </span>
          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium capitalize ${getStatusBadge(project.status)}`}>
            {project.status}
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-semibold text-white tracking-tight line-clamp-1 mb-1.5">
          {project.name}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
          {project.description || 'No project description provided.'}
        </p>

        {/* Timeline Dates */}
        <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/80 mb-4">
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px]">Start:</span>
              <span className="text-slate-300 font-medium">{formatDate(project.startDate)}</span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-slate-400">
            <Clock className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px]">Deadline:</span>
              <span className="text-amber-300/90 font-medium">{formatDate(project.deadline)}</span>
            </div>
          </div>
        </div>

        {/* Team Members */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-4 pt-1 border-t border-slate-800/60">
          <div className="flex items-center space-x-1.5">
            <Users className="w-3.5 h-3.5 text-slate-400" />
            <span>Team ({project.teamMembers?.length || 0})</span>
          </div>

          <div className="flex -space-x-1.5 overflow-hidden">
            {project.teamMembers && project.teamMembers.length > 0 ? (
              project.teamMembers.slice(0, 4).map((member, idx) => (
                <div
                  key={member._id || idx}
                  title={`${member.name} (${member.role})`}
                  className="w-6 h-6 rounded-full bg-indigo-900/80 border border-slate-800 flex items-center justify-center text-[10px] font-bold text-indigo-200"
                >
                  {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                </div>
              ))
            ) : (
              <span className="text-[11px] text-slate-500 italic">Unassigned</span>
            )}
            {project.teamMembers && project.teamMembers.length > 4 && (
              <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[9px] text-slate-300">
                +{project.teamMembers.length - 4}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-slate-800">
        <button
          id={`btn-view-project-${project.projectId}`}
          onClick={() => onView(project)}
          className="flex items-center space-x-1 text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          <span>View Details & History</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>

        {isManagerOrAdmin && (
          <div className="flex items-center space-x-1">
            <button
              id={`btn-edit-project-${project.projectId}`}
              onClick={() => onEdit(project)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Edit Project"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button
              id={`btn-delete-project-${project.projectId}`}
              onClick={() => onDelete(project)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
              title="Delete Project"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

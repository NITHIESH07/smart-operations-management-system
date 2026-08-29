import React from 'react';
import { Calendar, User, Clock, AlertTriangle, ArrowRight, MessageSquare, Edit3, Trash2, CheckCircle2 } from 'lucide-react';
import { TaskItem, UserSummary, TaskStatus, TaskPriority } from '../types/index.ts';

interface TaskCardProps {
  task: TaskItem;
  currentUser: UserSummary | null;
  onView: (task: TaskItem) => void;
  onEdit: (task: TaskItem) => void;
  onDelete: (task: TaskItem) => void;
  onStatusChange: (task: TaskItem, newStatus: TaskStatus) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  currentUser,
  onView,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAssigned = task.assignedTo && currentUser && (task.assignedTo._id === currentUser._id || task.assignedTo.userId === currentUser.userId);
  const canEdit = isManagerOrAdmin || isAssigned;

  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'critical':
        return 'bg-rose-950/90 text-rose-300 border-rose-700/80 font-bold';
      case 'high':
        return 'bg-amber-950/90 text-amber-300 border-amber-700/80';
      case 'medium':
        return 'bg-blue-950/80 text-blue-300 border-blue-700/80';
      case 'low':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  const getStatusBadge = (status: TaskStatus) => {
    switch (status) {
      case 'completed':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/80';
      case 'review':
        return 'bg-purple-950/80 text-purple-300 border-purple-700/80';
      case 'in_progress':
        return 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80';
      case 'blocked':
        return 'bg-red-950/80 text-red-300 border-red-700/80';
      case 'todo':
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace('_', ' ');
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'No due date';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return 'No due date';
    }
  };

  // Check if overdue
  const isOverdue = task.isOverdue || (task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completed');

  // Next valid status transition button
  const getNextTransition = (): { next: TaskStatus; label: string } | null => {
    if (task.status === 'todo') return { next: 'in_progress', label: 'Start Task' };
    if (task.status === 'in_progress') return { next: 'review', label: 'Submit for Review' };
    if (task.status === 'review') return { next: 'completed', label: 'Approve & Complete' };
    return null;
  };

  const nextTransition = getNextTransition();

  return (
    <div className={`bg-slate-900 border ${isOverdue ? 'border-rose-800/80' : 'border-slate-800'} hover:border-slate-700 rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all duration-150 relative overflow-hidden`}>
      {isOverdue && (
        <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-rose-600 to-amber-600" />
      )}

      <div>
        {/* Card Header: Task ID, Priority, & Status */}
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="font-mono text-xs font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-900/60">
              {task.taskId}
            </span>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border uppercase tracking-wider ${getPriorityBadge(task.priority)}`}>
              {task.priority}
            </span>
          </div>
          <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium capitalize shrink-0 ${getStatusBadge(task.status)}`}>
            {formatStatus(task.status)}
          </span>
        </div>

        {/* Project reference tag */}
        <div className="mb-2">
          <span className="text-[11px] font-medium text-indigo-400 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-900/40 inline-flex items-center space-x-1">
            <span className="text-slate-500">Project:</span>
            <span>
  {typeof task.projectId === 'object' && task.projectId !== null
    ? task.projectId.name
    : String(task.projectId ?? '')}
</span>
          </span>
        </div>

        {/* Title & Description */}
        <h3 className="text-base font-semibold text-white tracking-tight line-clamp-1 mb-1.5">
          {task.title}
        </h3>
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
          {task.description || 'No additional details provided.'}
        </p>

        {/* Due Date & Overdue Badge */}
        <div className={`flex items-center justify-between text-[11px] p-2 rounded-lg border mb-3 ${isOverdue ? 'bg-rose-950/40 border-rose-900/80 text-rose-300' : 'bg-slate-950/60 border-slate-800/80 text-slate-400'}`}>
          <div className="flex items-center space-x-1.5">
            <Calendar className={`w-3.5 h-3.5 ${isOverdue ? 'text-rose-400' : 'text-slate-500'}`} />
            <span>Due: <strong className={isOverdue ? 'text-rose-300 font-bold' : 'text-slate-300 font-medium'}>{formatDate(task.dueDate)}</strong></span>
          </div>
          {isOverdue && (
            <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-400 uppercase tracking-wider bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">
              <AlertTriangle className="w-3 h-3" />
              <span>Overdue</span>
            </span>
          )}
        </div>

        {/* Assigned Employee & Comment count */}
        <div className="flex items-center justify-between text-xs text-slate-400 mb-4 pt-1 border-t border-slate-800/60">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded-full bg-cyan-950 border border-cyan-800/80 flex items-center justify-center text-[10px] font-bold text-cyan-300">
              {task.assignedTo ? task.assignedTo.name.charAt(0).toUpperCase() : '?'}
            </div>
            <div className="text-left">
              <span className="text-[10px] text-slate-500 block leading-tight">Assignee:</span>
              <span className="text-xs text-slate-300 font-medium truncate max-w-[130px] block">
                {task.assignedTo ? task.assignedTo.name : <em className="text-slate-500">Unassigned</em>}
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-1 text-[11px] text-slate-400 bg-slate-800/50 px-2 py-1 rounded">
            <MessageSquare className="w-3.5 h-3.5 text-slate-500" />
            <span>{task.comments?.length || 0}</span>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-3 border-t border-slate-800 space-y-2">
        {/* State Machine Transition Quick Action */}
        {nextTransition && (isManagerOrAdmin || isAssigned) && (
          <button
            id={`btn-transition-task-${task.taskId}`}
            onClick={() => onStatusChange(task, nextTransition.next)}
            className="w-full py-1.5 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 border border-indigo-500/30 flex items-center justify-center space-x-1.5 text-xs font-semibold transition-colors"
          >
            <span>{nextTransition.label}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        <div className="flex items-center justify-between">
          <button
            id={`btn-view-task-${task.taskId}`}
            onClick={() => onView(task)}
            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Details & Discussion
          </button>

          <div className="flex items-center space-x-1">
            {canEdit && (
              <button
                id={`btn-edit-task-${task.taskId}`}
                onClick={() => onEdit(task)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                title="Edit Task"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
            {isManagerOrAdmin && (
              <button
                id={`btn-delete-task-${task.taskId}`}
                onClick={() => onDelete(task)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

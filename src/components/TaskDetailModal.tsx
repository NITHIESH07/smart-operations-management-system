import React, { useEffect, useState, useCallback } from 'react';
import {
  X,
  Calendar,
  User,
  Clock,
  MessageSquare,
  History,
  AlertTriangle,
  ArrowRight,
  Send,
  CheckCircle2,
  AlertCircle,
  Activity as ActivityIcon,
} from 'lucide-react';
import { TaskItem, UserSummary, TaskStatus, TaskPriority, ActivityItem } from '../types/index.ts';

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  task: TaskItem | null;
  currentUser: UserSummary | null;
  onTaskUpdated: (updatedTask: TaskItem) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  isOpen,
  onClose,
  task,
  currentUser,
  onTaskUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'comments' | 'history'>('details');
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';
  const isAssigned = task?.assignedTo && currentUser && (task.assignedTo._id === currentUser._id || task.assignedTo.userId === currentUser.userId);
  const canPerformTransitions = isManagerOrAdmin || isAssigned;

  const fetchActivities = useCallback(async () => {
    if (!task) return;
    setLoadingActivities(true);
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;
      const res = await fetch(`/api/tasks/${task.taskId}/activities`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setActivities(data.activities || []);
      }
    } catch (err) {
      console.error('Failed to fetch task activities:', err);
    } finally {
      setLoadingActivities(false);
    }
  }, [task]);

  useEffect(() => {
    if (isOpen && task) {
      fetchActivities();
      setCommentText('');
      setCommentError(null);
      setStatusError(null);
    }
  }, [isOpen, task, fetchActivities]);

  if (!isOpen || !task) return null;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Not set';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? 'Invalid date' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Not set';
    }
  };

  const isOverdue = task.isOverdue || (task.dueDate && new Date(task.dueDate).getTime() < Date.now() && task.status !== 'completed');

  // Handle status transition via state machine
  const handleTransition = async (targetStatus: TaskStatus) => {
    setStatusUpdating(true);
    setStatusError(null);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/tasks/${task.taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: targetStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to change status');
      }

      onTaskUpdated(data.task);
      fetchActivities();
    } catch (err: unknown) {
      setStatusError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setStatusUpdating(false);
    }
  };

  // Add Comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    setCommentError(null);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/tasks/${task.taskId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: commentText.trim() }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to submit comment');
      }

      onTaskUpdated(data.task);
      setCommentText('');
      fetchActivities();
    } catch (err: unknown) {
      setCommentError(err instanceof Error ? err.message : 'Failed to post comment');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Valid status transitions from current status
  const getPermittedTransitions = (): { status: TaskStatus; label: string; tone: string }[] => {
    switch (task.status) {
      case 'todo':
        return [{ status: 'in_progress', label: 'Start Task (In Progress)', tone: 'bg-cyan-600 hover:bg-cyan-500 text-white' }];
      case 'in_progress':
        return [{ status: 'review', label: 'Submit for Review', tone: 'bg-purple-600 hover:bg-purple-500 text-white' }];
      case 'review':
        return [
          { status: 'completed', label: 'Approve & Complete', tone: 'bg-emerald-600 hover:bg-emerald-500 text-white' },
          { status: 'in_progress', label: 'Request Revisions (Back to Progress)', tone: 'bg-slate-700 hover:bg-slate-600 text-slate-200' },
        ];
      case 'blocked':
        return [{ status: 'in_progress', label: 'Unblock & Resume', tone: 'bg-cyan-600 hover:bg-cyan-500 text-white' }];
      case 'completed':
      default:
        return [];
    }
  };

  const transitions = getPermittedTransitions();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-semibold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-900/60">
                {task.taskId}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold bg-slate-800 text-slate-300 border-slate-700">
                {task.priority}
              </span>
              <span className="text-xs px-2.5 py-0.5 rounded-full border capitalize font-medium bg-indigo-950/60 text-indigo-300 border-indigo-800/80">
                {task.status.replace('_', ' ')}
              </span>
            </div>
            <h2 className="text-lg font-bold text-white tracking-tight">{task.title}</h2>
          </div>
          <button
            id="btn-close-task-detail"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 px-6 bg-slate-950/40">
          <button
            id="tab-task-details"
            onClick={() => setActiveTab('details')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'details'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview & Status Flow
          </button>
          <button
            id="tab-task-comments"
            onClick={() => setActiveTab('comments')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'comments'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Discussion ({task.comments?.length || 0})</span>
          </button>
          <button
            id="tab-task-history"
            onClick={() => setActiveTab('history')}
            className={`py-3 px-4 text-xs font-semibold border-b-2 transition-colors flex items-center space-x-1.5 ${
              activeTab === 'history'
                ? 'border-cyan-500 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail ({activities.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* TAB 1: DETAILS & TRANSITIONS */}
          {activeTab === 'details' && (
            <div className="space-y-5">
              {/* Description */}
              <div className="bg-slate-950/60 p-4 rounded-xl border border-slate-800">
                <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Description</h4>
                <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {task.description || 'No detailed description provided.'}
                </p>
              </div>

              {/* Status Machine Transition Controls */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Allowed Status Transitions
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    Strict Backend State Machine
                  </span>
                </div>

                {statusError && (
                  <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{statusError}</span>
                  </div>
                )}

                {transitions.length > 0 ? (
                  canPerformTransitions ? (
                    <div className="flex flex-wrap gap-2">
                      {transitions.map((t) => (
                        <button
                          key={t.status}
                          id={`btn-transition-to-${t.status}`}
                          disabled={statusUpdating}
                          onClick={() => handleTransition(t.status)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all shadow-md ${t.tone}`}
                        >
                          <span>{t.label}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">
                      Only the assigned employee or a manager/admin can advance this task's status.
                    </p>
                  )
                ) : (
                  <div className="flex items-center space-x-2 text-emerald-400 text-xs font-medium bg-emerald-950/40 p-2.5 rounded-lg border border-emerald-800/60">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>This task is in terminal status ({task.status}). No further transitions allowed.</span>
                  </div>
                )}
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Parent Project</span>
                  <span className="text-slate-200 font-medium text-sm">
  {typeof task.projectId === 'object' && task.projectId !== null
    ? task.projectId.name
    : String(task.projectId ?? '')}
</span>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Assigned Employee</span>
                  <span className="text-slate-200 font-medium text-sm">
                    {task.assignedTo ? `${task.assignedTo.name} (${task.assignedTo.email})` : 'Unassigned'}
                  </span>
                </div>

                <div className={`p-3 rounded-xl border ${isOverdue ? 'bg-rose-950/30 border-rose-800 text-rose-300' : 'bg-slate-950/60 border-slate-800'}`}>
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Due Date</span>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{formatDate(task.dueDate)}</span>
                    {isOverdue && (
                      <span className="text-[10px] font-bold text-rose-400 uppercase tracking-wider bg-rose-950 px-1.5 py-0.5 rounded border border-rose-800">
                        Overdue
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <span className="text-slate-500 block text-[10px] uppercase font-semibold mb-1">Created At</span>
                  <span className="text-slate-200 font-medium text-sm">{formatDate(task.createdAt)}</span>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: COMMENTS & DISCUSSION */}
          {activeTab === 'comments' && (
            <div className="space-y-4">
              {/* Comment Input */}
              <form onSubmit={handleAddComment} className="space-y-2">
                {commentError && (
                  <div className="p-2.5 bg-rose-950/60 border border-rose-800 rounded-lg text-xs text-rose-300">
                    {commentError}
                  </div>
                )}
                <div className="flex space-x-2">
                  <input
                    id="input-task-comment"
                    type="text"
                    required
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Add an update, question, or note to this task..."
                    className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    id="btn-submit-task-comment"
                    disabled={submittingComment || !commentText.trim()}
                    className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center space-x-1 transition-colors"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send</span>
                  </button>
                </div>
              </form>

              {/* Comments List */}
              <div className="space-y-3 pt-2">
                {task.comments && task.comments.length > 0 ? (
                  task.comments.map((comment, idx) => (
                    <div key={comment._id || idx} className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-semibold text-cyan-300">
                          {typeof comment.userId === 'object' && comment.userId ? comment.userId.name : 'Team Member'}
                        </span>
                        <span className="text-slate-500">{formatDate(comment.timestamp)}</span>
                      </div>
                      <p className="text-xs text-slate-200 leading-relaxed">{comment.text}</p>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No comments yet. Start the conversation by posting an update above.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: AUDIT & HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {loadingActivities ? (
                <div className="py-8 text-center text-xs text-slate-400 animate-pulse">Loading audit history...</div>
              ) : activities.length > 0 ? (
                activities.map((act) => {
                  const actor = typeof act.userId === 'object' && act.userId ? act.userId.name : 'System / User';
                  const actorRole = typeof act.userId === 'object' && act.userId ? act.userId.role : '';
                  const prevObj = act.previousValue as Record<string, unknown> | null;
                  const newObj = act.newValue as Record<string, unknown> | null;

                  return (
                    <div key={act._id} className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-indigo-400 flex items-center space-x-1.5 font-mono text-[11px]">
                            <ActivityIcon className="w-3.5 h-3.5 text-indigo-500" />
                            <span>{act.action.replace(/_/g, ' ')}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            by <strong className="text-slate-300">{actor}</strong> {actorRole && `(${actorRole})`}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-500">{formatDate(act.timestamp)}</span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center space-x-1">
                        <span>Entity:</span>
                        <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono text-[10px]">{act.entity || 'Task'}</span>
                      </div>

                      {/* Status Transition highlight */}
                     {prevObj &&newObj &&Boolean(prevObj.status) &&Boolean(newObj.status) &&String(prevObj.status) !== String(newObj.status) && (
                        <div className="p-2 rounded bg-slate-900 border border-slate-800 text-[11px] flex items-center space-x-2">
                          <span className="text-slate-400">Status Change:</span>
                          <span className="font-mono text-slate-400 uppercase">{String(prevObj.status)}</span>
                          <span className="text-slate-500">→</span>
                          <span className="font-mono text-emerald-300 uppercase font-semibold">{String(newObj.status)}</span>
                        </div>
                      )}

                      {/* Previous & New Values */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px]">
                        {prevObj && (
                          <div className="p-2 rounded bg-slate-900/80 border border-slate-800 overflow-hidden">
                            <span className="text-slate-500 font-semibold block mb-0.5">Previous Value:</span>
                            <pre className="font-mono text-slate-400 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(prevObj, null, 1)}
                            </pre>
                          </div>
                        )}
                        {newObj && (
                          <div className="p-2 rounded bg-slate-900/80 border border-slate-800 overflow-hidden">
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
              ) : (
                <div className="py-8 text-center text-slate-500 text-xs">
                  No activity history recorded for this task yet.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { TaskItem } from '../types/index.ts';

interface TaskDeleteConfirmModalProps {
  isOpen: boolean;
  task: TaskItem | null;
  onClose: () => void;
  onDeleted: () => void;
}

export const TaskDeleteConfirmModal: React.FC<TaskDeleteConfirmModalProps> = ({
  isOpen,
  task,
  onClose,
  onDeleted,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/tasks/${task.taskId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to delete task');
      }

      onDeleted();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full text-slate-100 overflow-hidden">
        <div className="p-6 space-y-4">
          <div className="flex items-start space-x-3">
            <div className="p-2.5 rounded-full bg-rose-950/80 border border-rose-800 text-rose-400 shrink-0">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Delete Task</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete task <span className="font-semibold text-slate-200">"{task.title}"</span> ({task.taskId})?
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            This action will permanently delete this task along with its comments and generate a corresponding audit activity log.
          </p>

          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              id="btn-cancel-delete-task"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-delete-task"
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow"
            >
              {deleting ? 'Deleting...' : 'Delete Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

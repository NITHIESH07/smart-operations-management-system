import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { ProjectItem } from '../types/index.ts';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  project: ProjectItem | null;
  onClose: () => void;
  onDeleted: () => void;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  project,
  onClose,
  onDeleted,
}) => {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !project) return null;

  const handleDelete = async () => {
    setError(null);
    setDeleting(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('Authentication required');

      const res = await fetch(`/api/projects/${project.projectId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to delete project');
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
              <h3 className="text-base font-semibold text-white">Delete Project</h3>
              <p className="text-xs text-slate-400 mt-1">
                Are you sure you want to delete <span className="font-semibold text-slate-200">"{project.name}"</span> ({project.projectId})?
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-lg border border-slate-800">
            This action removes the project and creates an audit record. Projects with active tasks cannot be deleted until tasks are reassigned.
          </p>

          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-confirm-delete-project"
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow"
            >
              {deleting ? 'Deleting...' : 'Delete Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

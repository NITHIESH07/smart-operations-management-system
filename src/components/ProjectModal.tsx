import React, { useState, useEffect } from 'react';
import { X, Calendar, Users, AlertCircle, Check } from 'lucide-react';
import { ProjectItem, ProjectStatus, UserSummary } from '../types/index.ts';

interface ProjectModalProps {
  isOpen: boolean;
  projectToEdit: ProjectItem | null;
  onClose: () => void;
  onSaved: () => void;
}

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  projectToEdit,
  onClose,
  onSaved,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [deadline, setDeadline] = useState('');
  const [status, setStatus] = useState<ProjectStatus>('planned');
  const [selectedTeamMemberIds, setSelectedTeamMemberIds] = useState<string[]>([]);
  const [availableUsers, setAvailableUsers] = useState<UserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available users for team member assignment
  useEffect(() => {
    if (!isOpen) return;

    const token = localStorage.getItem('auth_token');
    if (!token) return;

    setLoadingUsers(true);
    fetch('/api/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load user roster');
        return res.json();
      })
      .then((data) => {
        setAvailableUsers(data.users || []);
      })
      .catch((err) => {
        console.error('Error fetching users:', err);
      })
      .finally(() => {
        setLoadingUsers(false);
      });
  }, [isOpen]);

  // Populate form fields if editing
  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name);
      setDescription(projectToEdit.description || '');
      setStartDate(projectToEdit.startDate ? projectToEdit.startDate.substring(0, 10) : '');
      setDeadline(projectToEdit.deadline ? projectToEdit.deadline.substring(0, 10) : '');
      setStatus(projectToEdit.status);
      setSelectedTeamMemberIds(
        projectToEdit.teamMembers?.map((m) => (typeof m === 'string' ? m : m._id)) || []
      );
    } else {
      setName('');
      setDescription('');
      setStartDate('');
      setDeadline('');
      setStatus('planned');
      setSelectedTeamMemberIds([]);
    }
    setError(null);
  }, [projectToEdit, isOpen]);

  if (!isOpen) return null;

  const toggleTeamMember = (id: string) => {
    setSelectedTeamMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Client-side date check
    if (startDate && deadline) {
      const start = new Date(startDate);
      const end = new Date(deadline);
      if (end < start) {
        setError('Project deadline cannot be earlier than start date');
        return;
      }
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) throw new Error('You must be logged in');

      const payload = {
        name: name.trim(),
        description: description.trim(),
        startDate: startDate ? new Date(startDate).toISOString() : undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        status,
        teamMembers: selectedTeamMemberIds,
      };

      const url = projectToEdit
        ? `/api/projects/${projectToEdit.projectId}`
        : '/api/projects';
      const method = projectToEdit ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || data.error || 'Failed to save project');
      }

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-xl w-full text-slate-100 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div>
            <h2 className="text-base font-semibold text-white">
              {projectToEdit ? `Edit Project: ${projectToEdit.projectId}` : 'Create New Project'}
            </h2>
            <p className="text-xs text-slate-400">Set project timeline, status and assigned team members</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/80 rounded-lg flex items-start space-x-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Project Name <span className="text-indigo-400">*</span>
            </label>
            <input
              id="input-project-name"
              type="text"
              required
              minLength={2}
              maxLength={150}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Supply Chain Telemetry Integration"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Description</label>
            <textarea
              id="input-project-description"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide context, objectives, deliverables, or operational scope..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Start Date</label>
              <div className="relative">
                <input
                  id="input-project-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Deadline Date</label>
              <div className="relative">
                <input
                  id="input-project-deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">Project Status</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStatus(opt.value)}
                  className={`py-1.5 px-2 rounded-lg border text-xs font-medium capitalize transition-colors ${
                    status === opt.value
                      ? 'bg-indigo-600/30 border-indigo-500 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Assign Team Members ({selectedTeamMemberIds.length} selected)
            </label>
            <div className="bg-slate-950 border border-slate-700 rounded-lg p-2 max-h-44 overflow-y-auto space-y-1">
              {loadingUsers ? (
                <p className="text-xs text-slate-500 p-2 text-center">Loading team members...</p>
              ) : availableUsers.length === 0 ? (
                <p className="text-xs text-slate-500 p-2 text-center">No other users registered in database</p>
              ) : (
                availableUsers.map((user) => {
                  const isSelected = selectedTeamMemberIds.includes(user._id);
                  return (
                    <div
                      key={user._id}
                      onClick={() => toggleTeamMember(user._id)}
                      className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-indigo-950/60 border border-indigo-700/60'
                          : 'hover:bg-slate-900 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-bold text-indigo-300">
                          {user.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-xs font-medium text-slate-200">{user.name}</div>
                          <div className="text-[10px] text-slate-500">{user.email}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-mono">
                          {user.role}
                        </span>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-500 text-white'
                              : 'border-slate-700 bg-slate-900'
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              id="btn-save-project"
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium transition-colors shadow"
            >
              {submitting ? 'Saving...' : projectToEdit ? 'Save Changes' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

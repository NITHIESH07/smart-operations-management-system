import React, { useEffect, useState, useCallback } from 'react';
import {
  FolderKanban,
  CheckSquare,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertCircle,
  Briefcase,
  Layers,
  Flag,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import {
  UserSummary,
  ProjectItem,
  TaskItem,
  HealthResponse,
  ProjectStatus,
  TaskPriority,
  TaskStatus,
  PaginationMeta,
  DashboardResponse,
} from './types/index.ts';
import { Header } from './components/Header.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ProjectCard } from './components/ProjectCard.tsx';
import { ProjectModal } from './components/ProjectModal.tsx';
import { ProjectDetailModal } from './components/ProjectDetailModal.tsx';
import { DeleteConfirmModal } from './components/DeleteConfirmModal.tsx';
import { TaskCard } from './components/TaskCard.tsx';
import { TaskModal } from './components/TaskModal.tsx';
import { TaskDetailModal } from './components/TaskDetailModal.tsx';
import { TaskDeleteConfirmModal } from './components/TaskDeleteConfirmModal.tsx';

export default function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'projects' | 'tasks'>('dashboard');

  const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(true);

  // Dashboard state
  const [dashboardData, setDashboardData] = useState<DashboardResponse | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Projects state
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Projects Filters & Search
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const [projectStatusFilter, setProjectStatusFilter] = useState<'all' | ProjectStatus>('all');

  // Tasks state
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);
  const [taskPagination, setTaskPagination] = useState<PaginationMeta>({
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  });

  // Tasks Filters & Search
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [taskProjectFilter, setTaskProjectFilter] = useState<string>('all');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState<string>('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState<'all' | TaskStatus>('all');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState<'all' | TaskPriority>('all');
  const [taskOverdueFilter, setTaskOverdueFilter] = useState<'all' | 'true' | 'false'>('all');
  const [taskDueDateFrom, setTaskDueDateFrom] = useState<string>('');
  const [taskDueDateTo, setTaskDueDateTo] = useState<string>('');
  const [taskSortBy, setTaskSortBy] = useState<string>('createdAt');
  const [taskSortOrder, setTaskSortOrder] = useState<'desc' | 'asc'>('desc');
  const [taskPage, setTaskPage] = useState<number>(1);

  // Project Modals
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectToEdit, setProjectToEdit] = useState<ProjectItem | null>(null);

  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<ProjectItem | null>(null);

  // Task Modals
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<TaskItem | null>(null);

  const [taskDetailModalOpen, setTaskDetailModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskItem | null>(null);

  const [taskDeleteModalOpen, setTaskDeleteModalOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<TaskItem | null>(null);

  // Fetch API / Database Health
  const fetchHealth = useCallback(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: HealthResponse) => {
        setHealth(data);
        setHealthLoading(false);
      })
      .catch((err) => {
        console.error('Health fetch error:', err);
        setHealthLoading(false);
      });
  }, []);

  // Fetch Current Authenticated User profile
  const fetchCurrentUser = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setCurrentUser(null);
      return;
    }

    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) {
          if (res.status === 401) {
            localStorage.removeItem('auth_token');
            setCurrentUser(null);
          }
          throw new Error('Session invalid');
        }
        return res.json();
      })
      .then((data) => {
        setCurrentUser(data.user);
      })
      .catch(() => {
        setCurrentUser(null);
      });
  }, []);

  // Fetch Dashboard Analytics from MongoDB backend
  const fetchDashboard = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setDashboardData(null);
      setLoadingDashboard(false);
      return;
    }

    setLoadingDashboard(true);
    setDashboardError(null);

    fetch('/api/dashboard', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || `HTTP ${res.status}`);
        }
        return data;
      })
      .then((data: DashboardResponse) => {
        setDashboardData(data);
        setLoadingDashboard(false);
      })
      .catch((err) => {
        setDashboardError(err.message);
        setLoadingDashboard(false);
      });
  }, []);

  // Fetch Projects from MongoDB
  const fetchProjects = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setProjects([]);
      setLoadingProjects(false);
      return;
    }

    setLoadingProjects(true);
    setProjectError(null);

    fetch('/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || `HTTP ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        setProjects(data.projects || []);
        setLoadingProjects(false);
      })
      .catch((err) => {
        setProjectError(err.message);
        setLoadingProjects(false);
      });
  }, []);

  // Fetch Tasks with Server-side Filtering, Sorting, and Pagination
  const fetchTasks = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setTasks([]);
      setLoadingTasks(false);
      return;
    }

    setLoadingTasks(true);
    setTaskError(null);

    const queryParams = new URLSearchParams();
    queryParams.set('page', String(taskPage));
    queryParams.set('limit', '12');
    queryParams.set('sortBy', taskSortBy);
    queryParams.set('sortOrder', taskSortOrder);

    if (taskSearchQuery.trim()) {
      queryParams.set('search', taskSearchQuery.trim());
    }
    if (taskProjectFilter !== 'all') {
      queryParams.set('projectId', taskProjectFilter);
    }
    if (taskStatusFilter !== 'all') {
      queryParams.set('status', taskStatusFilter);
    }
    if (taskPriorityFilter !== 'all') {
      queryParams.set('priority', taskPriorityFilter);
    }
    if (taskAssigneeFilter !== 'all') {
      queryParams.set('assignedTo', taskAssigneeFilter);
    }
    if (taskOverdueFilter !== 'all') {
      queryParams.set('overdue', taskOverdueFilter);
    }
    if (taskDueDateFrom.trim()) {
      queryParams.set('dueDateFrom', taskDueDateFrom.trim());
    }
    if (taskDueDateTo.trim()) {
      queryParams.set('dueDateTo', taskDueDateTo.trim());
    }

    fetch(`/api/tasks?${queryParams.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || `HTTP ${res.status}`);
        }
        return data;
      })
      .then((data) => {
        setTasks(data.tasks || []);
        if (data.pagination) {
          setTaskPagination(data.pagination);
        }
        setLoadingTasks(false);
      })
      .catch((err) => {
        setTaskError(err.message);
        setLoadingTasks(false);
      });
  }, [
    taskPage,
    taskSortBy,
    taskSortOrder,
    taskSearchQuery,
    taskProjectFilter,
    taskAssigneeFilter,
    taskStatusFilter,
    taskPriorityFilter,
    taskOverdueFilter,
    taskDueDateFrom,
    taskDueDateTo,
  ]);

  useEffect(() => {
    fetchHealth();
    fetchCurrentUser();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, [fetchHealth, fetchCurrentUser]);

  useEffect(() => {
    if (currentUser) {
      fetchDashboard();
      fetchProjects();
      fetchTasks();
    } else {
      setDashboardData(null);
      setProjects([]);
      setTasks([]);
    }
  }, [currentUser, fetchDashboard, fetchProjects, fetchTasks]);

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setCurrentUser(null);
    setDashboardData(null);
    setProjects([]);
    setTasks([]);
  };

  const handleAuthSuccess = (user: UserSummary) => {
    setCurrentUser(user);
    fetchDashboard();
    fetchProjects();
    fetchTasks();
  };

  // Project Modal Actions
  const handleOpenCreateProjectModal = () => {
    setProjectToEdit(null);
    setProjectModalOpen(true);
  };

  const handleOpenEditProjectModal = (project: ProjectItem) => {
    setProjectToEdit(project);
    setProjectModalOpen(true);
  };

  const handleOpenProjectDetailModal = (project: ProjectItem) => {
    setSelectedProject(project);
    setDetailModalOpen(true);
  };

  const handleOpenDeleteProjectModal = (project: ProjectItem) => {
    setProjectToDelete(project);
    setDeleteModalOpen(true);
  };

  // Task Modal Actions
  const handleOpenCreateTaskModal = (preselectedProjectId?: string) => {
    setTaskToEdit(null);
    if (preselectedProjectId) {
      setTaskProjectFilter(preselectedProjectId);
    }
    setTaskModalOpen(true);
  };

  const handleOpenEditTaskModal = (task: TaskItem) => {
    setTaskToEdit(task);
    setTaskModalOpen(true);
  };

  const handleOpenTaskDetailModal = (task: TaskItem) => {
    setSelectedTask(task);
    setTaskDetailModalOpen(true);
  };

  const handleOpenDeleteTaskModal = (task: TaskItem) => {
    setTaskToDelete(task);
    setTaskDeleteModalOpen(true);
  };

  // Status Change Quick Handler
  const handleQuickStatusChange = async (task: TaskItem, newStatus: TaskStatus) => {
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) return;

      const res = await fetch(`/api/tasks/${task.taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.message || data.error || 'Failed to transition task status');
        return;
      }

      fetchTasks();
      fetchDashboard();
      if (selectedTask && selectedTask.taskId === task.taskId) {
        setSelectedTask(data.task);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Status update failed');
    }
  };

  const isManagerOrAdmin = currentUser?.role === 'admin' || currentUser?.role === 'manager';

  // Filtered projects client-side
  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
      project.projectId.toLowerCase().includes(projectSearchQuery.toLowerCase()) ||
      (project.description && project.description.toLowerCase().includes(projectSearchQuery.toLowerCase()));

    const matchesStatus = projectStatusFilter === 'all' || project.status === projectStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Unique team members across projects for the Employee filter
  const allUniqueMembers = React.useMemo(() => {
    const memberMap = new Map<string, UserSummary>();
    if (currentUser) {
      memberMap.set(currentUser._id, currentUser);
    }
    projects.forEach((p) => {
      if (Array.isArray(p.teamMembers)) {
        p.teamMembers.forEach((m) => {
          if (m && m._id) {
            memberMap.set(m._id, m);
          }
        });
      }
    });
    return Array.from(memberMap.values());
  }, [projects, currentUser]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Header */}
      <Header
        currentUser={currentUser}
        health={health}
        healthLoading={healthLoading}
        onOpenAuth={(mode) => {
          setAuthModalMode(mode);
          setAuthModalOpen(true);
        }}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1500px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation Bar & Role Badge */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-lg shrink-0">
              {activeView === 'dashboard' ? (
                <BarChart3 className="w-6 h-6" />
              ) : activeView === 'projects' ? (
                <FolderKanban className="w-6 h-6" />
              ) : (
                <CheckSquare className="w-6 h-6" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {activeView === 'dashboard'
                    ? 'Executive Analytics & Performance'
                    : activeView === 'projects'
                    ? 'Project Management Hub'
                    : 'Task Management Operations'}
                </h2>
                {currentUser && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 uppercase font-mono">
                    {currentUser.role} view
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                {currentUser?.role === 'employee'
                  ? 'Employee View: Accessing project metrics, task progress, and workload within your active team memberships.'
                  : currentUser?.role === 'manager'
                  ? 'Manager View: Full authority to oversee departmental performance, team workloads, projects, and task lifecycles.'
                  : currentUser?.role === 'admin'
                  ? 'Admin View: Comprehensive administrative oversight over all projects, workloads, tasks, and system operations.'
                  : 'Please sign in or register an account to access project & task operations.'}
              </p>
            </div>
          </div>

          {/* View Switcher & Action Buttons */}
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            {currentUser && (
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  id="tab-view-dashboard"
                  onClick={() => setActiveView('dashboard')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    activeView === 'dashboard'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Dashboard</span>
                </button>
                <button
                  id="tab-view-projects"
                  onClick={() => setActiveView('projects')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    activeView === 'projects'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <FolderKanban className="w-3.5 h-3.5" />
                  <span>Projects ({projects.length})</span>
                </button>
                <button
                  id="tab-view-tasks"
                  onClick={() => setActiveView('tasks')}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    activeView === 'tasks'
                      ? 'bg-indigo-600 text-white shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>Tasks ({taskPagination.total})</span>
                </button>
              </div>
            )}

            {currentUser && isManagerOrAdmin && (
              <>
                {activeView === 'projects' && (
                  <button
                    id="btn-create-project-main"
                    onClick={handleOpenCreateProjectModal}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Project</span>
                  </button>
                )}
                {activeView === 'tasks' && (
                  <button
                    id="btn-create-task-main"
                    onClick={() => handleOpenCreateTaskModal()}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>New Task</span>
                  </button>
                )}
              </>
            )}

            <button
              id="btn-refresh-data"
              onClick={() => {
                fetchHealth();
                if (currentUser) {
                  fetchDashboard();
                  fetchProjects();
                  fetchTasks();
                }
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Refresh data"
            >
              <RefreshCw className={`w-4 h-4 ${loadingDashboard || loadingProjects || loadingTasks ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        {!currentUser ? (
          /* Unauthenticated Landing / Call-to-action */
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-10 text-center space-y-5 max-w-lg mx-auto shadow-xl my-10">
            <div className="w-12 h-12 rounded-full bg-indigo-950/80 border border-indigo-700/80 flex items-center justify-center text-indigo-400 mx-auto">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Authentication Required</h3>
              <p className="text-xs text-slate-400 mt-1.5">
                Sign in with an existing account or register a test employee, manager, or admin account to access project and task operations.
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                id="btn-landing-signin"
                onClick={() => {
                  setAuthModalMode('login');
                  setAuthModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-white transition-colors"
              >
                Sign In
              </button>
              <button
                id="btn-landing-register"
                onClick={() => {
                  setAuthModalMode('register');
                  setAuthModalOpen(true);
                }}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white shadow transition-colors"
              >
                Register Account
              </button>
            </div>
          </div>
        ) : activeView === 'dashboard' ? (
          /* ==================================================== */
          /* DASHBOARD VIEW */
          /* ==================================================== */
          <DashboardView
            data={dashboardData}
            loading={loadingDashboard}
            error={dashboardError}
            currentUser={currentUser}
            onRefresh={fetchDashboard}
            onNavigateToProjects={() => setActiveView('projects')}
            onNavigateToTasks={() => setActiveView('tasks')}
          />
        ) : activeView === 'projects' ? (
          /* ==================================================== */
          /* PROJECTS VIEW */
          /* ==================================================== */
          <div className="space-y-5">
            {/* Search & Filter Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  id="input-search-projects"
                  type="text"
                  placeholder="Search projects by name, ID or description..."
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {(['all', 'planned', 'active', 'completed', 'cancelled'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setProjectStatusFilter(st)}
                    className={`px-2.5 py-1 rounded-md text-xs capitalize font-medium transition-colors ${
                      projectStatusFilter === st
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {projectError && (
              <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-xl flex items-center space-x-3 text-xs text-rose-300">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{projectError}</span>
              </div>
            )}

            {loadingProjects ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-56 animate-pulse space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="w-24 h-4 bg-slate-800 rounded" />
                      <div className="w-16 h-4 bg-slate-800 rounded-full" />
                    </div>
                    <div className="w-3/4 h-5 bg-slate-800 rounded" />
                    <div className="w-full h-12 bg-slate-800 rounded" />
                    <div className="w-1/2 h-4 bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                  <Layers className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white">No Projects Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {currentUser.role === 'employee'
                    ? 'You currently have no projects assigned to you. A manager can add you to project team rosters.'
                    : projectSearchQuery || projectStatusFilter !== 'all'
                    ? 'No projects match your current search or status filter criteria.'
                    : 'Get started by creating your first operations project.'}
                </p>
                {isManagerOrAdmin && !projectSearchQuery && projectStatusFilter === 'all' && (
                  <button
                    onClick={handleOpenCreateProjectModal}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Project</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredProjects.map((proj) => (
                  <ProjectCard
                    key={proj._id || proj.projectId}
                    project={proj}
                    currentUser={currentUser}
                    onView={handleOpenProjectDetailModal}
                    onEdit={handleOpenEditProjectModal}
                    onDelete={handleOpenDeleteProjectModal}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ==================================================== */
          /* TASKS VIEW */
          /* ==================================================== */
          <div className="space-y-5">
            {/* Task Multi-Filter & Search Bar */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-3">
              {/* Row 1: Search, Project, Employee, Sort Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="relative sm:col-span-4">
                  <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                  <input
                    id="input-search-tasks"
                    type="text"
                    placeholder="Search tasks by title, ID or description..."
                    value={taskSearchQuery}
                    onChange={(e) => {
                      setTaskSearchQuery(e.target.value);
                      setTaskPage(1);
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                  />
                </div>

                {/* Project Filter */}
                <div className="sm:col-span-3">
                  <select
                    id="filter-task-project"
                    value={taskProjectFilter}
                    onChange={(e) => {
                      setTaskProjectFilter(e.target.value);
                      setTaskPage(1);
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">All Projects</option>
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.projectId})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Employee / Assignee Filter */}
                <div className="sm:col-span-3">
                  <select
                    id="filter-task-assignee"
                    value={taskAssigneeFilter}
                    onChange={(e) => {
                      setTaskAssigneeFilter(e.target.value);
                      setTaskPage(1);
                    }}
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="all">All Assignees</option>
                    {allUniqueMembers.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.name} ({m.role})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Sort Option */}
                <div className="sm:col-span-2 flex space-x-1.5">
                  <select
                    id="sort-task-by"
                    value={taskSortBy}
                    onChange={(e) => setTaskSortBy(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="createdAt">Created</option>
                    <option value="dueDate">Due Date</option>
                    <option value="priority">Priority</option>
                    <option value="status">Status</option>
                    <option value="title">Title</option>
                  </select>
                  <button
                    id="btn-toggle-sort-order"
                    onClick={() => setTaskSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 shrink-0"
                    title={`Sort ${taskSortOrder === 'desc' ? 'Descending' : 'Ascending'}`}
                  >
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Row 2: Status, Priority, Overdue Filter Chips */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60 text-xs">
                {/* Status Chips */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-slate-500 font-semibold mr-1">Status:</span>
                  {(['all', 'todo', 'in_progress', 'review', 'completed'] as const).map((st) => (
                    <button
                      key={st}
                      id={`chip-status-${st}`}
                      onClick={() => {
                        setTaskStatusFilter(st);
                        setTaskPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors ${
                        taskStatusFilter === st
                          ? 'bg-cyan-600 text-white shadow'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {st.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                {/* Priority Chips */}
                <div className="flex items-center space-x-1 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-slate-500 font-semibold mr-1">Priority:</span>
                  {(['all', 'low', 'medium', 'high', 'critical'] as const).map((pr) => (
                    <button
                      key={pr}
                      id={`chip-priority-${pr}`}
                      onClick={() => {
                        setTaskPriorityFilter(pr);
                        setTaskPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-md text-[11px] font-medium capitalize transition-colors ${
                        taskPriorityFilter === pr
                          ? 'bg-cyan-600 text-white shadow'
                          : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {pr}
                    </button>
                  ))}
                </div>

                {/* Overdue & Date Range Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    id="filter-overdue-toggle"
                    onClick={() => {
                      setTaskOverdueFilter((prev) => (prev === 'true' ? 'all' : 'true'));
                      setTaskPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold flex items-center space-x-1 border transition-colors ${
                      taskOverdueFilter === 'true'
                        ? 'bg-rose-950 border-rose-700 text-rose-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <AlertTriangle className="w-3 h-3 text-rose-400" />
                    <span>Overdue Only</span>
                  </button>

                  {/* Due Date Range Inputs */}
                  <div className="flex items-center space-x-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px]">
                    <span className="text-slate-500 font-medium">Due:</span>
                    <input
                      id="filter-task-due-from"
                      type="date"
                      value={taskDueDateFrom}
                      onChange={(e) => {
                        setTaskDueDateFrom(e.target.value);
                        setTaskPage(1);
                      }}
                      className="bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-200 text-[10px] focus:outline-none focus:border-cyan-500"
                      title="Due Date From"
                    />
                    <span className="text-slate-600">to</span>
                    <input
                      id="filter-task-due-to"
                      type="date"
                      value={taskDueDateTo}
                      onChange={(e) => {
                        setTaskDueDateTo(e.target.value);
                        setTaskPage(1);
                      }}
                      className="bg-slate-900 border border-slate-700/80 rounded px-1.5 py-0.5 text-slate-200 text-[10px] focus:outline-none focus:border-cyan-500"
                      title="Due Date To"
                    />
                    {(taskDueDateFrom || taskDueDateTo) && (
                      <button
                        id="btn-clear-date-filter"
                        onClick={() => {
                          setTaskDueDateFrom('');
                          setTaskDueDateTo('');
                          setTaskPage(1);
                        }}
                        className="text-[10px] text-cyan-400 hover:text-cyan-300 ml-1 font-semibold"
                        title="Clear date range"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Task Error Message */}
            {taskError && (
              <div className="p-4 bg-rose-950/50 border border-rose-800 rounded-xl flex items-center space-x-3 text-xs text-rose-300">
                <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                <span>{taskError}</span>
              </div>
            )}

            {/* Task Grid / Empty State / Loading State */}
            {loadingTasks ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-64 animate-pulse space-y-4">
                    <div className="flex justify-between items-center">
                      <div className="w-24 h-4 bg-slate-800 rounded" />
                      <div className="w-16 h-4 bg-slate-800 rounded-full" />
                    </div>
                    <div className="w-3/4 h-5 bg-slate-800 rounded" />
                    <div className="w-full h-12 bg-slate-800 rounded" />
                    <div className="w-1/2 h-4 bg-slate-800 rounded" />
                  </div>
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 mx-auto">
                  <CheckSquare className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white">No Tasks Found</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {currentUser.role === 'employee'
                    ? 'No tasks assigned to you or matching the selected filters in your active projects.'
                    : taskSearchQuery || taskStatusFilter !== 'all' || taskPriorityFilter !== 'all' || taskOverdueFilter !== 'all'
                    ? 'No tasks match the active search and filter criteria.'
                    : 'Get started by creating your first task in an active project.'}
                </p>
                {isManagerOrAdmin && projects.length > 0 && !taskSearchQuery && taskStatusFilter === 'all' && (
                  <button
                    id="btn-create-first-task"
                    onClick={() => handleOpenCreateTaskModal()}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow transition-colors mt-2"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create First Task</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {tasks.map((task) => (
                    <TaskCard
                      key={task._id || task.taskId}
                      task={task}
                      currentUser={currentUser}
                      onView={handleOpenTaskDetailModal}
                      onEdit={handleOpenEditTaskModal}
                      onDelete={handleOpenDeleteTaskModal}
                      onStatusChange={handleQuickStatusChange}
                    />
                  ))}
                </div>

                {/* Pagination Controls */}
                {taskPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between bg-slate-900 border border-slate-800 px-4 py-3 rounded-xl text-xs">
                    <span className="text-slate-400">
                      Showing page <strong className="text-white">{taskPagination.page}</strong> of{' '}
                      <strong className="text-white">{taskPagination.totalPages}</strong> ({taskPagination.total} tasks total)
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        id="btn-prev-page"
                        disabled={!taskPagination.hasPrev}
                        onClick={() => setTaskPage((p) => Math.max(1, p - 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 font-medium flex items-center space-x-1"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        <span>Previous</span>
                      </button>
                      <button
                        id="btn-next-page"
                        disabled={!taskPagination.hasNext}
                        onClick={() => setTaskPage((p) => Math.min(taskPagination.totalPages, p + 1))}
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none text-slate-200 font-medium flex items-center space-x-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        initialMode={authModalMode}
        onClose={() => setAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
      />

      {/* Project Modals */}
      <ProjectModal
        isOpen={projectModalOpen}
        projectToEdit={projectToEdit}
        onClose={() => setProjectModalOpen(false)}
        onSaved={() => {
          fetchProjects();
          fetchDashboard();
        }}
      />

      <ProjectDetailModal
        isOpen={detailModalOpen}
        project={selectedProject}
        currentUser={currentUser}
        onClose={() => setDetailModalOpen(false)}
      />

      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        project={projectToDelete}
        onClose={() => setDeleteModalOpen(false)}
        onDeleted={() => {
          fetchProjects();
          fetchDashboard();
        }}
      />

      {/* Task Modals */}
      <TaskModal
        isOpen={taskModalOpen}
        taskToEdit={taskToEdit}
        projects={projects}
        currentUser={currentUser}
        onClose={() => setTaskModalOpen(false)}
        onSuccess={() => {
          fetchTasks();
          fetchDashboard();
        }}
      />

      <TaskDetailModal
        isOpen={taskDetailModalOpen}
        task={selectedTask}
        currentUser={currentUser}
        onClose={() => setTaskDetailModalOpen(false)}
        onTaskUpdated={(updated) => {
          setSelectedTask(updated);
          fetchTasks();
          fetchDashboard();
        }}
      />

      <TaskDeleteConfirmModal
        isOpen={taskDeleteModalOpen}
        task={taskToDelete}
        onClose={() => setTaskDeleteModalOpen(false)}
        onDeleted={() => {
          fetchTasks();
          fetchDashboard();
        }}
      />
    </div>
  );
}

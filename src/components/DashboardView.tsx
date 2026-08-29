import React from 'react';
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Users,
  TrendingUp,
  Layers,
  ArrowUpRight,
  Shield,
  Activity,
  CheckSquare,
  BarChart3,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { DashboardResponse, UserSummary, ProjectItem, TaskItem } from '../types/index.ts';

interface DashboardViewProps {
  data: DashboardResponse | null;
  loading: boolean;
  error: string | null;
  currentUser: UserSummary | null;
  onRefresh: () => void;
  onNavigateToProjects: () => void;
  onNavigateToTasks: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  data,
  loading,
  error,
  currentUser,
  onRefresh,
  onNavigateToProjects,
  onNavigateToTasks,
}) => {
  if (loading && !data) {
    return (
      <div className="space-y-6">
        {/* KPI Skeleton Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 h-28 animate-pulse space-y-3"
            >
              <div className="w-1/2 h-3.5 bg-slate-800 rounded" />
              <div className="w-3/4 h-7 bg-slate-800 rounded" />
            </div>
          ))}
        </div>

        {/* Content Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-6 h-80 animate-pulse space-y-4">
            <div className="w-1/3 h-5 bg-slate-800 rounded" />
            <div className="w-full h-12 bg-slate-800 rounded" />
            <div className="w-full h-12 bg-slate-800 rounded" />
            <div className="w-full h-12 bg-slate-800 rounded" />
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 h-80 animate-pulse space-y-4">
            <div className="w-1/2 h-5 bg-slate-800 rounded" />
            <div className="w-full h-14 bg-slate-800 rounded" />
            <div className="w-full h-14 bg-slate-800 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-950/40 border border-rose-800/80 rounded-xl p-8 text-center space-y-4 shadow-lg">
        <div className="w-12 h-12 rounded-full bg-rose-900/60 border border-rose-700 flex items-center justify-center text-rose-300 mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-white">Unable to Load Dashboard Analytics</h3>
          <p className="text-xs text-rose-300/90 mt-1 max-w-md mx-auto">{error}</p>
        </div>
        <button
          onClick={onRefresh}
          className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-rose-900 hover:bg-rose-800 border border-rose-700 text-xs font-semibold text-white transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Retry Loading</span>
        </button>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { metrics, employeeWorkload, projectProgress, overdueTasksList } = data;
  const isEmployee = currentUser?.role === 'employee';

  return (
    <div className="space-y-6">
      {/* 1. Dashboard KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total Projects */}
        <div
          id="kpi-total-projects"
          onClick={onNavigateToProjects}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4.5 cursor-pointer transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Projects</span>
            <div className="p-2 rounded-lg bg-indigo-950/60 border border-indigo-800/60 text-indigo-400 group-hover:scale-105 transition-transform">
              <FolderKanban className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.projects.total}</span>
            <span className="text-[11px] text-indigo-400 font-medium flex items-center">
              View all <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {isEmployee ? 'Accessible project workspaces' : 'Across all company units'}
          </p>
        </div>

        {/* KPI 2: Active Projects */}
        <div
          id="kpi-active-projects"
          onClick={onNavigateToProjects}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4.5 cursor-pointer transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Active Projects</span>
            <div className="p-2 rounded-lg bg-blue-950/60 border border-blue-800/60 text-blue-400 group-hover:scale-105 transition-transform">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.projects.active}</span>
            <span className="text-[11px] text-blue-400 font-medium">In execution</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.projects.planned} planned &middot; {metrics.projects.cancelled} cancelled
          </p>
        </div>

        {/* KPI 3: Completed Projects */}
        <div
          id="kpi-completed-projects"
          onClick={onNavigateToProjects}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4.5 cursor-pointer transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Completed Projects</span>
            <div className="p-2 rounded-lg bg-emerald-950/60 border border-emerald-800/60 text-emerald-400 group-hover:scale-105 transition-transform">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.projects.completed}</span>
            <span className="text-[11px] text-emerald-400 font-medium">Delivered</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Successfully fulfilled</p>
        </div>

        {/* KPI 4: Pending Tasks */}
        <div
          id="kpi-pending-tasks"
          onClick={onNavigateToTasks}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4.5 cursor-pointer transition-all shadow-sm group relative overflow-hidden"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Pending Tasks</span>
            <div className="p-2 rounded-lg bg-cyan-950/60 border border-cyan-800/60 text-cyan-400 group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white tracking-tight">{metrics.tasks.pending}</span>
            <span className="text-[11px] text-cyan-400 font-medium flex items-center">
              {metrics.tasks.total} total <ArrowUpRight className="w-3 h-3 ml-0.5" />
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {metrics.tasks.byStatus.todo} todo &middot; {metrics.tasks.byStatus.in_progress} in progress
          </p>
        </div>

        {/* KPI 5: Overdue Tasks */}
        <div
          id="kpi-overdue-tasks"
          onClick={onNavigateToTasks}
          className={`bg-slate-900 border rounded-xl p-4.5 cursor-pointer transition-all shadow-sm group relative overflow-hidden ${
            metrics.tasks.overdue > 0
              ? 'border-rose-800/80 bg-rose-950/20 hover:border-rose-700'
              : 'border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className={`text-xs font-medium ${metrics.tasks.overdue > 0 ? 'text-rose-300' : 'text-slate-400'}`}>
              Overdue Tasks
            </span>
            <div
              className={`p-2 rounded-lg border group-hover:scale-105 transition-transform ${
                metrics.tasks.overdue > 0
                  ? 'bg-rose-950/80 border-rose-700 text-rose-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline justify-between">
            <span
              className={`text-2xl font-bold tracking-tight ${
                metrics.tasks.overdue > 0 ? 'text-rose-400' : 'text-white'
              }`}
            >
              {metrics.tasks.overdue}
            </span>
            <span
              className={`text-[11px] font-medium ${
                metrics.tasks.overdue > 0 ? 'text-rose-400' : 'text-slate-500'
              }`}
            >
              {metrics.tasks.overdue > 0 ? 'Requires attention' : 'All on track'}
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Excludes completed tasks</p>
        </div>
      </div>

      {/* 2. Main Analytics Sections: Project Progress & Employee Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Project Progress Section (Col span 7 on desktop) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-indigo-950/80 text-indigo-400 border border-indigo-800/60">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Project Completion Progress</h3>
                <p className="text-[11px] text-slate-400">
                  Calculated from verified task completions: (completed / total tasks) × 100
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateToProjects}
              className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center space-x-1"
            >
              <span>All Projects</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {projectProgress.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Layers className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No active projects available for progress computation.</p>
            </div>
          ) : (
            <div className="space-y-3.5 max-h-[380px] overflow-y-auto pr-1">
              {projectProgress.map((proj) => (
                <div
                  key={proj._id}
                  id={`project-progress-${proj.projectId}`}
                  className="bg-slate-950/60 border border-slate-800/90 hover:border-slate-700/90 rounded-lg p-3.5 transition-colors space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-xs font-semibold text-white truncate">{proj.name}</h4>
                        <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {proj.projectId}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {proj.teamMembersCount} team {proj.teamMembersCount === 1 ? 'member' : 'members'} &middot; Status:{' '}
                        <span className="capitalize font-medium text-slate-300">{proj.status}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-white">{proj.progress}%</span>
                      <p className="text-[10px] text-slate-400">
                        {proj.completedTasks}/{proj.totalTasks} tasks
                      </p>
                    </div>
                  </div>

                  {/* Visual Progress Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden flex">
                    <div
                      className={`h-full transition-all duration-500 rounded-full ${
                        proj.progress === 100
                          ? 'bg-emerald-500'
                          : proj.progress >= 50
                          ? 'bg-indigo-500'
                          : proj.progress > 0
                          ? 'bg-cyan-500'
                          : 'bg-slate-700'
                      }`}
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                    <span>
                      Pending: <strong className="text-slate-400">{proj.pendingTasks}</strong>
                    </span>
                    {proj.overdueTasks > 0 ? (
                      <span className="text-rose-400 font-semibold flex items-center space-x-1">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{proj.overdueTasks} overdue</span>
                      </span>
                    ) : (
                      <span className="text-emerald-400">0 overdue</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Employee Workload Section (Col span 5 on desktop) */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-lg bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Employee Workload</h3>
                <p className="text-[11px] text-slate-400">Real-time task distribution & assignments</p>
              </div>
            </div>
            <span className="text-[11px] text-slate-400 font-mono">
              {employeeWorkload.length} {employeeWorkload.length === 1 ? 'member' : 'members'}
            </span>
          </div>

          {employeeWorkload.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Users className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">No employee records or task assignments found.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
              {employeeWorkload.map((emp) => {
                const isCurrentUser = currentUser?.email === emp.user.email;
                return (
                  <div
                    key={emp.user._id}
                    id={`workload-user-${emp.user.userId}`}
                    className={`border rounded-lg p-3 transition-colors ${
                      isCurrentUser
                        ? 'bg-indigo-950/20 border-indigo-800/80'
                        : 'bg-slate-950/60 border-slate-800/90 hover:border-slate-700/90'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-300 shrink-0 uppercase">
                          {emp.user.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-semibold text-white truncate">{emp.user.name}</span>
                            {isCurrentUser && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-600/60 text-indigo-200 border border-indigo-500/40">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 truncate">
                            {emp.user.role} {emp.user.department ? `&middot; ${emp.user.department}` : ''}
                          </p>
                        </div>
                      </div>

                      {/* Total Assigned Badge */}
                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold text-white">{emp.totalAssigned}</span>
                        <span className="text-[10px] text-slate-400 block">assigned</span>
                      </div>
                    </div>

                    {/* Task Breakdown Chips */}
                    <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-800/60 text-center text-[10px]">
                      <div className="bg-slate-900/80 rounded py-1 border border-slate-800">
                        <span className="text-slate-400 block">Pending</span>
                        <span className="font-semibold text-cyan-400">{emp.pendingTasks}</span>
                      </div>
                      <div className="bg-slate-900/80 rounded py-1 border border-slate-800">
                        <span className="text-slate-400 block">Completed</span>
                        <span className="font-semibold text-emerald-400">{emp.completedTasks}</span>
                      </div>
                      <div className="bg-slate-900/80 rounded py-1 border border-slate-800">
                        <span className="text-slate-400 block">Overdue</span>
                        <span className={`font-semibold ${emp.overdueTasks > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                          {emp.overdueTasks}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 3. Overdue Urgent Tasks List */}
      {overdueTasksList.length > 0 && (
        <div className="bg-slate-900 border border-rose-900/60 rounded-xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-rose-400">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <h3 className="text-sm font-semibold text-white">Immediate Attention: Overdue Tasks</h3>
            </div>
            <button
              onClick={onNavigateToTasks}
              className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center space-x-1"
            >
              <span>View in Task Hub</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {overdueTasksList.map((task) => (
              <div
                key={task._id}
                className="bg-slate-950/80 border border-rose-900/40 rounded-lg p-3 space-y-2 hover:border-rose-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-semibold text-white line-clamp-1">{task.title}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 uppercase font-mono shrink-0">
                    {task.priority}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}</span>
                  <span className="text-rose-400 font-medium">
                    {task.assignedTo ? task.assignedTo.name : 'Unassigned'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

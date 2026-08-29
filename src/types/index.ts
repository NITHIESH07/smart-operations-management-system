export type UserRole = 'admin' | 'manager' | 'employee';

export type ProjectStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface UserSummary {
  _id: string;
  userId: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProjectItem {
  _id: string;
  projectId: string;
  name: string;
  description?: string;
  startDate?: string;
  deadline?: string;
  status: ProjectStatus;
  teamMembers: UserSummary[];
  createdAt: string;
  updatedAt: string;
}

export type TaskPriority = 'low' | 'medium' | 'high' | 'critical';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';

export interface TaskComment {
  _id?: string;
  userId: UserSummary | { _id: string; userId: string; name: string; email: string; role: UserRole };
  text: string;
  timestamp: string;
}

export interface TaskItem {
  _id: string;
  taskId: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  assignedTo?: UserSummary;
  projectId: {
    _id: string;
    projectId: string;
    name: string;
    status?: ProjectStatus;
    deadline?: string;
    teamMembers?: (string | UserSummary)[];
  };
  dueDate?: string;
  isOverdue?: boolean;
  comments: TaskComment[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ActivityItem {
  _id: string;
  userId: UserSummary | string;
  action: string;
  entity: string;
  previousValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  timestamp: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  database?: {
    connected: boolean;
    state: string;
    host?: string;
    name?: string;
    models?: string[];
  };
  timestamp: string;
}

export interface EmployeeWorkloadItem {
  user: {
    _id: string;
    userId: string;
    name: string;
    email: string;
    role: UserRole;
    department?: string;
  };
  totalAssigned: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
}

export interface ProjectProgressItem {
  _id: string;
  projectId: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  startDate?: string;
  deadline?: string;
  teamMembers: UserSummary[];
  teamMembersCount: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  overdueTasks: number;
  progress: number;
}

export interface DashboardMetrics {
  projects: {
    total: number;
    active: number;
    completed: number;
    planned: number;
    cancelled: number;
  };
  tasks: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
    byStatus: {
      todo: number;
      in_progress: number;
      review: number;
      completed: number;
      blocked: number;
    };
    byPriority: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
}

export interface DashboardResponse {
  metrics: DashboardMetrics;
  employeeWorkload: EmployeeWorkloadItem[];
  projectProgress: ProjectProgressItem[];
  overdueTasksList: TaskItem[];
  role: UserRole;
  generatedAt: string;
}


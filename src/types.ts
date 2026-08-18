export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  skills?: string[];
  rolePrefix?: string;
  status?: string;
  permissions?: Record<string, boolean>;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  deadline: string;
  assigneeId: string | null;
  creatorId: string;
  branchName: string | null;
  prUrl?: string | null;
  prStatus?: 'open' | 'merged' | 'closed' | null;
  createdAt: string;
  parentId?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  dependencies?: string[];
  orderIndex?: number;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  projectKey?: string;
  taskCounter?: number;
  createdAt: string;
  repoProvider?: 'github' | 'gitlab' | null;
  repoOwner?: string | null;
  repoName?: string | null;
  repoUrl?: string | null;
  repoToken?: string | null;
  defaultBranch?: string | null;
}

export interface GitBranch {
  name: string;
  commitSha?: string;
  commitMessage?: string;
  protected?: boolean;
  webUrl?: string;
  isDefault?: boolean;
  linkedTaskId?: string;
  linkedTaskTitle?: string;
}

export interface GitPullRequest {
  id: number | string;
  title: string;
  sourceBranch: string;
  targetBranch: string;
  status: 'open' | 'merged' | 'closed';
  webUrl: string;
  author?: string;
  createdAt?: string;
}

export interface Document {
  id: string;
  projectId: string;
  title: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  name: string;
  description: string;
  startDate?: string;
  endDate?: string;
  status: 'pending' | 'active' | 'completed';
  createdAt: string;
}

export interface Team {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  createdAt: string;
  projectId?: string;
}

export interface TeamMember extends User {
  teamId: string;
  joinedAt: string;
}

export interface ProjectMember extends User {
  projectId: string;
  role: string;
  joinedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string;
  content: string;
  createdAt: string;
  user?: User; // added on client side
}

export interface TaskActivity {
  id: string;
  taskId: string;
  userId: string;
  action: string; // e.g. 'created', 'status_changed', 'commented'
  createdAt: string;
  user?: User; // added on client side
}

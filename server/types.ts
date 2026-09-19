export interface DatabaseWrapper {
  isPg: boolean;
  exec(sql: string): Promise<void>;
  run(sql: string, params?: any | any[]): Promise<void>;
  get(sql: string, params?: any | any[]): Promise<any>;
  all(sql: string, params?: any | any[]): Promise<any[]>;
  transaction<T>(callback: (tx: DatabaseWrapper) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "super_admin" | "admin" | "manager" | "developer" | string;
  skills?: string;
  rolePrefix?: string;
  status?: string;
  emailVerified?: boolean | number;
  tokenVersion?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done" | string;
  priority: "low" | "medium" | "high" | "urgent" | string;
  deadline: string;
  assigneeId: string | null;
  creatorId: string;
  branchName: string | null;
  parentId?: string | null;
  projectId?: string | null;
  milestoneId?: string | null;
  createdAt: string;
  orderIndex?: number;
  prUrl?: string | null;
  prStatus?: string | null;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  permissions?: Record<string, boolean>;
  isSystem?: boolean;
}

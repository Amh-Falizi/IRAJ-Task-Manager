import { Request, Response, NextFunction } from "express";

export interface DatabaseWrapper {
  isPg: boolean;
  exec(sql: string): Promise<void>;
  run(sql: string, params?: any | any[]): Promise<void>;
  get<T = any>(sql: string, params?: any | any[]): Promise<T | undefined>;
  all<T = any>(sql: string, params?: any | any[]): Promise<T[]>;
  transaction<T>(callback: (tx: DatabaseWrapper) => Promise<T>): Promise<T>;
  close?(): Promise<void>;
}

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: "super_admin" | "admin" | "manager" | "developer" | "viewer" | string;
  skills?: string;
  rolePrefix?: string;
  status?: string;
  emailVerified?: boolean | number;
  tokenVersion?: number;
}

export interface AuthRequest<P = any, ResBody = any, ReqBody = any, ReqQuery = any>
  extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: AuthenticatedUser;
  rawBody?: Buffer;
}

export interface User extends AuthenticatedUser {
  passwordHash: string;
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

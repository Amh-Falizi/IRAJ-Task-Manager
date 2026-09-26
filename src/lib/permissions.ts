import { User } from '../types';

/**
 * Checks if the current user has a given permission.
 * Resolves permissions from the user's granular permissions map,
 * with super_admin having unconditional access and safe fallbacks for legacy/default roles.
 */
export function can(user: User | null | undefined, permission: string): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;

  if (user.permissions && typeof user.permissions[permission] === 'boolean') {
    return user.permissions[permission];
  }

  // Canonical role fallbacks matching database migrations and server middleware
  switch (permission) {
    case 'manage_users':
    case 'manage_roles':
    case 'reset_database':
      return user.role === 'super_admin';
    case 'manage_teams':
    case 'manage_projects':
    case 'edit_all_tasks':
    case 'delete_tasks':
      return user.role === 'admin' || user.role === 'manager';
    case 'create_tasks':
      return user.role !== 'viewer' && user.role !== 'designer';
    default:
      return false;
  }
}

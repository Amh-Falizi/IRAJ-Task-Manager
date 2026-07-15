import React from 'react';
import { cn, getUserColor } from '../lib/utils';
import { User } from '../types';
import { Tooltip } from './Tooltip';

interface UserAvatarProps {
  user: User | { name: string; email?: string; status?: string } | string | null | undefined;
  className?: string;
  showTooltip?: boolean;
}

const getStatusColor = (status: string | undefined) => {
  if (!status) return "";
  switch (status.toLowerCase()) {
    case "available": return "bg-green-500";
    case "busy": return "bg-red-500";
    case "away": return "bg-yellow-500";
    case "offline": return "bg-gray-500";
    case "in a meeting": return "bg-purple-500";
    case "on vacation": return "bg-blue-500";
    default: return "";
  }
};

export default function UserAvatar({ user, className, showTooltip = true }: UserAvatarProps) {
  if (!user) {
    return (
      <div className={cn("w-8 h-8 rounded-full bg-surface-dim border border-border-subtle flex items-center justify-center text-xs font-bold text-subtle shrink-0", className)}>
        ?
      </div>
    );
  }

  const name = typeof user === 'string' ? user : user.name;
  const initial = name ? name.charAt(0).toUpperCase() : '?';
  const colorClass = getUserColor(name);

  const userStatus = typeof user === 'object' && user !== null && 'status' in user ? (user as any).status : undefined;
  const dotColor = getStatusColor(userStatus);

  return (
    <div className="relative inline-block shrink-0">
      <div 
        className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm", colorClass, className)}
        title={showTooltip ? (userStatus ? `${name} (${userStatus})` : name) : undefined}
      >
        {initial}
      </div>
      {dotColor && (
        <Tooltip content={`Status: ${userStatus || "Available"}`} position="top">
          <span 
            className={cn(
              "absolute bottom-0 right-0 block w-2.5 h-2.5 rounded-full ring-2 ring-surface shadow-xs cursor-pointer hover:scale-110 transition-transform",
              dotColor
            )} 
          />
        </Tooltip>
      )}
    </div>
  );
}

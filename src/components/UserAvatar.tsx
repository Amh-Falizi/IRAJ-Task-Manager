import React from 'react';
import { cn, getUserColor } from '../lib/utils';
import { User } from '../types';
import { Tooltip } from './Tooltip';

interface UserAvatarProps {
  user: User | { name: string; email?: string } | string | null | undefined;
  className?: string;
  showTooltip?: boolean;
}

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

  const avatar = (
    <div 
      className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm", colorClass, className)}
    >
      {initial}
    </div>
  );

  if (showTooltip && name) {
    return (
      <Tooltip content={name} position="top" asChild>
        {avatar}
      </Tooltip>
    );
  }

  return avatar;
}

import React from 'react';
import { HelpCircle, Info } from 'lucide-react';
import { cn } from '../lib/utils';

interface TooltipProps {
  children?: React.ReactNode;
  content: string | React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, className, icon, position = 'top' }: TooltipProps) {
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div className={cn("relative group inline-flex items-center justify-center", className)}>
      {children || icon || <HelpCircle size={16} className="text-muted hover:text-strong transition-colors cursor-help" />}
      
      <div className={cn(
        "absolute z-50 hidden group-hover:block w-64 p-2 text-xs font-medium text-strong bg-surface border border-border-subtle rounded-md shadow-lg pointer-events-none fade-in-0 animate-in",
        positionClasses[position]
      )}>
        {content}
      </div>
    </div>
  );
}

export function HelpIcon({ text, className }: { text: string, className?: string }) {
  return (
    <Tooltip content={text} className={className} position="top" />
  );
}

import React from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { HelpCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={150}>{children}</TooltipPrimitive.Provider>;
}

interface TooltipProps {
  children?: React.ReactNode;
  content: string | React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export function Tooltip({ children, content, className, icon, position = 'top' }: TooltipProps) {
  if (!content) {
    if (children) {
      return <>{children}</>;
    }
    return (
      <span className={cn("inline-flex items-center justify-center", className)}>
        {icon || <HelpCircle size={16} className="text-muted" />}
      </span>
    );
  }

  return (
    <TooltipPrimitive.Root>
      {children ? (
        <TooltipPrimitive.Trigger asChild>
          {React.isValidElement(children) ? (
            children
          ) : (
            <span className={className}>{children}</span>
          )}
        </TooltipPrimitive.Trigger>
      ) : (
        <TooltipPrimitive.Trigger asChild>
          <span className={cn("inline-flex items-center justify-center", className)}>
            {icon || <HelpCircle size={16} className="text-muted hover:text-strong transition-colors cursor-help" />}
          </span>
        </TooltipPrimitive.Trigger>
      )}
      {content && (
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side={position}
            align="center"
            sideOffset={5}
            className={cn(
              "z-50 overflow-hidden rounded-md border border-border-subtle bg-surface px-3 py-1.5 text-xs text-strong shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
            )}
          >
            {content}
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      )}
    </TooltipPrimitive.Root>
  );
}

export function HelpIcon({ text, className }: { text: string, className?: string }) {
  return (
    <Tooltip content={text} className={className} position="top" />
  );
}


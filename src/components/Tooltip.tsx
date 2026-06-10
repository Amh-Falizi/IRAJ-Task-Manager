import React from 'react';
import { HelpCircle } from 'lucide-react';
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '../lib/utils';

export interface TooltipProps {
  children?: React.ReactNode;
  content: string | React.ReactNode;
  className?: string;
  icon?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  asChild?: boolean;
}

export function Tooltip({ children, content, className, icon, position = 'top', asChild = false }: TooltipProps) {
  return (
    <RadixTooltip.Root delayDuration={200}>
      <RadixTooltip.Trigger asChild={asChild} className={cn("inline-flex items-center justify-center cursor-help", className)}>
        {children || icon || <HelpCircle size={16} className="text-muted hover:text-strong transition-colors" />}
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={position}
          sideOffset={5}
          className="z-[1000] max-w-[250px] px-3 py-2 text-xs font-medium text-strong bg-surface border border-border-subtle rounded-md shadow-lg animate-in fade-in-0 break-words"
          collisionPadding={10}
        >
          {content}
          <RadixTooltip.Arrow className="fill-surface" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export function HelpIcon({ text, className }: { text: string, className?: string }) {
  return (
    <Tooltip content={text} className={className} position="top" />
  );
}

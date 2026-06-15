import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actionText, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center h-full min-h-[200px] p-6 text-center", className)}>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="bg-surface-accent/20 p-4 rounded-full mb-4 mx-auto w-16 h-16 flex items-center justify-center">
          <Icon className="w-8 h-8 text-muted" />
        </div>
        <h3 className="text-sm font-bold text-strong mb-2">{title}</h3>
        <p className="text-xs text-subtle max-w-[250px] mx-auto mb-6 leading-relaxed">
          {description}
        </p>
        {actionText && onAction && (
          <button
            onClick={onAction}
            className="px-4 py-2 bg-surface text-strong border border-border-subtle rounded text-xs font-bold hover:bg-surface-accent transition-colors shadow-sm"
          >
            {actionText}
          </button>
        )}
      </motion.div>
    </div>
  );
}

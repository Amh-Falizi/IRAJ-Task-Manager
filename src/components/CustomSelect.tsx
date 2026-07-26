import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export interface CustomSelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  options: CustomSelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  dropdownClassName?: string;
  size?: 'sm' | 'md' | 'xs';
  align?: 'left' | 'right';
  variant?: 'default' | 'borderless';
}

export default function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select...',
  disabled = false,
  className,
  dropdownClassName,
  size = 'md',
  align = 'left',
  variant = 'default',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value);

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  // Define size classes
  const sizeClasses = {
    xs: 'px-2 py-1 text-[10px] rounded',
    sm: 'px-2.5 py-1.5 text-xs rounded-md',
    md: 'px-3 py-2 text-sm rounded-md',
  };

  const listPaddingClasses = {
    xs: 'py-0.5',
    sm: 'py-1',
    md: 'py-1',
  };

  const optionPaddingClasses = {
    xs: 'px-2 py-1 text-[10px]',
    sm: 'px-2.5 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
  };

  return (
    <div 
      className={cn('relative inline-block w-full text-left', className)} 
      ref={containerRef}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={toggleDropdown}
        className={cn(
          'flex items-center justify-between w-full font-sans cursor-pointer text-left transition-all duration-150 focus:outline-none',
          variant === 'default' 
            ? cn('bg-surface border border-border-subtle text-strong hover:border-blue-500/50', sizeClasses[size], isOpen && 'border-blue-500 shadow-sm shadow-blue-500/10')
            : 'bg-transparent border-none text-strong hover:text-blue-400 p-0 font-bold uppercase tracking-wider',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        <span className="flex items-center gap-2 truncate pr-2">
          {selectedOption?.icon}
          <span className={cn(selectedOption ? 'text-strong font-medium' : 'text-muted font-normal')}>
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </span>
        <ChevronDown 
          size={size === 'xs' ? 12 : size === 'sm' ? 14 : 16} 
          className={cn(
            'text-muted transition-transform duration-200 shrink-0', 
            isOpen && 'transform rotate-180 text-blue-500'
          )} 
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.1, ease: 'easeOut' }}
            className={cn(
              'absolute z-[9999] min-w-full w-max max-w-[320px] bg-surface border border-border-strong rounded-lg shadow-xl mt-1.5 max-h-60 overflow-y-auto no-scrollbar focus:outline-none',
              align === 'right' ? 'right-0' : 'left-0',
              listPaddingClasses[size],
              dropdownClassName
            )}
          >
            {options.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted text-center italic">No options available</div>
            ) : (
              options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleSelect(option.value)}
                    className={cn(
                      'flex items-center justify-between w-full text-left font-sans cursor-pointer transition-colors duration-100 first-of-type:rounded-t-md last-of-type:rounded-b-md',
                      optionPaddingClasses[size],
                      isSelected 
                        ? 'bg-blue-500/10 text-blue-400 font-semibold' 
                        : 'text-muted hover:bg-surface-accent hover:text-strong'
                    )}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {option.icon}
                      <span className="truncate">{option.label}</span>
                    </span>
                    {isSelected && (
                      <Check 
                        size={size === 'xs' ? 10 : size === 'sm' ? 12 : 14} 
                        className="text-blue-400 shrink-0 ml-2" 
                      />
                    )}
                  </button>
                );
              })
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

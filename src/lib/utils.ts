import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow, isValid } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function safeFormatDate(dateVal: any, formatStr: string, fallback: string = 'N/A'): string {
  if (!dateVal) return fallback;
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (!isValid(d) || isNaN(d.getTime())) return fallback;
  try {
    return dateFnsFormat(d, formatStr);
  } catch (e) {
    return fallback;
  }
}

export function safeFormatDistanceToNow(dateVal: any, options?: any, fallback: string = 'recently'): string {
  if (!dateVal) return fallback;
  const d = dateVal instanceof Date ? dateVal : new Date(dateVal);
  if (!isValid(d) || isNaN(d.getTime())) return fallback;
  try {
    return dateFnsFormatDistanceToNow(d, options);
  } catch (e) {
    return fallback;
  }
}

const colors = [
  'bg-red-500', 'bg-orange-500', 'bg-amber-500', 'bg-green-500', 
  'bg-emerald-500', 'bg-teal-500', 'bg-cyan-500', 'bg-blue-500', 
  'bg-indigo-500', 'bg-violet-500', 'bg-purple-500', 'bg-fuchsia-500',
  'bg-pink-500', 'bg-rose-500'
];

const gradients = [
  'from-red-900 via-rose-900 to-red-900', 
  'from-orange-900 via-amber-900 to-orange-900', 
  'from-amber-900 via-yellow-900 to-amber-900', 
  'from-green-900 via-emerald-900 to-green-900', 
  'from-emerald-900 via-teal-900 to-emerald-900', 
  'from-teal-900 via-cyan-900 to-teal-900', 
  'from-cyan-900 via-blue-900 to-cyan-900', 
  'from-blue-900 via-indigo-900 to-blue-900', 
  'from-indigo-900 via-violet-900 to-indigo-900', 
  'from-violet-900 via-purple-900 to-violet-900', 
  'from-purple-900 via-fuchsia-900 to-purple-900', 
  'from-fuchsia-900 via-pink-900 to-fuchsia-900',
  'from-pink-900 via-rose-900 to-pink-900', 
  'from-rose-900 via-red-900 to-rose-900'
];

export function getUserColor(name: string) {
  if (!name) return colors[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function getUserGradient(name: string | undefined | null) {
  if (!name) return `bg-gradient-to-r ${gradients[0]}`;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return `bg-gradient-to-r ${gradients[Math.abs(hash) % gradients.length]}`;
}

/**
 * Detects if a branch name ends with a number (with optional separator like - or _)
 * and returns the incremented branch name.
 * e.g., 'wt-45' -> 'wt-46', 'fty-98' -> 'fty-99'
 */
export function getIncrementedBranchName(name: string): string | null {
  if (!name) return null;
  const match = name.trim().match(/^(.*?[-_]?)(\d+)$/);
  if (!match) return null;
  const prefix = match[1];
  const numStr = match[2];
  const nextNum = parseInt(numStr, 10) + 1;
  const nextNumStr = nextNum.toString().padStart(numStr.length, '0');
  return prefix + nextNumStr;
}

/**
 * Scans list of existing branch names, finds patterns ending with numbers,
 * groups them by prefix, and returns the next incremented suggestion for each prefix.
 */
export function getBranchSuggestions(existingBranches: string[]): string[] {
  if (!existingBranches || existingBranches.length === 0) return [];
  const maxNumbers: Record<string, { max: number; originalNumStr: string }> = {};

  for (const branch of existingBranches) {
    if (!branch) continue;
    const match = branch.trim().match(/^(.*?[-_]?)(\d+)$/);
    if (match) {
      const prefix = match[1];
      const numStr = match[2];
      const num = parseInt(numStr, 10);
      if (!(prefix in maxNumbers) || num > maxNumbers[prefix].max) {
        maxNumbers[prefix] = { max: num, originalNumStr: numStr };
      }
    }
  }

  const suggestions: string[] = [];
  for (const [prefix, val] of Object.entries(maxNumbers)) {
    // Avoid generating suggestion if prefix is empty and it's just a raw number
    if (!prefix.trim()) continue;
    const nextNum = val.max + 1;
    const nextNumStr = nextNum.toString().padStart(val.originalNumStr.length, '0');
    suggestions.push(prefix + nextNumStr);
  }

  return suggestions;
}


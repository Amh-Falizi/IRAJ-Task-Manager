import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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

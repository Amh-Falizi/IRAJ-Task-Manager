import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LayoutDashboard, FolderKanban, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function WelcomeModal() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Only show if the user is authenticated
    if (!user) return;
    
    const hasSeen = localStorage.getItem(`has_seen_welcome_${user.id}`);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, [user]);

  const handleClose = () => {
    setIsOpen(false);
    if (user) {
      localStorage.setItem(`has_seen_welcome_${user.id}`, 'true');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-y-0 right-0 left-0 md:left-[var(--sidebar-width,80px)] z-[100] overflow-y-auto flex justify-center items-start p-4 transition-all duration-300">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="my-auto bg-surface border border-border-subtle rounded-2xl shadow-xl max-w-lg w-full overflow-hidden relative z-10"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold text-strong tracking-tight">Welcome to the Workspace! 🎉</h2>
                <button
                  onClick={handleClose}
                  className="p-1 hover:bg-surface-accent rounded-md text-muted hover:text-strong transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-subtle text-sm mb-8 leading-relaxed">
                We're thrilled to have you here. This platform is designed to help you organize your tasks, collaborate with your team, and track your progress smoothly.
              </p>
              
              <div className="space-y-6 mb-8">
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-500/10 text-blue-500 p-3 rounded-xl shrink-0">
                    <LayoutDashboard size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-strong mb-1">Your Dashboard</h3>
                    <p className="text-xs text-muted leading-relaxed">Get a personal overview of your tasks, recent documents, and overall performance statistics in one place.</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-4">
                  <div className="bg-emerald-500/10 text-emerald-500 p-3 rounded-xl shrink-0">
                    <FolderKanban size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-strong mb-1">Projects & Boards</h3>
                    <p className="text-xs text-muted leading-relaxed">Create projects, use kanban boards to track task status, and manage milestones inside planning view.</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="bg-purple-500/10 text-purple-500 p-3 rounded-xl shrink-0">
                    <Users size={24} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-strong mb-1">Teams & Collaboration</h3>
                    <p className="text-xs text-muted leading-relaxed">Invite team members to projects, mention them in task comments, and share documents effortlessly.</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4 pt-4 border-t border-border-subtle">
                <button
                  onClick={handleClose}
                  className="bg-blue-600 outline-none focus:ring-2 focus:ring-blue-500/50 text-white px-6 py-2.5 rounded-lg text-sm font-bold hover:bg-blue-500 transition-colors shadow-sm"
                >
                  Let's Get Started
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

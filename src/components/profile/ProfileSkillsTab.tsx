import React from "react";
import { Code, Plus, X } from "lucide-react";

interface SkillItem {
  id: string;
  name: string;
}

interface ProfileSkillsTabProps {
  skills: SkillItem[];
  newSkill: string;
  setNewSkill: (val: string) => void;
  handleAddSkill: (e: React.FormEvent) => void;
  handleRemoveSkill: (id: string) => void;
}

export const ProfileSkillsTab: React.FC<ProfileSkillsTabProps> = ({
  skills,
  newSkill,
  setNewSkill,
  handleAddSkill,
  handleRemoveSkill,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-border-subtle bg-surface-dim/30 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code size={18} className="text-subtle" />
            <h3 className="text-xs font-bold text-strong uppercase tracking-widest">
              Skills & Expertise
            </h3>
          </div>
        </div>
        <div className="p-6">
          <form onSubmit={handleAddSkill} className="flex gap-2 mb-6">
            <input
              type="text"
              value={newSkill}
              onChange={(e) => setNewSkill(e.target.value)}
              placeholder="Add a new skill (e.g., GraphQL, Kubernetes)"
              className="flex-1 bg-surface-dim border border-border-subtle rounded p-2 text-sm text-strong focus:outline-none focus:border-blue-500 transition-colors"
            />
            <button
              type="submit"
              disabled={!newSkill.trim()}
              className="bg-blue-600 text-white p-2 rounded-md shadow hover:bg-blue-500 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-1 text-xs font-bold uppercase tracking-wider px-3"
            >
              <Plus size={16} />
              <span>Add</span>
            </button>
          </form>

          <div className="flex flex-wrap gap-2">
            {skills.length > 0 ? (
              skills.map((skill) => (
                <span
                  key={skill.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-surface-dim border border-border-subtle text-strong shadow-sm hover:border-blue-500/50 transition-colors"
                >
                  <span>{skill.name}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveSkill(skill.id)}
                    className="text-subtle hover:text-red-400 transition-colors p-0.5"
                    title={`Remove ${skill.name}`}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))
            ) : (
              <p className="text-xs text-muted italic">
                No skills added yet. Add skills to help teammates identify your technical strengths.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default ProfileSkillsTab;

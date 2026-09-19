import React from 'react';
import { TaskComment, User } from '../../types';
import { safeFormatDate } from '../../lib/utils';
import { Edit2, Trash } from 'lucide-react';
import Markdown from 'react-markdown';

export interface TaskCommentsThreadProps {
  comments: TaskComment[];
  users: User[];
  currentUserId?: string;
  currentUserRole?: string;
  newComment: string;
  setNewComment: (val: string) => void;
  newCommentPreviewMode: boolean;
  setNewCommentPreviewMode: (val: boolean) => void;
  editingCommentId: string | null;
  setEditingCommentId: (val: string | null) => void;
  editCommentContent: string;
  setEditCommentContent: (val: string) => void;
  editCommentPreviewMode: boolean;
  setEditCommentPreviewMode: (val: boolean) => void;
  handleCreateComment: () => void;
  handleEditComment: (commentId: string) => void;
  handleDeleteComment: (commentId: string) => void;
}

export const TaskCommentsThread: React.FC<TaskCommentsThreadProps> = ({
  comments,
  users,
  currentUserId,
  currentUserRole,
  newComment,
  setNewComment,
  newCommentPreviewMode,
  setNewCommentPreviewMode,
  editingCommentId,
  setEditingCommentId,
  editCommentContent,
  setEditCommentContent,
  editCommentPreviewMode,
  setEditCommentPreviewMode,
  handleCreateComment,
  handleEditComment,
  handleDeleteComment
}) => {
  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex-1 overflow-y-auto space-y-3 min-h-[120px] max-h-[400px]">
        {comments.length > 0 ? (
          comments.map(c => {
            const author = users.find(u => u.id === c.userId);
            const isMe = c.userId === currentUserId;
            const canModify = isMe || currentUserRole === 'admin' || currentUserRole === 'super_admin';
            const isEditing = editingCommentId === c.id;

            return (
              <div key={c.id} className="bg-surface-dim border border-border-subtle p-3 rounded group">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold text-strong">{author ? author.name : 'Unknown'}</span>
                    <span className="text-[9px] text-subtle font-mono">{safeFormatDate(c.createdAt, 'MMM d, h:mm a')}</span>
                  </div>
                  {canModify && !isEditing && (
                    <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity space-x-1">
                      <button 
                        onClick={() => { setEditingCommentId(c.id); setEditCommentContent(c.content); }}
                        className="text-subtle hover:text-blue-400 p-0.5 rounded transition-colors"
                        title="Edit comment"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button 
                        onClick={() => handleDeleteComment(c.id)}
                        className="text-subtle hover:text-red-400 p-0.5 rounded transition-colors"
                        title="Delete comment"
                      >
                        <Trash size={12} />
                      </button>
                    </div>
                  )}
                </div>
                
                {isEditing ? (
                  <div className="space-y-2 mt-2 border-t border-border-subtle pt-2">
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">Edit Comment (Markdown)</label>
                      <div className="flex space-x-1 bg-surface-dim border border-border-subtle rounded p-0.5">
                        <button
                          type="button"
                          onClick={() => setEditCommentPreviewMode(false)}
                          className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${!editCommentPreviewMode ? 'bg-surface-accent text-strong' : 'text-subtle hover:text-strong'}`}
                        >
                          Edit View
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditCommentPreviewMode(true)}
                          className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${editCommentPreviewMode ? 'bg-surface-accent text-strong' : 'text-subtle hover:text-strong'}`}
                        >
                          Split View
                        </button>
                      </div>
                    </div>
                    <div className={`flex gap-2 ${editCommentPreviewMode ? 'h-32' : 'h-16'}`}>
                      <textarea
                        className={`bg-surface-dim border border-border-subtle rounded px-3 py-2 text-sm text-strong focus:outline-none focus:border-blue-500 font-mono resize-y min-h-[64px] h-full flex-1 ${editCommentPreviewMode ? 'w-1/2' : 'w-full'}`}
                        value={editCommentContent}
                        onChange={e => setEditCommentContent(e.target.value)}
                      />
                      {editCommentPreviewMode && (
                        <div className="w-1/2 overflow-y-auto prose dark:prose-invert prose-sm max-w-none p-2 rounded border border-border-subtle bg-surface-dim text-primary font-sans h-full">
                          {editCommentContent ? (
                            <Markdown skipHtml={true}>{editCommentContent}</Markdown>
                          ) : (
                            <span className="text-subtle italic">Preview...</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end space-x-2 mt-2">
                      <button 
                        onClick={() => setEditingCommentId(null)}
                        className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-strong px-2 py-1"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => handleEditComment(c.id)}
                        disabled={!editCommentContent.trim()}
                        className="text-[10px] font-bold uppercase tracking-widest bg-blue-600 hover:bg-blue-500 text-strong px-3 py-1 rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert prose-sm max-w-none text-primary">
                    <Markdown skipHtml={true}>{c.content}</Markdown>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-sm text-subtle italic p-4 text-center">No comments yet.</div>
        )}
      </div>
      <div className="mt-auto shrink-0 flex flex-col space-y-2 pt-4 border-t border-border-subtle">
        <div className="flex justify-between items-center mb-1">
          <label className="text-[9px] font-bold text-subtle uppercase tracking-widest block">New Comment (Markdown)</label>
          <div className="flex space-x-1 bg-surface-dim border border-border-subtle rounded p-0.5">
            <button
              type="button"
              onClick={() => setNewCommentPreviewMode(false)}
              className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${!newCommentPreviewMode ? 'bg-surface-accent text-strong' : 'text-subtle hover:text-strong'}`}
            >
              Edit View
            </button>
            <button
              type="button"
              onClick={() => setNewCommentPreviewMode(true)}
              className={`px-3 py-1 text-[9px] font-bold rounded-sm uppercase tracking-wider ${newCommentPreviewMode ? 'bg-surface-accent text-strong' : 'text-subtle hover:text-strong'}`}
            >
              Split View
            </button>
          </div>
        </div>
        <div className={`flex gap-2 ${newCommentPreviewMode ? 'h-32' : 'h-16'}`}>
          <textarea 
            className={`bg-surface-dim border border-border-subtle rounded px-3 py-2 text-sm text-strong resize-y min-h-[64px] focus:outline-none focus:border-blue-500 font-mono h-full flex-1 ${newCommentPreviewMode ? 'w-1/2' : 'w-full'}`}
            placeholder="Write a comment... Supports markdown."
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
          />
          {newCommentPreviewMode && (
            <div className="w-1/2 overflow-y-auto prose dark:prose-invert prose-sm max-w-none p-2 rounded border border-border-subtle bg-surface-dim text-primary font-sans h-full">
              {newComment ? (
                <Markdown>{newComment}</Markdown>
              ) : (
                <span className="text-subtle italic">Preview...</span>
              )}
            </div>
          )}
        </div>
        <div className="flex justify-end mt-2">
          <button 
            onClick={() => { handleCreateComment(); setNewCommentPreviewMode(false); }}
            disabled={!newComment.trim()}
            className="bg-blue-600 hover:bg-blue-500 text-strong font-bold text-[10px] uppercase tracking-widest rounded px-4 py-2 disabled:opacity-50 transition-colors"
          >
            Post Comment
          </button>
        </div>
      </div>
    </div>
  );
};

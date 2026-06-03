import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useSearchParams, Link, Navigate } from 'react-router';
import { FolderKanban, FileText, Plus, ChevronLeft, Save, Trash2, Edit3, X } from 'lucide-react';
import { Project, Document } from '../types';
import Markdown from 'react-markdown';

export default function Documents() {
  const { token } = useAuth();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get('projectId');
  const documentId = searchParams.get('documentId');
  
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  // Editor states
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchProjects();
  }, [token]);

  useEffect(() => {
    if (projectId) {
      fetchDocuments();
    }
  }, [projectId, token]);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAllProjects(data);
        if (projectId) {
          setProject(data.find((p: Project) => p.id === projectId) || null);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!projectId) setLoading(false);
    }
  };

  const fetchDocuments = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        setDocuments(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const selectedDocument = documents.find(d => d.id === documentId);

  useEffect(() => {
    if (selectedDocument && isEditing) {
       // if we are editing and select a new document, maybe reset or not, handled by startEdit
    }
  }, [selectedDocument]);

  const startEdit = (doc?: Document) => {
    if (doc) {
      setEditTitle(doc.title);
      setEditContent(doc.content);
    } else {
      setEditTitle('Untitled Document');
      setEditContent('# New Document\n\nStart typing here...');
    }
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      const method = documentId && documentId !== 'new' ? 'PUT' : 'POST';
      const url = documentId && documentId !== 'new' 
        ? `/api/documents/${documentId}` 
        : `/api/projects/${projectId}/documents`;
        
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: editTitle, content: editContent })
      });
      
      if (res.ok) {
        const savedDoc = await res.json();
        await fetchDocuments();
        setIsEditing(false);
        // update url to point to new doc
        if (!documentId || documentId === 'new') {
          // Replace state if creating new? No, let's just let the link handle it or programmatic navigation
          window.history.pushState({}, '', `/documents?projectId=${projectId}&documentId=${savedDoc.id}`);
        }
      }
    } catch (err) {
      console.error("Failed to save document", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      const res = await fetch(`/api/documents/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        if (documentId === id) {
          window.history.pushState({}, '', `/documents?projectId=${projectId}`);
        }
        fetchDocuments();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-primary">Loading documents...</div>;

  if (!projectId) {
    if (allProjects.length === 1) {
      return <Navigate to={`/documents?projectId=${allProjects[0].id}`} replace />;
    }
    
    return (
      <div className="flex-1 flex flex-col p-8 bg-page-bg overflow-y-auto">
        <h1 className="text-xl font-semibold text-strong tracking-tight opacity-90 mb-2">Select a Project</h1>
        <p className="text-sm text-subtle mb-8">Choose a project to view its documents</p>
        
        {allProjects.length === 0 ? (
          <div className="text-center p-12 bg-surface border border-border-subtle rounded-lg">
            <h2 className="text-lg font-medium text-strong mb-2">No projects found</h2>
            <p className="text-sm text-subtle mb-4">You need to create a project first before managing documents.</p>
            <Link to="/projects" className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-strong text-sm font-medium rounded transition-colors">
              Go to Projects
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allProjects.map(p => (
              <Link 
                key={p.id} 
                to={`/documents?projectId=${p.id}`}
                className="block p-6 bg-surface border border-border-subtle hover:border-blue-500/50 rounded-lg transition-all hover:shadow-lg group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2 bg-blue-500/10 text-blue-500 rounded group-hover:scale-110 transition-transform">
                    <FolderKanban size={24} />
                  </div>
                  <span className="text-xs font-mono text-muted bg-surface-accent px-2 py-1 rounded">
                    {p.projectKey || 'PRJ'}
                  </span>
                </div>
                <h3 className="text-lg font-medium text-strong mb-2 group-hover:text-blue-400 transition-colors">{p.name}</h3>
                <p className="text-sm text-subtle line-clamp-2">
                  {p.description ? p.description : 'No description'}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Sidebar for Document List */}
      <div className="w-64 flex-shrink-0 border-r border-border-subtle bg-surface-dim flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b border-border-subtle">
          <Link to={`/documents`} className="text-xs font-medium text-subtle hover:text-strong flex items-center mb-4 transition-colors">
            <ChevronLeft size={14} className="mr-1" />
            Back to Projects
          </Link>
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-semibold text-strong truncate pr-2">{project?.name} Docs</h2>
            <Link 
              to={`/documents?projectId=${projectId}&documentId=new`}
              onClick={() => startEdit()}
              className="text-blue-400 hover:text-blue-300 p-1 hover:bg-blue-500/10 rounded transition-colors"
              title="New Document"
            >
              <Plus size={16} />
            </Link>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {documents.length === 0 ? (
            <p className="text-xs text-subtle italic p-2">No documents yet.</p>
          ) : (
            documents.map(doc => (
              <div key={doc.id} className="group flex items-center justify-between">
                <Link
                  to={`/documents?projectId=${projectId}&documentId=${doc.id}`}
                  onClick={() => setIsEditing(false)}
                  className={`flex-1 flex items-center space-x-2 px-3 py-2 rounded-md text-sm transition-colors ${
                    documentId === doc.id 
                      ? 'bg-blue-500/10 text-blue-400 font-medium' 
                      : 'text-subtle hover:bg-surface hover:text-strong'
                  }`}
                >
                  <FileText size={14} className={documentId === doc.id ? 'text-blue-500' : 'text-muted'} />
                  <span className="truncate">{doc.title}</span>
                </Link>
                <button 
                  onClick={() => handleDelete(doc.id)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 p-1.5 hover:bg-red-400/10 rounded mr-1 transition-all"
                  title="Delete Document"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-page-bg">
        {documentId === 'new' ? (
          // New Document Editor
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <input
                type="text"
                value={editTitle}
                onChange={e => setEditTitle(e.target.value)}
                className="text-2xl font-semibold bg-transparent border-none outline-none text-strong placeholder-muted flex-1"
                placeholder="Document Title"
              />
              <div className="flex items-center space-x-2 ml-4">
                <Link to={`/documents?projectId=${projectId}`} className="text-subtle hover:text-strong px-3 py-1.5 rounded-md text-sm transition-colors">
                  Cancel
                </Link>
                <button 
                  onClick={handleSave}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors disabled:opacity-50"
                  disabled={!editTitle.trim()}
                >
                  <Save size={16} />
                  <span>Save</span>
                </button>
              </div>
            </div>
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="flex-1 w-full bg-surface-dim border border-border-subtle rounded-lg p-6 text-strong focus:outline-none focus:border-blue-500/50 resize-none font-mono text-sm leading-relaxed"
              placeholder="Write using Markdown..."
            />
          </div>
        ) : selectedDocument ? (
          // View or Edit Selected Document
          <div className="flex-1 flex flex-col p-8 overflow-y-auto">
            {isEditing ? (
              <div className="flex-1 flex flex-col h-full max-w-4xl mx-auto w-full">
                <div className="flex justify-between items-center mb-6">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="text-2xl font-semibold bg-transparent border-none outline-none text-strong placeholder-muted flex-1"
                    placeholder="Document Title"
                  />
                  <div className="flex items-center space-x-2 ml-4 shrink-0">
                    <button onClick={() => setIsEditing(false)} className="text-subtle hover:text-strong px-3 py-1.5 rounded-md text-sm transition-colors border border-border-subtle hover:bg-surface">
                      Cancel
                    </button>
                    <button 
                      onClick={handleSave}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-1.5 rounded-md text-sm font-medium flex items-center space-x-2 transition-colors"
                    >
                      <Save size={16} />
                      <span>Update</span>
                    </button>
                  </div>
                </div>
                <textarea
                  value={editContent}
                  onChange={e => setEditContent(e.target.value)}
                  className="flex-1 w-full min-h-[500px] bg-surface-dim border border-border-subtle rounded-lg p-6 text-strong focus:outline-none focus:border-blue-500/50 resize-none font-mono text-sm shadow-inner"
                />
              </div>
            ) : (
              <div className="max-w-4xl mx-auto w-full">
                <div className="flex justify-between items-start mb-8 pb-4 border-b border-border-subtle">
                  <div>
                    <h1 className="text-3xl font-bold text-strong mb-2">{selectedDocument.title}</h1>
                    <p className="text-xs text-muted flex items-center space-x-2">
                      <span>Last updated: {new Date(selectedDocument.updatedAt).toLocaleDateString()}</span>
                    </p>
                  </div>
                  <button 
                    onClick={() => startEdit(selectedDocument)}
                    className="flex items-center space-x-1.5 text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                  >
                    <Edit3 size={14} />
                    <span>Edit</span>
                  </button>
                </div>
                
                <div className="prose prose-invert prose-blue max-w-none text-sm text-subtle leading-relaxed">
                  <Markdown>{selectedDocument.content}</Markdown>
                </div>
              </div>
            )}
          </div>
        ) : (
          // Empty State
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-sm">
              <div className="mx-auto w-12 h-12 bg-blue-500/10 text-blue-500 flex items-center justify-center rounded-full mb-4">
                <FileText size={24} />
              </div>
              <h3 className="text-lg font-medium text-strong mb-2">Select or create a document</h3>
              <p className="text-sm text-subtle mb-6">Capture PRDs, architecture notes, and meeting summaries.</p>
              <Link 
                to={`/documents?projectId=${projectId}&documentId=new`}
                onClick={() => startEdit()}
                className="inline-flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                <Plus size={16} />
                <span>New Document</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

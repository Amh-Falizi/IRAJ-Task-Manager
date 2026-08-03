import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=f8cbbd09"; const Fragment = __vite__cjsImport0_react_jsxDevRuntime["Fragment"]; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import __vite__cjsImport1_react from "/node_modules/.vite/deps/react.js?v=f8cbbd09"; const useState = __vite__cjsImport1_react["useState"]; const useEffect = __vite__cjsImport1_react["useEffect"]; const useMemo = __vite__cjsImport1_react["useMemo"];
import { useAuth } from "/src/contexts/AuthContext.tsx";
import { useToast } from "/src/contexts/ToastContext.tsx";
import { useGitFeature } from "/src/contexts/GitFeatureContext.tsx";
import TaskModal from "/src/components/TaskModal.tsx";
import CustomSelect from "/src/components/CustomSelect.tsx";
import WorkloadModal from "/src/components/WorkloadModal.tsx";
import ProjectActivityModal from "/src/components/ProjectActivityModal.tsx";
import { Plus, Calendar, ArrowUpDown, CornerDownRight, Search, Filter, AlertCircle, ChevronUp, Minus, ChevronDown, X, FolderKanban, Activity, CheckCircle2, Workflow, Clock, Pencil, Trash2, UserPlus, Download, GitBranch, GitPullRequest } from "/node_modules/.vite/deps/lucide-react.js?v=f8cbbd09";
import { cn, safeFormatDate } from "/src/lib/utils.ts";
import { useSearchParams, Link, Navigate, useNavigate } from "/node_modules/.vite/deps/react-router.js?v=f8cbbd09";
import Markdown from "/node_modules/.vite/deps/react-markdown.js?v=f8cbbd09";
import UserAvatar from "/src/components/UserAvatar.tsx";
import { exportToCSV, exportToJSON } from "/src/lib/export.ts";
import { Tooltip } from "/src/components/Tooltip.tsx";
export const DEFAULT_COLUMNS = [
  { id: "todo", title: "To Do" },
  { id: "in_progress", title: "In Progress" },
  { id: "review", title: "Review" },
  { id: "done", title: "Done" }
];
const priorityWeight = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};
export default function Board() {
  const { token, user } = useAuth();
  const { success, error, info } = useToast();
  const { gitEnabled } = useGitFeature();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const projectId = searchParams.get("projectId");
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [allProjects, setAllProjects] = useState([]);
  const [columns, setColumns] = useState(() => {
    try {
      const saved = localStorage.getItem(`board-columns-${projectId || "all"}`);
      return saved ? JSON.parse(saved) : DEFAULT_COLUMNS;
    } catch (e) {
      return DEFAULT_COLUMNS;
    }
  });
  const [editingColumnId, setEditingColumnId] = useState(null);
  const [editingColumnTitle, setEditingColumnTitle] = useState("");
  const handleAddColumn = () => {
    const newId = `col_${Date.now()}`;
    const newTitle = "New Column";
    setColumns([...columns, { id: newId, title: newTitle }]);
    setTimeout(() => {
      setEditingColumnId(newId);
      setEditingColumnTitle(newTitle);
    }, 0);
  };
  const handleUpdateColumnTitle = (id) => {
    if (editingColumnTitle.trim()) {
      setColumns(columns.map((c) => c.id === id ? { ...c, title: editingColumnTitle.trim() } : c));
    }
    setEditingColumnId(null);
  };
  const handleDeleteColumn = (id) => {
    setColumns(columns.filter((c) => c.id !== id));
  };
  useEffect(() => {
    localStorage.setItem(`board-columns-${projectId || "all"}`, JSON.stringify(columns));
  }, [columns, projectId]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWorkloadModalOpen, setIsWorkloadModalOpen] = useState(false);
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedParentId, setSelectedParentId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("custom");
  const [sortDir, setSortDir] = useState("asc");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedTaskIds, setSelectedTaskIds] = useState(/* @__PURE__ */ new Set());
  const [draggingTaskId, setDraggingTaskId] = useState(null);
  const [draggingColumnId, setDraggingColumnId] = useState(null);
  const handleColumnDragEnter = (targetColId) => {
    if (!draggingColumnId || draggingColumnId === targetColId) return;
    setColumns((prev) => {
      const sourceIdx = prev.findIndex((c) => c.id === draggingColumnId);
      const targetIdx = prev.findIndex((c) => c.id === targetColId);
      if (sourceIdx !== -1 && targetIdx !== -1) {
        const newCols = [...prev];
        const [dragged] = newCols.splice(sourceIdx, 1);
        newCols.splice(targetIdx, 0, dragged);
        return newCols;
      }
      return prev;
    });
  };
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const handleExportCSV = () => {
    setIsExportMenuOpen(false);
    const exportData = filteredTasks.map((t) => ({
      ID: t.id,
      Project: t.projectId || "",
      Title: t.title,
      Description: t.description || "",
      Status: t.status,
      Priority: t.priority,
      Assignee: users.find((u) => u.id === t.assigneeId)?.name || "Unassigned",
      Branch: t.branchName || "",
      Deadline: t.deadline || "",
      Created: t.createdAt
    }));
    exportToCSV(`tasks-${project?.name || "all"}`, exportData);
  };
  const handleExportJSON = () => {
    setIsExportMenuOpen(false);
    exportToJSON(`tasks-${project?.name || "all"}`, filteredTasks);
  };
  const fetchData = async () => {
    try {
      const results = await Promise.all([
        fetch("/api/tasks", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/users", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/projects", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/milestones", { headers: { Authorization: `Bearer ${token}` } })
      ]);
      const tasksData = await results[0].json();
      const usersData = await results[1].json();
      const projectsData = await results[2].json();
      const milestonesData = await results[3].json();
      setAllProjects(projectsData);
      setMilestones(milestonesData);
      if (projectId) {
        const found = projectsData.find((p) => p.id === projectId);
        setProject(found || null);
        setTasks(tasksData.filter((t) => t.projectId === projectId));
      } else {
        setProject(null);
        setTasks(tasksData);
      }
      setUsers(usersData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [token, projectId]);
  const sortedTasks = useMemo(() => {
    return [...tasks].sort((a, b) => {
      let comparison = 0;
      if (sortBy === "custom") {
        comparison = (a.orderIndex || 0) - (b.orderIndex || 0);
      } else if (sortBy === "priority") {
        comparison = priorityWeight[a.priority] - priorityWeight[b.priority];
      } else if (sortBy === "deadline") {
        const tA = a.deadline ? new Date(a.deadline).getTime() : 0;
        const tB = b.deadline ? new Date(b.deadline).getTime() : 0;
        comparison = (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
      } else if (sortBy === "createdAt") {
        const tA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const tB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        comparison = (isNaN(tA) ? 0 : tA) - (isNaN(tB) ? 0 : tB);
      }
      return sortDir === "asc" ? comparison : -comparison;
    });
  }, [tasks, sortBy, sortDir]);
  const filteredTasks = useMemo(() => {
    let result = sortedTasks;
    if (filterAssignee !== "all") {
      result = result.filter((t) => t.assigneeId === filterAssignee);
    }
    if (filterPriority !== "all") {
      result = result.filter((t) => t.priority === filterPriority);
    }
    if (filterStatus !== "all") {
      result = result.filter((t) => t.status === filterStatus);
    }
    if (!searchQuery.trim()) return result;
    const lowerQuery = searchQuery.toLowerCase();
    const matchingTasks = /* @__PURE__ */ new Set();
    result.forEach((t) => {
      if (t.title.toLowerCase().includes(lowerQuery) || t.description && t.description.toLowerCase().includes(lowerQuery)) {
        matchingTasks.add(t.id);
        if (t.parentId) matchingTasks.add(t.parentId);
      }
    });
    result.forEach((t) => {
      if (t.parentId && matchingTasks.has(t.parentId)) {
        matchingTasks.add(t.id);
      }
    });
    return result.filter((t) => matchingTasks.has(t.id));
  }, [sortedTasks, searchQuery, filterAssignee, filterPriority, filterStatus]);
  const handleCreateTask = () => {
    setEditingTask(null);
    setSelectedParentId(null);
    setSelectedStatus(null);
    setIsModalOpen(true);
  };
  useEffect(() => {
    const handleGlobalNewTask = () => handleCreateTask();
    window.addEventListener("open-new-task-modal", handleGlobalNewTask);
    return () => window.removeEventListener("open-new-task-modal", handleGlobalNewTask);
  }, []);
  const handleCreateTaskInColumn = (status) => {
    setEditingTask(null);
    setSelectedParentId(null);
    setSelectedStatus(status);
    setIsModalOpen(true);
  };
  const handleDropTask = async (taskId, targetStatus, hoverTaskId, dropPosition) => {
    setDraggingTaskId(null);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    if (targetStatus === "done" && task.status !== "done") {
      const deps = task.dependencies || [];
      const pendingDeps = deps.filter((depId) => {
        const dep = tasks.find((t) => t.id === depId);
        return dep && dep.status !== "done";
      });
      if (pendingDeps.length > 0) {
        error(`Cannot complete task. ${pendingDeps.length} dependencies are still pending.`);
        return;
      }
    }
    let newOrderIndex = task.orderIndex;
    const columnTasks = sortedTasks.filter((t) => t.status === targetStatus && t.parentId === task.parentId);
    const columnTasksWithoutDragged = columnTasks.filter((t) => t.id !== taskId);
    if (hoverTaskId) {
      if (sortBy !== "custom") {
        setSortBy("custom");
        setSortDir("asc");
      }
      const hoverIndex = columnTasksWithoutDragged.findIndex((t) => t.id === hoverTaskId);
      if (hoverIndex !== -1) {
        if (dropPosition === "before") {
          const prevTask = columnTasksWithoutDragged[hoverIndex - 1];
          const hoverTask = columnTasksWithoutDragged[hoverIndex];
          if (prevTask) {
            newOrderIndex = ((prevTask.orderIndex || 0) + (hoverTask.orderIndex || 0)) / 2;
          } else {
            newOrderIndex = (hoverTask.orderIndex || 0) + (sortDir === "asc" ? -1e3 : 1e3);
          }
        } else {
          const hoverTask = columnTasksWithoutDragged[hoverIndex];
          const nextTask = columnTasksWithoutDragged[hoverIndex + 1];
          if (nextTask) {
            newOrderIndex = ((hoverTask.orderIndex || 0) + (nextTask.orderIndex || 0)) / 2;
          } else {
            newOrderIndex = (hoverTask.orderIndex || 0) + (sortDir === "asc" ? 1e3 : -1e3);
          }
        }
      }
    } else if (columnTasksWithoutDragged.length > 0) {
      if (task.status !== targetStatus) {
        const lastTask = columnTasksWithoutDragged[columnTasksWithoutDragged.length - 1];
        newOrderIndex = (lastTask.orderIndex || 0) + (sortDir === "asc" ? 1e3 : -1e3);
      }
    } else {
      newOrderIndex = Date.now();
    }
    setTasks(tasks.map((t) => t.id === taskId ? { ...t, status: targetStatus, orderIndex: newOrderIndex } : t));
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...task, status: targetStatus, orderIndex: newOrderIndex })
      });
    } catch (err) {
      console.error("Failed to update status", err);
    } finally {
      fetchData();
    }
  };
  const handleCreateSubtask = (parentId, e) => {
    if (e) e.stopPropagation();
    setEditingTask(null);
    setSelectedParentId(parentId);
    setIsModalOpen(true);
  };
  const handleEditTask = (task) => {
    setEditingTask(task);
    setSelectedParentId(null);
    setIsModalOpen(true);
  };
  const handleSaveTask = async (taskData) => {
    const isEdit = !!editingTask;
    const url = isEdit ? `/api/tasks/${editingTask.id}` : "/api/tasks";
    const method = isEdit ? "PUT" : "POST";
    try {
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(taskData)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchData();
        success(editingTask ? "Task updated" : "Task created");
      } else {
        const errData = await res.text();
        error(`Failed to save task: ${errData}`);
      }
    } catch (err) {
      console.error(err);
      error(`Error saving task: ${err.message}`);
    }
  };
  const handleUpdateTask = async (taskId, currentTask, updates) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ ...currentTask, ...updates })
      });
      fetchData();
      if (updates.status === "done") {
        success("Task completed");
      } else {
        success(updates.orderIndex !== void 0 && Object.keys(updates).length === 1 ? "Task reordered" : "Task updated");
      }
    } catch (err) {
      error("Failed to update task");
      console.error(err);
    }
  };
  const toggleSelection = (taskId) => {
    setSelectedTaskIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };
  const handleBulkUpdate = async (updates) => {
    if (selectedTaskIds.size === 0) return;
    try {
      const selectedTasks = tasks.filter((t) => selectedTaskIds.has(t.id));
      await Promise.all(selectedTasks.map(
        (t) => fetch(`/api/tasks/${t.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ ...t, ...updates })
        })
      ));
      setSelectedTaskIds(/* @__PURE__ */ new Set());
      fetchData();
      if (updates.status === "done") {
        success("Tasks completed");
      } else {
        success("Tasks updated");
      }
    } catch (err) {
      error("Bulk update failed");
      console.error("Bulk update failed", err);
    }
  };
  const handleBulkDelete = async () => {
    if (selectedTaskIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedTaskIds.size} tasks?`)) return;
    try {
      await Promise.all(Array.from(selectedTaskIds).map(
        (id) => fetch(`/api/tasks/${id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        })
      ));
      setSelectedTaskIds(/* @__PURE__ */ new Set());
      fetchData();
      success("Tasks deleted");
    } catch (err) {
      error("Bulk delete failed");
      console.error("Bulk delete failed", err);
    }
  };
  const handleDeleteTask = async (taskId) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchData();
      success("Task deleted");
    } catch (err) {
      error("Failed to delete task");
      console.error(err);
    }
  };
  if (loading) return /* @__PURE__ */ jsxDEV("div", { className: "p-8 text-primary", children: "Loading board..." }, void 0, false, {
    fileName: "/app/applet/src/pages/Board.tsx",
    lineNumber: 484,
    columnNumber: 23
  }, this);
  if (!projectId) {
    if (allProjects.length === 1) {
      return /* @__PURE__ */ jsxDEV(Navigate, { to: `/board?projectId=${allProjects[0].id}`, replace: true }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 488,
        columnNumber: 14
      }, this);
    }
    return /* @__PURE__ */ jsxDEV("div", { className: "flex-1 flex flex-col p-8 bg-page-bg overflow-y-auto", children: [
      /* @__PURE__ */ jsxDEV("h1", { className: "text-xl font-semibold text-strong tracking-tight opacity-90 mb-2", children: "Select a Project" }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 493,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-subtle mb-8", children: "Choose a project to view its task board" }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 494,
        columnNumber: 9
      }, this),
      allProjects.length === 0 ? /* @__PURE__ */ jsxDEV("div", { className: "text-center p-12 bg-surface border border-border-subtle rounded-lg", children: [
        /* @__PURE__ */ jsxDEV("h2", { className: "text-lg font-medium text-strong mb-2", children: "No projects found" }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 498,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-subtle mb-4", children: "You need to create a project first before managing tasks." }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 499,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV(Link, { to: "/projects", className: "inline-flex items-center justify-center px-4 py-2 bg-blue-600 hover:bg-blue-500 text-strong text-sm font-medium rounded transition-colors", children: "Go to Projects" }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 500,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 497,
        columnNumber: 11
      }, this) : /* @__PURE__ */ jsxDEV("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: allProjects.map((p) => /* @__PURE__ */ jsxDEV(
        Link,
        {
          to: `/board?projectId=${p.id}`,
          className: "block p-6 bg-surface border border-border-subtle hover:border-blue-500/50 rounded-lg transition-all hover:shadow-lg group",
          children: [
            /* @__PURE__ */ jsxDEV("div", { className: "flex items-start justify-between mb-4", children: [
              /* @__PURE__ */ jsxDEV("div", { className: "p-2 bg-blue-500/10 text-blue-500 rounded group-hover:scale-110 transition-transform", children: /* @__PURE__ */ jsxDEV(FolderKanban, { size: 24 }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 514,
                columnNumber: 21
              }, this) }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 513,
                columnNumber: 19
              }, this),
              /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-mono text-muted bg-surface-accent px-2 py-1 rounded", children: p.projectKey || "PRJ" }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 516,
                columnNumber: 19
              }, this)
            ] }, void 0, true, {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 512,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("h3", { className: "text-lg font-medium text-strong mb-2 group-hover:text-blue-400 transition-colors", children: p.name }, void 0, false, {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 520,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("p", { className: "text-sm text-subtle line-clamp-2", children: p.description ? p.description : "No description" }, void 0, false, {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 521,
              columnNumber: 17
            }, this)
          ]
        },
        p.id,
        true,
        {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 507,
          columnNumber: 15
        },
        this
      )) }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 505,
        columnNumber: 11
      }, this)
    ] }, void 0, true, {
      fileName: "/app/applet/src/pages/Board.tsx",
      lineNumber: 492,
      columnNumber: 7
    }, this);
  }
  return /* @__PURE__ */ jsxDEV("div", { className: "flex-1 flex flex-col p-4 md:p-6 min-h-0 bg-page-bg", children: [
    /* @__PURE__ */ jsxDEV("div", { className: "tour-board-header flex justify-between items-start lg:items-center mb-6 shrink-0 flex-col lg:flex-row gap-4", children: [
      /* @__PURE__ */ jsxDEV("div", { children: project ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("h1", { className: "text-xl font-semibold text-strong tracking-tight flex items-center gap-2", children: [
          /* @__PURE__ */ jsxDEV(FolderKanban, { size: 20, className: "text-blue-500" }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 539,
            columnNumber: 17
          }, this),
          project.name,
          " ",
          /* @__PURE__ */ jsxDEV("span", { className: "text-sm font-normal text-subtle", children: "Board" }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 540,
            columnNumber: 32
          }, this)
        ] }, void 0, true, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 538,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "text-xs text-subtle mt-1 prose dark:prose-invert prose-sm line-clamp-1", children: project.description ? /* @__PURE__ */ jsxDEV(Markdown, { children: project.description }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 544,
          columnNumber: 19
        }, this) : "Project Task Board" }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 542,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 537,
        columnNumber: 13
      }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
        /* @__PURE__ */ jsxDEV("h1", { className: "text-sm font-semibold text-strong tracking-tight uppercase", children: "Task Board" }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 552,
          columnNumber: 15
        }, this),
        /* @__PURE__ */ jsxDEV("p", { className: "text-[10px] text-subtle uppercase tracking-widest mt-1", children: "Manage all tasks" }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 553,
          columnNumber: 15
        }, this)
      ] }, void 0, true, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 551,
        columnNumber: 13
      }, this) }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 535,
        columnNumber: 9
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center gap-3 flex-wrap", children: [
        project && /* @__PURE__ */ jsxDEV(Fragment, { children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => setIsWorkloadModalOpen(true),
              className: "flex items-center space-x-2 bg-surface border border-border-subtle hover:border-blue-500/50 text-primary hover:text-strong px-3 py-1.5 rounded transition-all text-sm font-medium",
              children: [
                /* @__PURE__ */ jsxDEV(Activity, { size: 14, className: "text-blue-500" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 564,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("span", { children: "Team Workload" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 565,
                  columnNumber: 17
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 560,
              columnNumber: 15
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => setIsActivityModalOpen(true),
              className: "flex items-center space-x-2 bg-surface border border-border-subtle hover:border-blue-500/50 text-primary hover:text-strong px-3 py-1.5 rounded transition-all text-sm font-medium",
              children: [
                /* @__PURE__ */ jsxDEV(Clock, { size: 14, className: "text-blue-500" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 571,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("span", { children: "Project Activity" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 572,
                  columnNumber: 17
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 567,
              columnNumber: 15
            },
            this
          ),
          gitEnabled && /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => navigate(`/git?projectId=${project.id}`),
              className: "flex items-center space-x-2 bg-surface border border-border-subtle hover:border-amber-500/50 text-primary hover:text-amber-400 px-3 py-1.5 rounded transition-all text-sm font-medium",
              children: [
                /* @__PURE__ */ jsxDEV(GitBranch, { size: 14, className: "text-amber-400" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 579,
                  columnNumber: 19
                }, this),
                /* @__PURE__ */ jsxDEV("span", { children: "Git Repo" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 580,
                  columnNumber: 19
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 575,
              columnNumber: 17
            },
            this
          ),
          /* @__PURE__ */ jsxDEV(
            Link,
            {
              to: `/graph?projectId=${project.id}`,
              className: "flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/30 hover:border-indigo-500 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded transition-all text-sm font-medium shadow-sm hover:scale-105",
              children: [
                /* @__PURE__ */ jsxDEV(Workflow, { size: 14, className: "text-indigo-400" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 587,
                  columnNumber: 17
                }, this),
                /* @__PURE__ */ jsxDEV("span", { children: "Task Graph" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 588,
                  columnNumber: 17
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 583,
              columnNumber: 15
            },
            this
          )
        ] }, void 0, true, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 559,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-2 bg-surface border border-border-subtle rounded px-3 py-1.5 text-[10px]", children: [
          /* @__PURE__ */ jsxDEV(Search, { size: 14, className: "text-subtle shrink-0" }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 593,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV(
            "input",
            {
              type: "text",
              placeholder: "SEARCH TASKS...",
              value: searchQuery,
              onChange: (e) => setSearchQuery(e.target.value),
              className: "bg-transparent text-strong uppercase font-bold tracking-widest outline-none w-32 md:w-48 placeholder-muted"
            },
            void 0,
            false,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 594,
              columnNumber: 13
            },
            this
          )
        ] }, void 0, true, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 592,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-3 bg-surface border border-border-subtle rounded px-3 py-1.5 text-[10px] flex-wrap", children: [
          /* @__PURE__ */ jsxDEV(Filter, { size: 12, className: "text-subtle shrink-0" }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 603,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "min-w-28", children: /* @__PURE__ */ jsxDEV(
            CustomSelect,
            {
              value: filterAssignee,
              onChange: setFilterAssignee,
              options: [
                { value: "all", label: "ALL USERS" },
                ...user ? [{ value: user.id, label: "ASSIGNED TO ME" }] : [],
                ...users.filter((u) => u.id !== user?.id).map((u) => ({ value: u.id, label: u.name.toUpperCase() }))
              ],
              variant: "borderless",
              size: "xs"
            },
            void 0,
            false,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 605,
              columnNumber: 15
            },
            this
          ) }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 604,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "text-border-strong px-1", children: "|" }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 617,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "min-w-32", children: /* @__PURE__ */ jsxDEV(
            CustomSelect,
            {
              value: filterPriority,
              onChange: setFilterPriority,
              options: [
                { value: "all", label: "ALL PRIORITIES" },
                { value: "urgent", label: "URGENT" },
                { value: "high", label: "HIGH" },
                { value: "medium", label: "MEDIUM" },
                { value: "low", label: "LOW" }
              ],
              variant: "borderless",
              size: "xs"
            },
            void 0,
            false,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 619,
              columnNumber: 15
            },
            this
          ) }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 618,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "text-border-strong px-1", children: "|" }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 633,
            columnNumber: 13
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "min-w-32", children: /* @__PURE__ */ jsxDEV(
            CustomSelect,
            {
              value: filterStatus,
              onChange: setFilterStatus,
              options: [
                { value: "all", label: "ALL STATUSES" },
                ...columns.map((c) => ({ value: c.id, label: c.title.toUpperCase() }))
              ],
              variant: "borderless",
              size: "xs"
            },
            void 0,
            false,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 635,
              columnNumber: 15
            },
            this
          ) }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 634,
            columnNumber: 13
          }, this)
        ] }, void 0, true, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 602,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-2 bg-surface border border-border-subtle rounded px-3 py-1.5 text-[10px]", children: [
          /* @__PURE__ */ jsxDEV(ArrowUpDown, { size: 12, className: "text-subtle" }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 648,
            columnNumber: 14
          }, this),
          /* @__PURE__ */ jsxDEV("span", { className: "text-subtle font-bold uppercase tracking-widest border-r border-border-subtle pr-2", children: "SORT BY" }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 649,
            columnNumber: 14
          }, this),
          /* @__PURE__ */ jsxDEV("div", { className: "min-w-40", children: /* @__PURE__ */ jsxDEV(
            CustomSelect,
            {
              value: `${sortBy}-${sortDir}`,
              onChange: (val) => {
                const [by, dir] = val.split("-");
                setSortBy(by);
                setSortDir(dir);
              },
              options: [
                { value: "custom-asc", label: "CUSTOM (DRAG & DROP)" },
                { value: "priority-desc", label: "HIGHEST PRIORITY" },
                { value: "priority-asc", label: "LOWEST PRIORITY" },
                { value: "deadline-asc", label: "NEAREST DEADLINE" },
                { value: "deadline-desc", label: "FURTHEST DEADLINE" },
                { value: "createdAt-desc", label: "NEWEST FIRST" },
                { value: "createdAt-asc", label: "OLDEST FIRST" }
              ],
              variant: "borderless",
              size: "xs"
            },
            void 0,
            false,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 651,
              columnNumber: 16
            },
            this
          ) }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 650,
            columnNumber: 14
          }, this)
        ] }, void 0, true, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 647,
          columnNumber: 11
        }, this),
        /* @__PURE__ */ jsxDEV("div", { className: "relative", children: [
          /* @__PURE__ */ jsxDEV(
            "button",
            {
              onClick: () => setIsExportMenuOpen(!isExportMenuOpen),
              className: "flex items-center space-x-2 bg-surface text-subtle border border-border-subtle hover:border-blue-500/50 hover:text-strong px-3 py-1.5 rounded transition-all text-xs font-bold uppercase tracking-widest",
              children: [
                /* @__PURE__ */ jsxDEV(Download, { size: 14 }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 677,
                  columnNumber: 15
                }, this),
                /* @__PURE__ */ jsxDEV("span", { children: "EXPORT" }, void 0, false, {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 678,
                  columnNumber: 15
                }, this)
              ]
            },
            void 0,
            true,
            {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 673,
              columnNumber: 13
            },
            this
          ),
          isExportMenuOpen && /* @__PURE__ */ jsxDEV(Fragment, { children: [
            /* @__PURE__ */ jsxDEV("div", { className: "fixed inset-0 z-40", onClick: () => setIsExportMenuOpen(false) }, void 0, false, {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 682,
              columnNumber: 17
            }, this),
            /* @__PURE__ */ jsxDEV("div", { className: "absolute right-0 mt-2 z-50 w-36 bg-surface-dim border border-border-subtle rounded-md shadow-xl py-1", children: [
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: handleExportCSV,
                  className: "w-full text-left px-4 py-2 text-xs font-bold uppercase tracking-widest text-subtle hover:bg-surface hover:text-strong",
                  children: "CSV File"
                },
                void 0,
                false,
                {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 684,
                  columnNumber: 19
                },
                this
              ),
              /* @__PURE__ */ jsxDEV(
                "button",
                {
                  onClick: handleExportJSON,
                  className: "w-full text-left px-4 py-2 text-xs font-bold uppercase tracking-widest text-subtle hover:bg-surface hover:text-strong",
                  children: "JSON File"
                },
                void 0,
                false,
                {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 690,
                  columnNumber: 19
                },
                this
              )
            ] }, void 0, true, {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 683,
              columnNumber: 17
            }, this)
          ] }, void 0, true, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 681,
            columnNumber: 15
          }, this)
        ] }, void 0, true, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 672,
          columnNumber: 11
        }, this),
        user?.role !== "developer" && /* @__PURE__ */ jsxDEV(Tooltip, { content: "Create a new task with keyboard shortcut: c", position: "bottom", children: /* @__PURE__ */ jsxDEV(
          "button",
          {
            onClick: handleCreateTask,
            className: "tour-new-task px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded shadow hover:scale-105 transition-all flex items-center space-x-2",
            children: [
              /* @__PURE__ */ jsxDEV(Plus, { size: 14 }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 706,
                columnNumber: 17
              }, this),
              /* @__PURE__ */ jsxDEV("span", { children: "NEW TASK" }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 707,
                columnNumber: 17
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 702,
            columnNumber: 15
          },
          this
        ) }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 701,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 557,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/app/applet/src/pages/Board.tsx",
      lineNumber: 534,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV("div", { className: "flex-1 flex space-x-4 md:space-x-6 overflow-x-auto overflow-y-hidden pb-4 scrollbar-thin snap-x snap-mandatory scroll-smooth", children: [
      columns.map((column) => {
        const parentTasks = filteredTasks.filter((t) => !t.parentId);
        const columnTasks = parentTasks.filter((t) => t.status === column.id);
        return /* @__PURE__ */ jsxDEV(
          "div",
          {
            className: `w-[290px] sm:w-80 snap-center flex-shrink-0 flex flex-col bg-surface border rounded-lg transition-colors duration-200 ${draggingColumnId === column.id ? "opacity-50 border-dashed border-blue-500" : "border-border-subtle"} `,
            onDragEnter: (e) => {
              if (draggingColumnId) {
                handleColumnDragEnter(column.id);
              }
            },
            onDragOver: (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              e.currentTarget.classList.add("border-blue-500/50");
            },
            onDragLeave: (e) => {
              e.currentTarget.classList.remove("border-blue-500/50");
            },
            onDrop: async (e) => {
              e.preventDefault();
              e.currentTarget.classList.remove("border-blue-500/50");
              const columnId = e.dataTransfer.getData("columnId");
              const taskId = e.dataTransfer.getData("taskId");
              if (columnId && columnId !== column.id) {
                setColumns((prev) => {
                  const newColumns = [...prev];
                  const sourceIdx = newColumns.findIndex((c) => c.id === columnId);
                  const targetIdx = newColumns.findIndex((c) => c.id === column.id);
                  if (sourceIdx !== -1 && targetIdx !== -1) {
                    const [dragged] = newColumns.splice(sourceIdx, 1);
                    newColumns.splice(targetIdx, 0, dragged);
                  }
                  return newColumns;
                });
              } else if (taskId) {
                handleDropTask(taskId, column.id);
              }
              setDraggingColumnId(null);
            },
            children: [
              /* @__PURE__ */ jsxDEV(
                "div",
                {
                  className: "px-4 py-3 flex justify-between items-center border-b border-border-subtle group cursor-move",
                  draggable: true,
                  onDragStart: (e) => {
                    e.dataTransfer.effectAllowed = "move";
                    e.dataTransfer.setData("columnId", column.id);
                    setTimeout(() => setDraggingColumnId(column.id), 0);
                  },
                  onDragEnd: () => {
                    setDraggingColumnId(null);
                  },
                  children: [
                    /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-2 flex-1", children: [
                      editingColumnId === column.id ? /* @__PURE__ */ jsxDEV(
                        "input",
                        {
                          type: "text",
                          className: "text-xs font-bold text-strong uppercase tracking-widest bg-transparent border-b border-blue-500 outline-none w-full",
                          value: editingColumnTitle,
                          onChange: (e) => setEditingColumnTitle(e.target.value),
                          onBlur: () => handleUpdateColumnTitle(column.id),
                          onKeyDown: (e) => {
                            if (e.key === "Enter") handleUpdateColumnTitle(column.id);
                            if (e.key === "Escape") setEditingColumnId(null);
                          },
                          autoFocus: true
                        },
                        void 0,
                        false,
                        {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 774,
                          columnNumber: 21
                        },
                        this
                      ) : /* @__PURE__ */ jsxDEV("h3", { className: "text-xs font-bold text-strong uppercase tracking-widest cursor-pointer", onDoubleClick: () => {
                        setEditingColumnId(column.id);
                        setEditingColumnTitle(column.title);
                      }, children: column.title }, void 0, false, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 787,
                        columnNumber: 21
                      }, this),
                      /* @__PURE__ */ jsxDEV("span", { className: "bg-surface-accent text-strong px-2 py-0.5 rounded text-[10px] font-medium", children: columnTasks.length }, void 0, false, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 794,
                        columnNumber: 19
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/app/applet/src/pages/Board.tsx",
                      lineNumber: 772,
                      columnNumber: 17
                    }, this),
                    /* @__PURE__ */ jsxDEV("div", { className: "flex flex-row items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity", children: [
                      user?.role !== "developer" && /* @__PURE__ */ jsxDEV(Tooltip, { content: `Add Task to ${column.title}`, position: "top", children: /* @__PURE__ */ jsxDEV(
                        "button",
                        {
                          onClick: () => handleCreateTaskInColumn(column.id),
                          className: "bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white p-1 rounded transition-colors",
                          children: /* @__PURE__ */ jsxDEV(Plus, { size: 16 }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 805,
                            columnNumber: 25
                          }, this)
                        },
                        void 0,
                        false,
                        {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 801,
                          columnNumber: 23
                        },
                        this
                      ) }, void 0, false, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 800,
                        columnNumber: 21
                      }, this),
                      /* @__PURE__ */ jsxDEV(Tooltip, { content: `Delete ${column.title}`, position: "top", children: /* @__PURE__ */ jsxDEV(
                        "button",
                        {
                          onClick: () => handleDeleteColumn(column.id),
                          className: "text-subtle hover:text-red-400",
                          children: /* @__PURE__ */ jsxDEV(Trash2, { size: 14 }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 814,
                            columnNumber: 23
                          }, this)
                        },
                        void 0,
                        false,
                        {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 810,
                          columnNumber: 21
                        },
                        this
                      ) }, void 0, false, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 809,
                        columnNumber: 19
                      }, this)
                    ] }, void 0, true, {
                      fileName: "/app/applet/src/pages/Board.tsx",
                      lineNumber: 798,
                      columnNumber: 17
                    }, this)
                  ]
                },
                void 0,
                true,
                {
                  fileName: "/app/applet/src/pages/Board.tsx",
                  lineNumber: 760,
                  columnNumber: 15
                },
                this
              ),
              /* @__PURE__ */ jsxDEV("div", { className: "flex-1 overflow-y-auto p-4 space-y-3", children: columnTasks.map((task) => {
                const assignee = users.find((u) => u.id === task.assigneeId);
                const subtasks = filteredTasks.filter((t) => t.parentId === task.id);
                const completedSubtasks = subtasks.filter((t) => t.status === "done").length;
                return /* @__PURE__ */ jsxDEV(
                  "div",
                  {
                    draggable: true,
                    onDragStart: (e) => {
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("taskId", task.id);
                      setTimeout(() => setDraggingTaskId(task.id), 0);
                    },
                    onDragEnd: () => setDraggingTaskId(null),
                    onDragOver: (e) => {
                      if (e.dataTransfer.types.includes("columnid") || e.dataTransfer.types.includes("columnId")) {
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      e.dataTransfer.dropEffect = "move";
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      if (y < rect.height / 2) {
                        e.currentTarget.style.borderTopColor = "#3b82f6";
                        e.currentTarget.style.borderBottomColor = "#2d3139";
                      } else {
                        e.currentTarget.style.borderTopColor = "#2d3139";
                        e.currentTarget.style.borderBottomColor = "#3b82f6";
                      }
                    },
                    onDragLeave: (e) => {
                      e.currentTarget.style.borderTopColor = "";
                      e.currentTarget.style.borderBottomColor = "";
                    },
                    onDrop: (e) => {
                      const draggedColumnId = e.dataTransfer.getData("columnId");
                      if (draggedColumnId) {
                        return;
                      }
                      e.preventDefault();
                      e.stopPropagation();
                      e.currentTarget.style.borderTopColor = "";
                      e.currentTarget.style.borderBottomColor = "";
                      const draggedTaskId = e.dataTransfer.getData("taskId");
                      if (!draggedTaskId || draggedTaskId === task.id) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const y = e.clientY - rect.top;
                      const position = y < rect.height / 2 ? "before" : "after";
                      handleDropTask(draggedTaskId, column.id, task.id, position);
                    },
                    onClick: () => handleEditTask(task),
                    className: cn(
                      "task-card p-3 bg-surface-dim border rounded cursor-pointer hover:border-blue-500 transition-colors group flex flex-col",
                      draggingTaskId === task.id && "opacity-40",
                      task.priority === "urgent" ? "border-red-500/40" : task.priority === "high" ? "border-amber-500/40" : task.priority === "medium" ? "border-blue-500/40" : "border-border-subtle"
                    ),
                    children: [
                      /* @__PURE__ */ jsxDEV("div", { className: "flex justify-between items-start mb-2", children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-2", children: [
                          /* @__PURE__ */ jsxDEV(
                            "div",
                            {
                              className: cn(
                                "opacity-0 transition-opacity flex items-center justify-center cursor-pointer p-0.5 lg:group-hover:opacity-100",
                                (selectedTaskIds.has(task.id) || selectedTaskIds.size > 0) && "opacity-100"
                              ),
                              onClick: (e) => {
                                e.stopPropagation();
                                toggleSelection(task.id);
                              },
                              children: /* @__PURE__ */ jsxDEV(
                                "input",
                                {
                                  type: "checkbox",
                                  readOnly: true,
                                  checked: selectedTaskIds.has(task.id),
                                  className: "w-3 h-3 cursor-pointer accent-blue-500"
                                },
                                void 0,
                                false,
                                {
                                  fileName: "/app/applet/src/pages/Board.tsx",
                                  lineNumber: 900,
                                  columnNumber: 29
                                },
                                this
                              )
                            },
                            void 0,
                            false,
                            {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 890,
                              columnNumber: 27
                            },
                            this
                          ),
                          /* @__PURE__ */ jsxDEV("div", { className: cn(
                            "flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0",
                            task.priority === "urgent" ? "bg-red-500/10 text-red-400 border border-red-500/20" : task.priority === "high" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : task.priority === "medium" ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" : "bg-surface-accent text-muted border border-border-strong"
                          ), children: [
                            task.priority === "urgent" && /* @__PURE__ */ jsxDEV(AlertCircle, { size: 10 }, void 0, false, {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 914,
                              columnNumber: 60
                            }, this),
                            task.priority === "high" && /* @__PURE__ */ jsxDEV(ChevronUp, { size: 10 }, void 0, false, {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 915,
                              columnNumber: 58
                            }, this),
                            task.priority === "medium" && /* @__PURE__ */ jsxDEV(Minus, { size: 10 }, void 0, false, {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 916,
                              columnNumber: 60
                            }, this),
                            task.priority === "low" && /* @__PURE__ */ jsxDEV(ChevronDown, { size: 10 }, void 0, false, {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 917,
                              columnNumber: 57
                            }, this),
                            /* @__PURE__ */ jsxDEV("span", { children: task.priority }, void 0, false, {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 918,
                              columnNumber: 29
                            }, this)
                          ] }, void 0, true, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 907,
                            columnNumber: 27
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 889,
                          columnNumber: 25
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity", children: [
                          /* @__PURE__ */ jsxDEV(
                            "button",
                            {
                              className: "text-subtle hover:text-blue-400 p-1 rounded hover:bg-blue-500/10",
                              title: "Edit Task",
                              onClick: (e) => {
                                e.stopPropagation();
                                handleEditTask(task);
                              },
                              children: /* @__PURE__ */ jsxDEV(Pencil, { size: 14 }, void 0, false, {
                                fileName: "/app/applet/src/pages/Board.tsx",
                                lineNumber: 927,
                                columnNumber: 29
                              }, this)
                            },
                            void 0,
                            false,
                            {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 922,
                              columnNumber: 27
                            },
                            this
                          ),
                          /* @__PURE__ */ jsxDEV(
                            "button",
                            {
                              className: "text-subtle hover:text-red-400 p-1 rounded hover:bg-red-500/10",
                              title: "Delete Task",
                              onClick: (e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDeleteTask(task.id);
                              },
                              children: /* @__PURE__ */ jsxDEV(Trash2, { size: 14 }, void 0, false, {
                                fileName: "/app/applet/src/pages/Board.tsx",
                                lineNumber: 934,
                                columnNumber: 29
                              }, this)
                            },
                            void 0,
                            false,
                            {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 929,
                              columnNumber: 27
                            },
                            this
                          )
                        ] }, void 0, true, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 921,
                          columnNumber: 25
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 888,
                        columnNumber: 23
                      }, this),
                      /* @__PURE__ */ jsxDEV("h4", { className: "text-xs font-bold text-strong mb-1 leading-snug", children: task.title }, void 0, false, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 939,
                        columnNumber: 23
                      }, this),
                      gitEnabled && task.branchName ? /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-1 mb-2 flex-wrap gap-1", children: [
                        /* @__PURE__ */ jsxDEV(
                          "button",
                          {
                            type: "button",
                            onClick: (e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(`git checkout ${task.branchName}`);
                              success(`Copied: git checkout ${task.branchName}`);
                            },
                            title: "Click to copy: git checkout branch",
                            className: "inline-flex items-center space-x-1 text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/20 transition-all truncate max-w-[180px]",
                            children: [
                              /* @__PURE__ */ jsxDEV(GitBranch, { size: 10, className: "shrink-0" }, void 0, false, {
                                fileName: "/app/applet/src/pages/Board.tsx",
                                lineNumber: 952,
                                columnNumber: 29
                              }, this),
                              /* @__PURE__ */ jsxDEV("span", { className: "truncate", children: task.branchName }, void 0, false, {
                                fileName: "/app/applet/src/pages/Board.tsx",
                                lineNumber: 953,
                                columnNumber: 29
                              }, this)
                            ]
                          },
                          void 0,
                          true,
                          {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 942,
                            columnNumber: 27
                          },
                          this
                        ),
                        task.prUrl && /* @__PURE__ */ jsxDEV(
                          "a",
                          {
                            href: task.prUrl,
                            target: "_blank",
                            rel: "noopener noreferrer",
                            onClick: (e) => e.stopPropagation(),
                            className: "inline-flex items-center space-x-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/20 transition-colors",
                            title: "View Pull Request",
                            children: [
                              /* @__PURE__ */ jsxDEV(GitPullRequest, { size: 9 }, void 0, false, {
                                fileName: "/app/applet/src/pages/Board.tsx",
                                lineNumber: 964,
                                columnNumber: 31
                              }, this),
                              /* @__PURE__ */ jsxDEV("span", { children: "PR" }, void 0, false, {
                                fileName: "/app/applet/src/pages/Board.tsx",
                                lineNumber: 965,
                                columnNumber: 31
                              }, this)
                            ]
                          },
                          void 0,
                          true,
                          {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 956,
                            columnNumber: 29
                          },
                          this
                        )
                      ] }, void 0, true, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 941,
                        columnNumber: 25
                      }, this) : null,
                      task.milestoneId && /* @__PURE__ */ jsxDEV("div", { className: "text-[9px] font-bold uppercase tracking-widest text-[#a855f7] bg-[#a855f7]/10 border border-[#a855f7]/20 px-1.5 py-0.5 rounded inline-block mb-2 max-w-full truncate", children: milestones.find((m) => m.id === task.milestoneId)?.name || "Milestone" }, void 0, false, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 971,
                        columnNumber: 25
                      }, this),
                      (() => {
                        const allDeps = task.dependencies || [];
                        const pendingDeps = allDeps.filter((depId) => {
                          const dep = filteredTasks.find((t) => t.id === depId);
                          return dep && dep.status !== "done";
                        }).length;
                        if (allDeps.length === 0) return null;
                        return /* @__PURE__ */ jsxDEV("div", { className: cn("text-[9px] font-bold uppercase tracking-widest inline-flex items-center space-x-1 px-1.5 py-0.5 rounded mb-2", pendingDeps > 0 ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"), children: pendingDeps > 0 ? /* @__PURE__ */ jsxDEV(Fragment, { children: [
                          /* @__PURE__ */ jsxDEV(AlertCircle, { size: 10 }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 989,
                            columnNumber: 34
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: [
                            pendingDeps,
                            " Blocked"
                          ] }, void 0, true, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 990,
                            columnNumber: 34
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 988,
                          columnNumber: 32
                        }, this) : /* @__PURE__ */ jsxDEV(Fragment, { children: [
                          /* @__PURE__ */ jsxDEV(CheckCircle2, { size: 10 }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 994,
                            columnNumber: 34
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: "Unblocked" }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 995,
                            columnNumber: 34
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 993,
                          columnNumber: 32
                        }, this) }, void 0, false, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 986,
                          columnNumber: 27
                        }, this);
                      })(),
                      subtasks.length > 0 && /* @__PURE__ */ jsxDEV("div", { className: "mb-2 mt-1", children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center justify-between text-[9px] font-bold text-subtle uppercase tracking-widest mb-1", children: [
                          /* @__PURE__ */ jsxDEV("span", { children: "Subtasks" }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1005,
                            columnNumber: 29
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: [
                            completedSubtasks,
                            "/",
                            subtasks.length
                          ] }, void 0, true, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1006,
                            columnNumber: 29
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 1004,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "w-full h-1 bg-surface-accent rounded-full overflow-hidden", children: /* @__PURE__ */ jsxDEV(
                          "div",
                          {
                            className: cn(
                              "h-full transition-all duration-300",
                              completedSubtasks === subtasks.length ? "bg-green-500" : "bg-blue-500"
                            ),
                            style: { width: `${completedSubtasks / subtasks.length * 100}%` }
                          },
                          void 0,
                          false,
                          {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1009,
                            columnNumber: 29
                          },
                          this
                        ) }, void 0, false, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 1008,
                          columnNumber: 27
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex flex-col mt-2 space-y-1 pl-1 border-l-2 border-border-subtle/50 ml-1", children: subtasks.map((st) => /* @__PURE__ */ jsxDEV(
                          "div",
                          {
                            draggable: true,
                            onDragStart: (e) => {
                              e.stopPropagation();
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("taskId", st.id);
                              setTimeout(() => setDraggingTaskId(st.id), 0);
                            },
                            onDragEnd: () => setDraggingTaskId(null),
                            onDragOver: (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = "move";
                              const rect = e.currentTarget.getBoundingClientRect();
                              const y = e.clientY - rect.top;
                              if (y < rect.height / 2) {
                                e.currentTarget.style.borderTopColor = "#3b82f6";
                                e.currentTarget.style.borderBottomColor = "";
                              } else {
                                e.currentTarget.style.borderTopColor = "";
                                e.currentTarget.style.borderBottomColor = "#3b82f6";
                              }
                            },
                            onDragLeave: (e) => {
                              e.currentTarget.style.borderTopColor = "";
                              e.currentTarget.style.borderBottomColor = "";
                            },
                            onDrop: (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              e.currentTarget.style.borderTopColor = "";
                              e.currentTarget.style.borderBottomColor = "";
                              const draggedTaskId = e.dataTransfer.getData("taskId");
                              if (!draggedTaskId || draggedTaskId === st.id) return;
                              const draggedTask = tasks.find((t) => t.id === draggedTaskId);
                              if (!draggedTask) return;
                              if (draggedTask.parentId === st.parentId) {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const y = e.clientY - rect.top;
                                const position = y < rect.height / 2 ? "before" : "after";
                                handleDropTask(draggedTaskId, column.id, st.id, position);
                              }
                            },
                            className: cn(
                              "flex justify-between items-center bg-surface p-1.5 rounded cursor-pointer hover:bg-surface-dim border border-transparent hover:border-border-subtle",
                              draggingTaskId === st.id && "opacity-40"
                            ),
                            onClick: (e) => {
                              e.stopPropagation();
                              handleEditTask(st);
                            },
                            children: [
                              /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-1.5 overflow-hidden", children: [
                                /* @__PURE__ */ jsxDEV(CornerDownRight, { size: 10, className: "text-border-strong shrink-0" }, void 0, false, {
                                  fileName: "/app/applet/src/pages/Board.tsx",
                                  lineNumber: 1073,
                                  columnNumber: 35
                                }, this),
                                /* @__PURE__ */ jsxDEV("span", { className: cn(
                                  "text-[10px] truncate max-w-[150px]",
                                  st.status === "done" ? "line-through text-subtle opacity-50" : "text-muted"
                                ), children: st.title }, void 0, false, {
                                  fileName: "/app/applet/src/pages/Board.tsx",
                                  lineNumber: 1074,
                                  columnNumber: 35
                                }, this)
                              ] }, void 0, true, {
                                fileName: "/app/applet/src/pages/Board.tsx",
                                lineNumber: 1072,
                                columnNumber: 33
                              }, this),
                              /* @__PURE__ */ jsxDEV("span", { className: cn(
                                "w-2 h-2 rounded-full",
                                st.status === "done" ? "bg-green-500" : st.status === "in_progress" ? "bg-blue-500" : st.status === "review" ? "bg-amber-500" : "bg-surface-accent"
                              ) }, void 0, false, {
                                fileName: "/app/applet/src/pages/Board.tsx",
                                lineNumber: 1081,
                                columnNumber: 33
                              }, this)
                            ]
                          },
                          st.id,
                          true,
                          {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1019,
                            columnNumber: 31
                          },
                          this
                        )) }, void 0, false, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 1017,
                          columnNumber: 27
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 1003,
                        columnNumber: 25
                      }, this),
                      /* @__PURE__ */ jsxDEV("div", { className: "mt-auto pt-2 flex items-center justify-between text-[10px] text-muted border-t border-border-subtle", children: [
                        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-1 font-mono", children: [
                          /* @__PURE__ */ jsxDEV(Calendar, { size: 12 }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1096,
                            columnNumber: 27
                          }, this),
                          /* @__PURE__ */ jsxDEV("span", { children: safeFormatDate(task.deadline, "MMM dd", "NO DEADLINE").toUpperCase() }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1097,
                            columnNumber: 27
                          }, this)
                        ] }, void 0, true, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 1095,
                          columnNumber: 25
                        }, this),
                        /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-2 relative group/assignee", title: assignee ? assignee.name : "Unassigned", children: /* @__PURE__ */ jsxDEV("div", { className: "cursor-pointer inline-flex relative", children: [
                          assignee ? /* @__PURE__ */ jsxDEV(UserAvatar, { user: assignee, className: "w-5 h-5 text-[9px] rounded", showTooltip: false }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1104,
                            columnNumber: 31
                          }, this) : /* @__PURE__ */ jsxDEV("div", { className: "w-5 h-5 rounded border border-dashed border-border-strong flex items-center justify-center text-muted group-hover:border-blue-500/50 group-hover:text-blue-400 transition-colors bg-surface-dim group-hover:bg-blue-500/10", children: /* @__PURE__ */ jsxDEV(UserPlus, { size: 10 }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1107,
                            columnNumber: 33
                          }, this) }, void 0, false, {
                            fileName: "/app/applet/src/pages/Board.tsx",
                            lineNumber: 1106,
                            columnNumber: 31
                          }, this),
                          /* @__PURE__ */ jsxDEV(
                            "select",
                            {
                              className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer",
                              value: task.assigneeId || "",
                              onChange: (e) => {
                                e.stopPropagation();
                                const newAssigneeId = e.target.value || null;
                                setTasks(tasks.map((t) => t.id === task.id ? { ...t, assigneeId: newAssigneeId } : t));
                                handleUpdateTask(task.id, task, { assigneeId: newAssigneeId });
                              },
                              onClick: (e) => e.stopPropagation(),
                              children: [
                                /* @__PURE__ */ jsxDEV("option", { value: "", children: "Unassigned" }, void 0, false, {
                                  fileName: "/app/applet/src/pages/Board.tsx",
                                  lineNumber: 1121,
                                  columnNumber: 31
                                }, this),
                                users.map((u) => /* @__PURE__ */ jsxDEV("option", { value: u.id, children: u.name }, u.id, false, {
                                  fileName: "/app/applet/src/pages/Board.tsx",
                                  lineNumber: 1123,
                                  columnNumber: 34
                                }, this))
                              ]
                            },
                            void 0,
                            true,
                            {
                              fileName: "/app/applet/src/pages/Board.tsx",
                              lineNumber: 1110,
                              columnNumber: 29
                            },
                            this
                          )
                        ] }, void 0, true, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 1102,
                          columnNumber: 27
                        }, this) }, void 0, false, {
                          fileName: "/app/applet/src/pages/Board.tsx",
                          lineNumber: 1101,
                          columnNumber: 25
                        }, this)
                      ] }, void 0, true, {
                        fileName: "/app/applet/src/pages/Board.tsx",
                        lineNumber: 1094,
                        columnNumber: 23
                      }, this)
                    ]
                  },
                  task.id,
                  true,
                  {
                    fileName: "/app/applet/src/pages/Board.tsx",
                    lineNumber: 827,
                    columnNumber: 21
                  },
                  this
                );
              }) }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 820,
                columnNumber: 15
              }, this)
            ]
          },
          column.id,
          true,
          {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 719,
            columnNumber: 13
          },
          this
        );
      }),
      /* @__PURE__ */ jsxDEV("div", { className: "w-80 flex-shrink-0 flex items-center justify-center border border-dashed border-border-subtle hover:border-blue-500 hover:bg-blue-500/5 rounded-lg bg-surface-dim transition-colors cursor-pointer group", onClick: handleAddColumn, children: /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-2 text-subtle group-hover:text-blue-500 transition-colors", children: [
        /* @__PURE__ */ jsxDEV(Plus, { size: 16 }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 1138,
          columnNumber: 13
        }, this),
        /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-bold uppercase tracking-widest", children: "New Column" }, void 0, false, {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 1139,
          columnNumber: 13
        }, this)
      ] }, void 0, true, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1137,
        columnNumber: 11
      }, this) }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1136,
        columnNumber: 9
      }, this)
    ] }, void 0, true, {
      fileName: "/app/applet/src/pages/Board.tsx",
      lineNumber: 714,
      columnNumber: 7
    }, this),
    isModalOpen && /* @__PURE__ */ jsxDEV(
      TaskModal,
      {
        task: editingTask,
        users,
        tasks,
        columns,
        parentId: selectedParentId,
        projectId,
        onClose: () => setIsModalOpen(false),
        onSave: handleSaveTask,
        onUpdateTask: handleUpdateTask,
        onDeleteTask: handleDeleteTask,
        onCreateSubtask: handleCreateSubtask
      },
      void 0,
      false,
      {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1145,
        columnNumber: 9
      },
      this
    ),
    selectedTaskIds.size > 0 && /* @__PURE__ */ jsxDEV("div", { className: "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-surface border border-border-subtle shadow-2xl rounded-full px-6 py-3 flex items-center space-x-6 text-sm", children: [
      /* @__PURE__ */ jsxDEV("div", { className: "text-strong font-bold", children: [
        selectedTaskIds.size,
        " task",
        selectedTaskIds.size > 1 ? "s" : "",
        " selected"
      ] }, void 0, true, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1162,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "w-px h-6 bg-surface-accent" }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1165,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "flex items-center space-x-3", children: [
        /* @__PURE__ */ jsxDEV(
          "select",
          {
            className: "bg-surface-dim border border-border-subtle rounded px-3 py-1.5 text-xs text-strong uppercase font-medium hover:border-border-strong focus:outline-none cursor-pointer transition-colors",
            onChange: (e) => handleBulkUpdate({ status: e.target.value }),
            value: "",
            children: [
              /* @__PURE__ */ jsxDEV("option", { value: "", disabled: true, hidden: true, children: "Change Status..." }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1173,
                columnNumber: 16
              }, this),
              columns.map((c) => /* @__PURE__ */ jsxDEV("option", { value: c.id, children: c.title }, c.id, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1175,
                columnNumber: 18
              }, this))
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 1168,
            columnNumber: 14
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "select",
          {
            className: "bg-surface-dim border border-border-subtle rounded px-3 py-1.5 text-xs text-strong uppercase font-medium hover:border-border-strong focus:outline-none cursor-pointer transition-colors",
            onChange: (e) => handleBulkUpdate({ priority: e.target.value }),
            value: "",
            children: [
              /* @__PURE__ */ jsxDEV("option", { value: "", disabled: true, hidden: true, children: "Change Priority..." }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1184,
                columnNumber: 16
              }, this),
              /* @__PURE__ */ jsxDEV("option", { value: "urgent", children: "Urgent" }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1185,
                columnNumber: 16
              }, this),
              /* @__PURE__ */ jsxDEV("option", { value: "high", children: "High" }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1186,
                columnNumber: 16
              }, this),
              /* @__PURE__ */ jsxDEV("option", { value: "medium", children: "Medium" }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1187,
                columnNumber: 16
              }, this),
              /* @__PURE__ */ jsxDEV("option", { value: "low", children: "Low" }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1188,
                columnNumber: 16
              }, this)
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 1179,
            columnNumber: 14
          },
          this
        ),
        /* @__PURE__ */ jsxDEV(
          "select",
          {
            className: "bg-surface-dim border border-border-subtle rounded px-3 py-1.5 text-xs text-strong uppercase font-medium hover:border-border-strong focus:outline-none cursor-pointer transition-colors",
            onChange: (e) => handleBulkUpdate({ assigneeId: e.target.value || null }),
            value: "",
            children: [
              /* @__PURE__ */ jsxDEV("option", { value: "", disabled: true, hidden: true, children: "Assign To..." }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1196,
                columnNumber: 16
              }, this),
              /* @__PURE__ */ jsxDEV("option", { value: "", children: "Unassigned" }, void 0, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1197,
                columnNumber: 16
              }, this),
              users.map((u) => /* @__PURE__ */ jsxDEV("option", { value: u.id, children: u.name }, u.id, false, {
                fileName: "/app/applet/src/pages/Board.tsx",
                lineNumber: 1198,
                columnNumber: 32
              }, this))
            ]
          },
          void 0,
          true,
          {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 1191,
            columnNumber: 14
          },
          this
        )
      ] }, void 0, true, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1167,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV("div", { className: "w-px h-6 bg-surface-accent" }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1202,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          className: "text-red-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded transition-colors flex items-center space-x-2",
          onClick: handleBulkDelete,
          title: "Delete Selected",
          children: [
            /* @__PURE__ */ jsxDEV(Trash2, { size: 16 }, void 0, false, {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 1209,
              columnNumber: 13
            }, this),
            /* @__PURE__ */ jsxDEV("span", { className: "text-xs font-medium uppercase font-bold", children: "Delete" }, void 0, false, {
              fileName: "/app/applet/src/pages/Board.tsx",
              lineNumber: 1210,
              columnNumber: 13
            }, this)
          ]
        },
        void 0,
        true,
        {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 1204,
          columnNumber: 11
        },
        this
      ),
      /* @__PURE__ */ jsxDEV("div", { className: "w-px h-6 bg-surface-accent" }, void 0, false, {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1213,
        columnNumber: 11
      }, this),
      /* @__PURE__ */ jsxDEV(
        "button",
        {
          className: "text-muted hover:text-strong hover:bg-surface-accent p-1.5 rounded-full transition-colors",
          onClick: () => setSelectedTaskIds(/* @__PURE__ */ new Set()),
          title: "Clear Selection",
          children: /* @__PURE__ */ jsxDEV(X, { size: 16 }, void 0, false, {
            fileName: "/app/applet/src/pages/Board.tsx",
            lineNumber: 1220,
            columnNumber: 13
          }, this)
        },
        void 0,
        false,
        {
          fileName: "/app/applet/src/pages/Board.tsx",
          lineNumber: 1215,
          columnNumber: 11
        },
        this
      )
    ] }, void 0, true, {
      fileName: "/app/applet/src/pages/Board.tsx",
      lineNumber: 1161,
      columnNumber: 9
    }, this),
    isWorkloadModalOpen && project && /* @__PURE__ */ jsxDEV(
      WorkloadModal,
      {
        projectId: project.id,
        projectName: project.name,
        onClose: () => setIsWorkloadModalOpen(false)
      },
      void 0,
      false,
      {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1225,
        columnNumber: 9
      },
      this
    ),
    isActivityModalOpen && project && /* @__PURE__ */ jsxDEV(
      ProjectActivityModal,
      {
        projectId: project.id,
        projectName: project.name,
        users,
        onClose: () => setIsActivityModalOpen(false)
      },
      void 0,
      false,
      {
        fileName: "/app/applet/src/pages/Board.tsx",
        lineNumber: 1232,
        columnNumber: 9
      },
      this
    )
  ] }, void 0, true, {
    fileName: "/app/applet/src/pages/Board.tsx",
    lineNumber: 533,
    columnNumber: 5
  }, this);
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIkJvYXJkLnRzeCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUmVhY3QsIHsgdXNlU3RhdGUsIHVzZUVmZmVjdCwgdXNlTWVtbyB9IGZyb20gJ3JlYWN0JztcbmltcG9ydCB7IHVzZUF1dGggfSBmcm9tICcuLi9jb250ZXh0cy9BdXRoQ29udGV4dCc7XG5pbXBvcnQgeyB1c2VUb2FzdCB9IGZyb20gJy4uL2NvbnRleHRzL1RvYXN0Q29udGV4dCc7XG5pbXBvcnQgeyB1c2VHaXRGZWF0dXJlIH0gZnJvbSAnLi4vY29udGV4dHMvR2l0RmVhdHVyZUNvbnRleHQnO1xuaW1wb3J0IHsgVGFzaywgVXNlciwgUHJvamVjdCwgTWlsZXN0b25lIH0gZnJvbSAnLi4vdHlwZXMnO1xuaW1wb3J0IFRhc2tNb2RhbCBmcm9tICcuLi9jb21wb25lbnRzL1Rhc2tNb2RhbCc7XG5pbXBvcnQgQ3VzdG9tU2VsZWN0IGZyb20gJy4uL2NvbXBvbmVudHMvQ3VzdG9tU2VsZWN0JztcbmltcG9ydCBXb3JrbG9hZE1vZGFsIGZyb20gJy4uL2NvbXBvbmVudHMvV29ya2xvYWRNb2RhbCc7XG5pbXBvcnQgUHJvamVjdEFjdGl2aXR5TW9kYWwgZnJvbSAnLi4vY29tcG9uZW50cy9Qcm9qZWN0QWN0aXZpdHlNb2RhbCc7XG5pbXBvcnQgeyBQbHVzLCBNb3JlVmVydGljYWwsIENhbGVuZGFyLCBBcnJvd1VwRG93biwgQ29ybmVyRG93blJpZ2h0LCBTZWFyY2gsIEZpbHRlciwgQWxlcnRDaXJjbGUsIENoZXZyb25VcCwgTWludXMsIENoZXZyb25Eb3duLCBYLCBGb2xkZXJLYW5iYW4sIEFjdGl2aXR5LCBDaGVja0NpcmNsZTIsIFdvcmtmbG93LCBDbG9jaywgUGVuY2lsLCBUcmFzaDIsIFVzZXJQbHVzLCBEb3dubG9hZCwgR2l0QnJhbmNoLCBHaXRQdWxsUmVxdWVzdCB9IGZyb20gJ2x1Y2lkZS1yZWFjdCc7XG5pbXBvcnQgeyBmb3JtYXQgfSBmcm9tICdkYXRlLWZucyc7XG5pbXBvcnQgeyBjbiwgc2FmZUZvcm1hdERhdGUgfSBmcm9tICcuLi9saWIvdXRpbHMnO1xuaW1wb3J0IHsgdXNlU2VhcmNoUGFyYW1zLCBMaW5rLCBOYXZpZ2F0ZSwgdXNlTmF2aWdhdGUgfSBmcm9tICdyZWFjdC1yb3V0ZXInO1xuaW1wb3J0IFRhc2tEaWFncmFtIGZyb20gJy4uL2NvbXBvbmVudHMvVGFza0RpYWdyYW0nO1xuaW1wb3J0IE1hcmtkb3duIGZyb20gJ3JlYWN0LW1hcmtkb3duJztcbmltcG9ydCBVc2VyQXZhdGFyIGZyb20gJy4uL2NvbXBvbmVudHMvVXNlckF2YXRhcic7XG5pbXBvcnQgeyBleHBvcnRUb0NTViwgZXhwb3J0VG9KU09OIH0gZnJvbSAnLi4vbGliL2V4cG9ydCc7XG5pbXBvcnQgeyBIZWxwSWNvbiwgVG9vbHRpcCB9IGZyb20gJy4uL2NvbXBvbmVudHMvVG9vbHRpcCc7XG5pbXBvcnQgeyBFbXB0eVN0YXRlIH0gZnJvbSAnLi4vY29tcG9uZW50cy9FbXB0eVN0YXRlJztcblxuZXhwb3J0IGludGVyZmFjZSBDb2x1bW4ge1xuICBpZDogc3RyaW5nO1xuICB0aXRsZTogc3RyaW5nO1xufVxuXG5leHBvcnQgY29uc3QgREVGQVVMVF9DT0xVTU5TOiBDb2x1bW5bXSA9IFtcbiAgeyBpZDogJ3RvZG8nLCB0aXRsZTogJ1RvIERvJyB9LFxuICB7IGlkOiAnaW5fcHJvZ3Jlc3MnLCB0aXRsZTogJ0luIFByb2dyZXNzJyB9LFxuICB7IGlkOiAncmV2aWV3JywgdGl0bGU6ICdSZXZpZXcnIH0sXG4gIHsgaWQ6ICdkb25lJywgdGl0bGU6ICdEb25lJyB9XG5dO1xuXG50eXBlIFNvcnRPcHRpb24gPSAnY3VzdG9tJyB8ICdwcmlvcml0eScgfCAnZGVhZGxpbmUnIHwgJ2NyZWF0ZWRBdCc7XG50eXBlIFNvcnREaXJlY3Rpb24gPSAnYXNjJyB8ICdkZXNjJztcbnR5cGUgVmlld01vZGUgPSAnYm9hcmQnIHwgJ2RpYWdyYW0nO1xuXG5jb25zdCBwcmlvcml0eVdlaWdodCA9IHtcbiAgdXJnZW50OiA0LFxuICBoaWdoOiAzLFxuICBtZWRpdW06IDIsXG4gIGxvdzogMVxufTtcblxuZXhwb3J0IGRlZmF1bHQgZnVuY3Rpb24gQm9hcmQoKSB7XG4gIGNvbnN0IHsgdG9rZW4sIHVzZXIgfSA9IHVzZUF1dGgoKTtcbiAgY29uc3QgeyBzdWNjZXNzLCBlcnJvciwgaW5mbyB9ID0gdXNlVG9hc3QoKTtcbiAgY29uc3QgeyBnaXRFbmFibGVkIH0gPSB1c2VHaXRGZWF0dXJlKCk7XG4gIGNvbnN0IG5hdmlnYXRlID0gdXNlTmF2aWdhdGUoKTtcbiAgY29uc3QgW3NlYXJjaFBhcmFtc10gPSB1c2VTZWFyY2hQYXJhbXMoKTtcbiAgY29uc3QgcHJvamVjdElkID0gc2VhcmNoUGFyYW1zLmdldCgncHJvamVjdElkJyk7XG4gIFxuICBjb25zdCBbdGFza3MsIHNldFRhc2tzXSA9IHVzZVN0YXRlPFRhc2tbXT4oW10pO1xuICBjb25zdCBbdXNlcnMsIHNldFVzZXJzXSA9IHVzZVN0YXRlPFVzZXJbXT4oW10pO1xuICBjb25zdCBbcHJvamVjdCwgc2V0UHJvamVjdF0gPSB1c2VTdGF0ZTxQcm9qZWN0IHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFttaWxlc3RvbmVzLCBzZXRNaWxlc3RvbmVzXSA9IHVzZVN0YXRlPE1pbGVzdG9uZVtdPihbXSk7XG4gIFxuICBjb25zdCBbYWxsUHJvamVjdHMsIHNldEFsbFByb2plY3RzXSA9IHVzZVN0YXRlPFByb2plY3RbXT4oW10pO1xuICBcbiAgY29uc3QgW2NvbHVtbnMsIHNldENvbHVtbnNdID0gdXNlU3RhdGU8Q29sdW1uW10+KCgpID0+IHtcbiAgICB0cnkge1xuICAgICAgY29uc3Qgc2F2ZWQgPSBsb2NhbFN0b3JhZ2UuZ2V0SXRlbShgYm9hcmQtY29sdW1ucy0ke3Byb2plY3RJZCB8fCAnYWxsJ31gKTtcbiAgICAgIHJldHVybiBzYXZlZCA/IEpTT04ucGFyc2Uoc2F2ZWQpIDogREVGQVVMVF9DT0xVTU5TO1xuICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgIHJldHVybiBERUZBVUxUX0NPTFVNTlM7XG4gICAgfVxuICB9KTtcblxuICBjb25zdCBbZWRpdGluZ0NvbHVtbklkLCBzZXRFZGl0aW5nQ29sdW1uSWRdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtlZGl0aW5nQ29sdW1uVGl0bGUsIHNldEVkaXRpbmdDb2x1bW5UaXRsZV0gPSB1c2VTdGF0ZSgnJyk7XG5cbiAgY29uc3QgaGFuZGxlQWRkQ29sdW1uID0gKCkgPT4ge1xuICAgIGNvbnN0IG5ld0lkID0gYGNvbF8ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCBuZXdUaXRsZSA9ICdOZXcgQ29sdW1uJztcbiAgICBzZXRDb2x1bW5zKFsuLi5jb2x1bW5zLCB7IGlkOiBuZXdJZCwgdGl0bGU6IG5ld1RpdGxlIH1dKTtcbiAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICBzZXRFZGl0aW5nQ29sdW1uSWQobmV3SWQpO1xuICAgICAgIHNldEVkaXRpbmdDb2x1bW5UaXRsZShuZXdUaXRsZSk7XG4gICAgfSwgMCk7XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlVXBkYXRlQ29sdW1uVGl0bGUgPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIGlmIChlZGl0aW5nQ29sdW1uVGl0bGUudHJpbSgpKSB7XG4gICAgICBzZXRDb2x1bW5zKGNvbHVtbnMubWFwKGMgPT4gYy5pZCA9PT0gaWQgPyB7IC4uLmMsIHRpdGxlOiBlZGl0aW5nQ29sdW1uVGl0bGUudHJpbSgpIH0gOiBjKSk7XG4gICAgfVxuICAgIHNldEVkaXRpbmdDb2x1bW5JZChudWxsKTtcbiAgfTtcblxuICBjb25zdCBoYW5kbGVEZWxldGVDb2x1bW4gPSAoaWQ6IHN0cmluZykgPT4ge1xuICAgIHNldENvbHVtbnMoY29sdW1ucy5maWx0ZXIoYyA9PiBjLmlkICE9PSBpZCkpO1xuICB9O1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgbG9jYWxTdG9yYWdlLnNldEl0ZW0oYGJvYXJkLWNvbHVtbnMtJHtwcm9qZWN0SWQgfHwgJ2FsbCd9YCwgSlNPTi5zdHJpbmdpZnkoY29sdW1ucykpO1xuICB9LCBbY29sdW1ucywgcHJvamVjdElkXSk7XG5cbiAgY29uc3QgW2lzTW9kYWxPcGVuLCBzZXRJc01vZGFsT3Blbl0gPSB1c2VTdGF0ZShmYWxzZSk7XG4gIGNvbnN0IFtpc1dvcmtsb2FkTW9kYWxPcGVuLCBzZXRJc1dvcmtsb2FkTW9kYWxPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcbiAgY29uc3QgW2lzQWN0aXZpdHlNb2RhbE9wZW4sIHNldElzQWN0aXZpdHlNb2RhbE9wZW5dID0gdXNlU3RhdGUoZmFsc2UpO1xuICBjb25zdCBbZWRpdGluZ1Rhc2ssIHNldEVkaXRpbmdUYXNrXSA9IHVzZVN0YXRlPFRhc2sgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW3NlbGVjdGVkUGFyZW50SWQsIHNldFNlbGVjdGVkUGFyZW50SWRdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtzZWxlY3RlZFN0YXR1cywgc2V0U2VsZWN0ZWRTdGF0dXNdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG4gIGNvbnN0IFtsb2FkaW5nLCBzZXRMb2FkaW5nXSA9IHVzZVN0YXRlKHRydWUpO1xuICBjb25zdCBbc29ydEJ5LCBzZXRTb3J0QnldID0gdXNlU3RhdGU8U29ydE9wdGlvbj4oJ2N1c3RvbScpO1xuICBjb25zdCBbc29ydERpciwgc2V0U29ydERpcl0gPSB1c2VTdGF0ZTxTb3J0RGlyZWN0aW9uPignYXNjJyk7XG4gIGNvbnN0IFtzZWFyY2hRdWVyeSwgc2V0U2VhcmNoUXVlcnldID0gdXNlU3RhdGUoJycpO1xuICBjb25zdCBbZmlsdGVyQXNzaWduZWUsIHNldEZpbHRlckFzc2lnbmVlXSA9IHVzZVN0YXRlPHN0cmluZz4oJ2FsbCcpO1xuICBjb25zdCBbZmlsdGVyUHJpb3JpdHksIHNldEZpbHRlclByaW9yaXR5XSA9IHVzZVN0YXRlPHN0cmluZz4oJ2FsbCcpO1xuICBjb25zdCBbZmlsdGVyU3RhdHVzLCBzZXRGaWx0ZXJTdGF0dXNdID0gdXNlU3RhdGU8c3RyaW5nPignYWxsJyk7XG4gIGNvbnN0IFtzZWxlY3RlZFRhc2tJZHMsIHNldFNlbGVjdGVkVGFza0lkc10gPSB1c2VTdGF0ZTxTZXQ8c3RyaW5nPj4obmV3IFNldCgpKTtcbiAgY29uc3QgW2RyYWdnaW5nVGFza0lkLCBzZXREcmFnZ2luZ1Rhc2tJZF0gPSB1c2VTdGF0ZTxzdHJpbmcgfCBudWxsPihudWxsKTtcbiAgY29uc3QgW2RyYWdnaW5nQ29sdW1uSWQsIHNldERyYWdnaW5nQ29sdW1uSWRdID0gdXNlU3RhdGU8c3RyaW5nIHwgbnVsbD4obnVsbCk7XG5cbiAgY29uc3QgaGFuZGxlQ29sdW1uRHJhZ0VudGVyID0gKHRhcmdldENvbElkOiBzdHJpbmcpID0+IHtcbiAgICBpZiAoIWRyYWdnaW5nQ29sdW1uSWQgfHwgZHJhZ2dpbmdDb2x1bW5JZCA9PT0gdGFyZ2V0Q29sSWQpIHJldHVybjtcbiAgICBzZXRDb2x1bW5zKHByZXYgPT4ge1xuICAgICAgY29uc3Qgc291cmNlSWR4ID0gcHJldi5maW5kSW5kZXgoYyA9PiBjLmlkID09PSBkcmFnZ2luZ0NvbHVtbklkKTtcbiAgICAgIGNvbnN0IHRhcmdldElkeCA9IHByZXYuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gdGFyZ2V0Q29sSWQpO1xuICAgICAgaWYgKHNvdXJjZUlkeCAhPT0gLTEgJiYgdGFyZ2V0SWR4ICE9PSAtMSkge1xuICAgICAgICBjb25zdCBuZXdDb2xzID0gWy4uLnByZXZdO1xuICAgICAgICBjb25zdCBbZHJhZ2dlZF0gPSBuZXdDb2xzLnNwbGljZShzb3VyY2VJZHgsIDEpO1xuICAgICAgICBuZXdDb2xzLnNwbGljZSh0YXJnZXRJZHgsIDAsIGRyYWdnZWQpO1xuICAgICAgICByZXR1cm4gbmV3Q29scztcbiAgICAgIH1cbiAgICAgIHJldHVybiBwcmV2O1xuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IFtpc0V4cG9ydE1lbnVPcGVuLCBzZXRJc0V4cG9ydE1lbnVPcGVuXSA9IHVzZVN0YXRlKGZhbHNlKTtcblxuICBjb25zdCBoYW5kbGVFeHBvcnRDU1YgPSAoKSA9PiB7XG4gICAgc2V0SXNFeHBvcnRNZW51T3BlbihmYWxzZSk7XG4gICAgY29uc3QgZXhwb3J0RGF0YSA9IGZpbHRlcmVkVGFza3MubWFwKHQgPT4gKHtcbiAgICAgIElEOiB0LmlkLFxuICAgICAgUHJvamVjdDogdC5wcm9qZWN0SWQgfHwgJycsXG4gICAgICBUaXRsZTogdC50aXRsZSxcbiAgICAgIERlc2NyaXB0aW9uOiB0LmRlc2NyaXB0aW9uIHx8ICcnLFxuICAgICAgU3RhdHVzOiB0LnN0YXR1cyxcbiAgICAgIFByaW9yaXR5OiB0LnByaW9yaXR5LFxuICAgICAgQXNzaWduZWU6IHVzZXJzLmZpbmQodSA9PiB1LmlkID09PSB0LmFzc2lnbmVlSWQpPy5uYW1lIHx8ICdVbmFzc2lnbmVkJyxcbiAgICAgIEJyYW5jaDogdC5icmFuY2hOYW1lIHx8ICcnLFxuICAgICAgRGVhZGxpbmU6IHQuZGVhZGxpbmUgfHwgJycsXG4gICAgICBDcmVhdGVkOiB0LmNyZWF0ZWRBdFxuICAgIH0pKTtcbiAgICBleHBvcnRUb0NTVihgdGFza3MtJHtwcm9qZWN0Py5uYW1lIHx8ICdhbGwnfWAsIGV4cG9ydERhdGEpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUV4cG9ydEpTT04gPSAoKSA9PiB7XG4gICAgc2V0SXNFeHBvcnRNZW51T3BlbihmYWxzZSk7XG4gICAgZXhwb3J0VG9KU09OKGB0YXNrcy0ke3Byb2plY3Q/Lm5hbWUgfHwgJ2FsbCd9YCwgZmlsdGVyZWRUYXNrcyk7XG4gIH07XG5cbiAgY29uc3QgZmV0Y2hEYXRhID0gYXN5bmMgKCkgPT4ge1xuICAgIHRyeSB7XG4gICAgICBjb25zdCByZXN1bHRzID0gYXdhaXQgUHJvbWlzZS5hbGwoW1xuICAgICAgICBmZXRjaCgnL2FwaS90YXNrcycsIHsgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCB9IH0pLFxuICAgICAgICBmZXRjaCgnL2FwaS91c2VycycsIHsgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCB9IH0pLFxuICAgICAgICBmZXRjaCgnL2FwaS9wcm9qZWN0cycsIHsgaGVhZGVyczogeyBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCB9IH0pLFxuICAgICAgICBmZXRjaCgnL2FwaS9taWxlc3RvbmVzJywgeyBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gIH0gfSlcbiAgICAgIF0pO1xuICAgICAgXG4gICAgICBjb25zdCB0YXNrc0RhdGE6IFRhc2tbXSA9IGF3YWl0IHJlc3VsdHNbMF0uanNvbigpO1xuICAgICAgY29uc3QgdXNlcnNEYXRhID0gYXdhaXQgcmVzdWx0c1sxXS5qc29uKCk7XG4gICAgICBjb25zdCBwcm9qZWN0c0RhdGE6IFByb2plY3RbXSA9IGF3YWl0IHJlc3VsdHNbMl0uanNvbigpO1xuICAgICAgY29uc3QgbWlsZXN0b25lc0RhdGE6IE1pbGVzdG9uZVtdID0gYXdhaXQgcmVzdWx0c1szXS5qc29uKCk7XG4gICAgICBcbiAgICAgIHNldEFsbFByb2plY3RzKHByb2plY3RzRGF0YSk7XG4gICAgICBzZXRNaWxlc3RvbmVzKG1pbGVzdG9uZXNEYXRhKTtcbiAgICAgIFxuICAgICAgaWYgKHByb2plY3RJZCkge1xuICAgICAgICBjb25zdCBmb3VuZCA9IHByb2plY3RzRGF0YS5maW5kKChwOiBQcm9qZWN0KSA9PiBwLmlkID09PSBwcm9qZWN0SWQpO1xuICAgICAgICBzZXRQcm9qZWN0KGZvdW5kIHx8IG51bGwpO1xuICAgICAgICAvLyBGaWx0ZXIgdGFza3MgYnkgdGhpcyBwcm9qZWN0XG4gICAgICAgIHNldFRhc2tzKHRhc2tzRGF0YS5maWx0ZXIoKHQ6IFRhc2spID0+IHQucHJvamVjdElkID09PSBwcm9qZWN0SWQpKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHNldFByb2plY3QobnVsbCk7XG4gICAgICAgIHNldFRhc2tzKHRhc2tzRGF0YSk7XG4gICAgICB9XG4gICAgICBcbiAgICAgIHNldFVzZXJzKHVzZXJzRGF0YSk7XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBjb25zb2xlLmVycm9yKGVycik7XG4gICAgfSBmaW5hbGx5IHtcbiAgICAgIHNldExvYWRpbmcoZmFsc2UpO1xuICAgIH1cbiAgfTtcblxuICB1c2VFZmZlY3QoKCkgPT4ge1xuICAgIGZldGNoRGF0YSgpO1xuICB9LCBbdG9rZW4sIHByb2plY3RJZF0pO1xuXG4gIGNvbnN0IHNvcnRlZFRhc2tzID0gdXNlTWVtbygoKSA9PiB7XG4gICAgcmV0dXJuIFsuLi50YXNrc10uc29ydCgoYSwgYikgPT4ge1xuICAgICAgbGV0IGNvbXBhcmlzb24gPSAwO1xuICAgICAgXG4gICAgICBpZiAoc29ydEJ5ID09PSAnY3VzdG9tJykge1xuICAgICAgICBjb21wYXJpc29uID0gKGEub3JkZXJJbmRleCB8fCAwKSAtIChiLm9yZGVySW5kZXggfHwgMCk7XG4gICAgICB9IGVsc2UgaWYgKHNvcnRCeSA9PT0gJ3ByaW9yaXR5Jykge1xuICAgICAgICBjb21wYXJpc29uID0gcHJpb3JpdHlXZWlnaHRbYS5wcmlvcml0eV0gLSBwcmlvcml0eVdlaWdodFtiLnByaW9yaXR5XTtcbiAgICAgIH0gZWxzZSBpZiAoc29ydEJ5ID09PSAnZGVhZGxpbmUnKSB7XG4gICAgICAgIGNvbnN0IHRBID0gYS5kZWFkbGluZSA/IG5ldyBEYXRlKGEuZGVhZGxpbmUpLmdldFRpbWUoKSA6IDA7XG4gICAgICAgIGNvbnN0IHRCID0gYi5kZWFkbGluZSA/IG5ldyBEYXRlKGIuZGVhZGxpbmUpLmdldFRpbWUoKSA6IDA7XG4gICAgICAgIGNvbXBhcmlzb24gPSAoaXNOYU4odEEpID8gMCA6IHRBKSAtIChpc05hTih0QikgPyAwIDogdEIpO1xuICAgICAgfSBlbHNlIGlmIChzb3J0QnkgPT09ICdjcmVhdGVkQXQnKSB7XG4gICAgICAgIGNvbnN0IHRBID0gYS5jcmVhdGVkQXQgPyBuZXcgRGF0ZShhLmNyZWF0ZWRBdCkuZ2V0VGltZSgpIDogMDtcbiAgICAgICAgY29uc3QgdEIgPSBiLmNyZWF0ZWRBdCA/IG5ldyBEYXRlKGIuY3JlYXRlZEF0KS5nZXRUaW1lKCkgOiAwO1xuICAgICAgICBjb21wYXJpc29uID0gKGlzTmFOKHRBKSA/IDAgOiB0QSkgLSAoaXNOYU4odEIpID8gMCA6IHRCKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHNvcnREaXIgPT09ICdhc2MnID8gY29tcGFyaXNvbiA6IC1jb21wYXJpc29uO1xuICAgIH0pO1xuICB9LCBbdGFza3MsIHNvcnRCeSwgc29ydERpcl0pO1xuXG4gIGNvbnN0IGZpbHRlcmVkVGFza3MgPSB1c2VNZW1vKCgpID0+IHtcbiAgICBsZXQgcmVzdWx0ID0gc29ydGVkVGFza3M7XG5cbiAgICBpZiAoZmlsdGVyQXNzaWduZWUgIT09ICdhbGwnKSB7XG4gICAgICByZXN1bHQgPSByZXN1bHQuZmlsdGVyKHQgPT4gdC5hc3NpZ25lZUlkID09PSBmaWx0ZXJBc3NpZ25lZSk7XG4gICAgfVxuICAgIFxuICAgIGlmIChmaWx0ZXJQcmlvcml0eSAhPT0gJ2FsbCcpIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIodCA9PiB0LnByaW9yaXR5ID09PSBmaWx0ZXJQcmlvcml0eSk7XG4gICAgfVxuXG4gICAgaWYgKGZpbHRlclN0YXR1cyAhPT0gJ2FsbCcpIHtcbiAgICAgIHJlc3VsdCA9IHJlc3VsdC5maWx0ZXIodCA9PiB0LnN0YXR1cyA9PT0gZmlsdGVyU3RhdHVzKTtcbiAgICB9XG5cbiAgICBpZiAoIXNlYXJjaFF1ZXJ5LnRyaW0oKSkgcmV0dXJuIHJlc3VsdDtcbiAgICBjb25zdCBsb3dlclF1ZXJ5ID0gc2VhcmNoUXVlcnkudG9Mb3dlckNhc2UoKTtcbiAgICBcbiAgICBjb25zdCBtYXRjaGluZ1Rhc2tzID0gbmV3IFNldDxzdHJpbmc+KCk7XG4gICAgXG4gICAgcmVzdWx0LmZvckVhY2godCA9PiB7XG4gICAgICBpZiAodC50aXRsZS50b0xvd2VyQ2FzZSgpLmluY2x1ZGVzKGxvd2VyUXVlcnkpIHx8ICh0LmRlc2NyaXB0aW9uICYmIHQuZGVzY3JpcHRpb24udG9Mb3dlckNhc2UoKS5pbmNsdWRlcyhsb3dlclF1ZXJ5KSkpIHtcbiAgICAgICAgbWF0Y2hpbmdUYXNrcy5hZGQodC5pZCk7XG4gICAgICAgIGlmICh0LnBhcmVudElkKSBtYXRjaGluZ1Rhc2tzLmFkZCh0LnBhcmVudElkKTsgLy8gSW5jbHVkZSBwYXJlbnQgaWYgc3VidGFzayBtYXRjaGVzXG4gICAgICB9XG4gICAgfSk7XG4gICAgXG4gICAgLy8gSW5jbHVkZSBhbGwgc3VidGFza3MgaWYgcGFyZW50IG1hdGNoZXNcbiAgICByZXN1bHQuZm9yRWFjaCh0ID0+IHtcbiAgICAgIGlmICh0LnBhcmVudElkICYmIG1hdGNoaW5nVGFza3MuaGFzKHQucGFyZW50SWQpKSB7XG4gICAgICAgIG1hdGNoaW5nVGFza3MuYWRkKHQuaWQpO1xuICAgICAgfVxuICAgIH0pO1xuXG4gICAgcmV0dXJuIHJlc3VsdC5maWx0ZXIodCA9PiBtYXRjaGluZ1Rhc2tzLmhhcyh0LmlkKSk7XG4gIH0sIFtzb3J0ZWRUYXNrcywgc2VhcmNoUXVlcnksIGZpbHRlckFzc2lnbmVlLCBmaWx0ZXJQcmlvcml0eSwgZmlsdGVyU3RhdHVzXSk7XG5cbiAgY29uc3QgaGFuZGxlQ3JlYXRlVGFzayA9ICgpID0+IHtcbiAgICBzZXRFZGl0aW5nVGFzayhudWxsKTtcbiAgICBzZXRTZWxlY3RlZFBhcmVudElkKG51bGwpO1xuICAgIHNldFNlbGVjdGVkU3RhdHVzKG51bGwpO1xuICAgIHNldElzTW9kYWxPcGVuKHRydWUpO1xuICB9O1xuXG4gIHVzZUVmZmVjdCgoKSA9PiB7XG4gICAgY29uc3QgaGFuZGxlR2xvYmFsTmV3VGFzayA9ICgpID0+IGhhbmRsZUNyZWF0ZVRhc2soKTtcbiAgICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcignb3Blbi1uZXctdGFzay1tb2RhbCcsIGhhbmRsZUdsb2JhbE5ld1Rhc2spO1xuICAgIHJldHVybiAoKSA9PiB3aW5kb3cucmVtb3ZlRXZlbnRMaXN0ZW5lcignb3Blbi1uZXctdGFzay1tb2RhbCcsIGhhbmRsZUdsb2JhbE5ld1Rhc2spO1xuICB9LCBbXSk7XG5cbiAgY29uc3QgaGFuZGxlQ3JlYXRlVGFza0luQ29sdW1uID0gKHN0YXR1czogc3RyaW5nKSA9PiB7XG4gICAgc2V0RWRpdGluZ1Rhc2sobnVsbCk7XG4gICAgc2V0U2VsZWN0ZWRQYXJlbnRJZChudWxsKTtcbiAgICBzZXRTZWxlY3RlZFN0YXR1cyhzdGF0dXMpO1xuICAgIHNldElzTW9kYWxPcGVuKHRydWUpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZURyb3BUYXNrID0gYXN5bmMgKHRhc2tJZDogc3RyaW5nLCB0YXJnZXRTdGF0dXM6IHN0cmluZywgaG92ZXJUYXNrSWQ/OiBzdHJpbmcsIGRyb3BQb3NpdGlvbj86ICdiZWZvcmUnIHwgJ2FmdGVyJykgPT4ge1xuICAgIHNldERyYWdnaW5nVGFza0lkKG51bGwpO1xuICAgIGNvbnN0IHRhc2sgPSB0YXNrcy5maW5kKHQgPT4gdC5pZCA9PT0gdGFza0lkKTtcbiAgICBpZiAoIXRhc2spIHJldHVybjtcblxuICAgIGlmICh0YXJnZXRTdGF0dXMgPT09ICdkb25lJyAmJiB0YXNrLnN0YXR1cyAhPT0gJ2RvbmUnKSB7XG4gICAgICBjb25zdCBkZXBzID0gdGFzay5kZXBlbmRlbmNpZXMgfHwgW107XG4gICAgICBjb25zdCBwZW5kaW5nRGVwcyA9IGRlcHMuZmlsdGVyKGRlcElkID0+IHtcbiAgICAgICAgY29uc3QgZGVwID0gdGFza3MuZmluZCh0ID0+IHQuaWQgPT09IGRlcElkKTtcbiAgICAgICAgcmV0dXJuIGRlcCAmJiBkZXAuc3RhdHVzICE9PSAnZG9uZSc7XG4gICAgICB9KTtcbiAgICAgIGlmIChwZW5kaW5nRGVwcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIGVycm9yKGBDYW5ub3QgY29tcGxldGUgdGFzay4gJHtwZW5kaW5nRGVwcy5sZW5ndGh9IGRlcGVuZGVuY2llcyBhcmUgc3RpbGwgcGVuZGluZy5gKTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgIH1cblxuICAgIGxldCBuZXdPcmRlckluZGV4ID0gdGFzay5vcmRlckluZGV4O1xuXG4gICAgY29uc3QgY29sdW1uVGFza3MgPSBzb3J0ZWRUYXNrcy5maWx0ZXIodCA9PiB0LnN0YXR1cyA9PT0gdGFyZ2V0U3RhdHVzICYmIHQucGFyZW50SWQgPT09IHRhc2sucGFyZW50SWQpO1xuICAgIFxuICAgIC8vIEV4cGxpY2l0IHJlb3JkZXJpbmcgLSBleGNsdWRlIHRoZSBkcmFnZ2VkIHRhc2sgZnJvbSBjb2x1bW4gVGFza3MgdG8gYXZvaWQgaW5kZXggc2hpZnRpbmcgYnVnc1xuICAgIGNvbnN0IGNvbHVtblRhc2tzV2l0aG91dERyYWdnZWQgPSBjb2x1bW5UYXNrcy5maWx0ZXIodCA9PiB0LmlkICE9PSB0YXNrSWQpO1xuXG4gICAgaWYgKGhvdmVyVGFza0lkKSB7XG4gICAgICBpZiAoc29ydEJ5ICE9PSAnY3VzdG9tJykge1xuICAgICAgICBzZXRTb3J0QnkoJ2N1c3RvbScpO1xuICAgICAgICBzZXRTb3J0RGlyKCdhc2MnKTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgY29uc3QgaG92ZXJJbmRleCA9IGNvbHVtblRhc2tzV2l0aG91dERyYWdnZWQuZmluZEluZGV4KHQgPT4gdC5pZCA9PT0gaG92ZXJUYXNrSWQpO1xuICAgICAgaWYgKGhvdmVySW5kZXggIT09IC0xKSB7XG4gICAgICAgIGlmIChkcm9wUG9zaXRpb24gPT09ICdiZWZvcmUnKSB7XG4gICAgICAgICAgY29uc3QgcHJldlRhc2sgPSBjb2x1bW5UYXNrc1dpdGhvdXREcmFnZ2VkW2hvdmVySW5kZXggLSAxXTtcbiAgICAgICAgICBjb25zdCBob3ZlclRhc2sgPSBjb2x1bW5UYXNrc1dpdGhvdXREcmFnZ2VkW2hvdmVySW5kZXhdO1xuICAgICAgICAgIGlmIChwcmV2VGFzaykge1xuICAgICAgICAgICAgbmV3T3JkZXJJbmRleCA9ICgocHJldlRhc2sub3JkZXJJbmRleCB8fCAwKSArIChob3ZlclRhc2sub3JkZXJJbmRleCB8fCAwKSkgLyAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXdPcmRlckluZGV4ID0gKGhvdmVyVGFzay5vcmRlckluZGV4IHx8IDApICsgKHNvcnREaXIgPT09ICdhc2MnID8gLTEwMDAgOiAxMDAwKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgY29uc3QgaG92ZXJUYXNrID0gY29sdW1uVGFza3NXaXRob3V0RHJhZ2dlZFtob3ZlckluZGV4XTtcbiAgICAgICAgICBjb25zdCBuZXh0VGFzayA9IGNvbHVtblRhc2tzV2l0aG91dERyYWdnZWRbaG92ZXJJbmRleCArIDFdO1xuICAgICAgICAgIGlmIChuZXh0VGFzaykge1xuICAgICAgICAgICAgbmV3T3JkZXJJbmRleCA9ICgoaG92ZXJUYXNrLm9yZGVySW5kZXggfHwgMCkgKyAobmV4dFRhc2sub3JkZXJJbmRleCB8fCAwKSkgLyAyO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBuZXdPcmRlckluZGV4ID0gKGhvdmVyVGFzay5vcmRlckluZGV4IHx8IDApICsgKHNvcnREaXIgPT09ICdhc2MnID8gMTAwMCA6IC0xMDAwKTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKGNvbHVtblRhc2tzV2l0aG91dERyYWdnZWQubGVuZ3RoID4gMCkge1xuICAgICAgaWYgKHRhc2suc3RhdHVzICE9PSB0YXJnZXRTdGF0dXMpIHtcbiAgICAgICAgY29uc3QgbGFzdFRhc2sgPSBjb2x1bW5UYXNrc1dpdGhvdXREcmFnZ2VkW2NvbHVtblRhc2tzV2l0aG91dERyYWdnZWQubGVuZ3RoIC0gMV07XG4gICAgICAgIG5ld09yZGVySW5kZXggPSAobGFzdFRhc2sub3JkZXJJbmRleCB8fCAwKSArIChzb3J0RGlyID09PSAnYXNjJyA/IDEwMDAgOiAtMTAwMCk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIG5ld09yZGVySW5kZXggPSBEYXRlLm5vdygpO1xuICAgIH1cblxuICAgIC8vIE9wdGltaXN0aWMgdXBkYXRlXG4gICAgc2V0VGFza3ModGFza3MubWFwKHQgPT4gdC5pZCA9PT0gdGFza0lkID8geyAuLi50LCBzdGF0dXM6IHRhcmdldFN0YXR1cyBhcyBhbnksIG9yZGVySW5kZXg6IG5ld09yZGVySW5kZXggfSA6IHQpKTtcbiAgICBcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZmV0Y2goYC9hcGkvdGFza3MvJHt0YXNrSWR9YCwge1xuICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICBoZWFkZXJzOiB7IFxuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAgXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgLi4udGFzaywgc3RhdHVzOiB0YXJnZXRTdGF0dXMsIG9yZGVySW5kZXg6IG5ld09yZGVySW5kZXggfSlcbiAgICAgIH0pO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgY29uc29sZS5lcnJvcignRmFpbGVkIHRvIHVwZGF0ZSBzdGF0dXMnLCBlcnIpO1xuICAgIH0gZmluYWxseSB7XG4gICAgICBmZXRjaERhdGEoKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlQ3JlYXRlU3VidGFzayA9IChwYXJlbnRJZDogc3RyaW5nLCBlPzogUmVhY3QuTW91c2VFdmVudCkgPT4ge1xuICAgIGlmIChlKSBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgIHNldEVkaXRpbmdUYXNrKG51bGwpO1xuICAgIHNldFNlbGVjdGVkUGFyZW50SWQocGFyZW50SWQpO1xuICAgIHNldElzTW9kYWxPcGVuKHRydWUpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUVkaXRUYXNrID0gKHRhc2s6IFRhc2spID0+IHtcbiAgICBzZXRFZGl0aW5nVGFzayh0YXNrKTtcbiAgICBzZXRTZWxlY3RlZFBhcmVudElkKG51bGwpO1xuICAgIHNldElzTW9kYWxPcGVuKHRydWUpO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZVNhdmVUYXNrID0gYXN5bmMgKHRhc2tEYXRhOiBQYXJ0aWFsPFRhc2s+KSA9PiB7XG4gICAgY29uc3QgaXNFZGl0ID0gISFlZGl0aW5nVGFzaztcbiAgICBjb25zdCB1cmwgPSBpc0VkaXQgPyBgL2FwaS90YXNrcy8ke2VkaXRpbmdUYXNrIS5pZH1gIDogJy9hcGkvdGFza3MnO1xuICAgIGNvbnN0IG1ldGhvZCA9IGlzRWRpdCA/ICdQVVQnIDogJ1BPU1QnO1xuXG4gICAgdHJ5IHtcbiAgICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgICBtZXRob2QsXG4gICAgICAgIGhlYWRlcnM6IHsgXG4gICAgICAgICAgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyxcbiAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCBcbiAgICAgICAgfSxcbiAgICAgICAgYm9keTogSlNPTi5zdHJpbmdpZnkodGFza0RhdGEpXG4gICAgICB9KTtcbiAgICAgIGlmIChyZXMub2spIHtcbiAgICAgICAgc2V0SXNNb2RhbE9wZW4oZmFsc2UpO1xuICAgICAgICBmZXRjaERhdGEoKTtcbiAgICAgICAgc3VjY2VzcyhlZGl0aW5nVGFzayA/ICdUYXNrIHVwZGF0ZWQnIDogJ1Rhc2sgY3JlYXRlZCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc3QgZXJyRGF0YSA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gICAgICAgIGVycm9yKGBGYWlsZWQgdG8gc2F2ZSB0YXNrOiAke2VyckRhdGF9YCk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgIGNvbnNvbGUuZXJyb3IoZXJyKTtcbiAgICAgIGVycm9yKGBFcnJvciBzYXZpbmcgdGFzazogJHtlcnIubWVzc2FnZX1gKTtcbiAgICB9XG4gIH07XG5cbiAgY29uc3QgaGFuZGxlVXBkYXRlVGFzayA9IGFzeW5jICh0YXNrSWQ6IHN0cmluZywgY3VycmVudFRhc2s6IFRhc2ssIHVwZGF0ZXM6IFBhcnRpYWw8VGFzaz4pID0+IHtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgZmV0Y2goYC9hcGkvdGFza3MvJHt0YXNrSWR9YCwge1xuICAgICAgICBtZXRob2Q6ICdQVVQnLFxuICAgICAgICBoZWFkZXJzOiB7IFxuICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAgXG4gICAgICAgIH0sXG4gICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgLi4uY3VycmVudFRhc2ssIC4uLnVwZGF0ZXMgfSlcbiAgICAgIH0pO1xuICAgICAgZmV0Y2hEYXRhKCk7XG4gICAgICBpZiAodXBkYXRlcy5zdGF0dXMgPT09ICdkb25lJykge1xuICAgICAgICBzdWNjZXNzKCdUYXNrIGNvbXBsZXRlZCcpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3VjY2Vzcyh1cGRhdGVzLm9yZGVySW5kZXggIT09IHVuZGVmaW5lZCAmJiBPYmplY3Qua2V5cyh1cGRhdGVzKS5sZW5ndGggPT09IDEgPyAnVGFzayByZW9yZGVyZWQnIDogJ1Rhc2sgdXBkYXRlZCcpO1xuICAgICAgfVxuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgZXJyb3IoJ0ZhaWxlZCB0byB1cGRhdGUgdGFzaycpO1xuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCB0b2dnbGVTZWxlY3Rpb24gPSAodGFza0lkOiBzdHJpbmcpID0+IHtcbiAgICBzZXRTZWxlY3RlZFRhc2tJZHMocHJldiA9PiB7XG4gICAgICBjb25zdCBuZXdTZXQgPSBuZXcgU2V0KHByZXYpO1xuICAgICAgaWYgKG5ld1NldC5oYXModGFza0lkKSkge1xuICAgICAgICBuZXdTZXQuZGVsZXRlKHRhc2tJZCk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdTZXQuYWRkKHRhc2tJZCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gbmV3U2V0O1xuICAgIH0pO1xuICB9O1xuXG4gIGNvbnN0IGhhbmRsZUJ1bGtVcGRhdGUgPSBhc3luYyAodXBkYXRlczogUGFydGlhbDxUYXNrPikgPT4ge1xuICAgIGlmIChzZWxlY3RlZFRhc2tJZHMuc2l6ZSA9PT0gMCkgcmV0dXJuO1xuICAgIHRyeSB7XG4gICAgICBjb25zdCBzZWxlY3RlZFRhc2tzID0gdGFza3MuZmlsdGVyKHQgPT4gc2VsZWN0ZWRUYXNrSWRzLmhhcyh0LmlkKSk7XG4gICAgICBhd2FpdCBQcm9taXNlLmFsbChzZWxlY3RlZFRhc2tzLm1hcCh0ID0+IFxuICAgICAgICBmZXRjaChgL2FwaS90YXNrcy8ke3QuaWR9YCwge1xuICAgICAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICAgICAgaGVhZGVyczogeyBcbiAgICAgICAgICAgICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicsXG4gICAgICAgICAgICBBdXRob3JpemF0aW9uOiBgQmVhcmVyICR7dG9rZW59YCBcbiAgICAgICAgICB9LFxuICAgICAgICAgIGJvZHk6IEpTT04uc3RyaW5naWZ5KHsgLi4udCwgLi4udXBkYXRlcyB9KVxuICAgICAgICB9KVxuICAgICAgKSk7XG4gICAgICBzZXRTZWxlY3RlZFRhc2tJZHMobmV3IFNldCgpKTtcbiAgICAgIGZldGNoRGF0YSgpO1xuICAgICAgaWYgKHVwZGF0ZXMuc3RhdHVzID09PSAnZG9uZScpIHtcbiAgICAgICAgc3VjY2VzcygnVGFza3MgY29tcGxldGVkJyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBzdWNjZXNzKCdUYXNrcyB1cGRhdGVkJyk7XG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBlcnJvcignQnVsayB1cGRhdGUgZmFpbGVkJyk7XG4gICAgICBjb25zb2xlLmVycm9yKCdCdWxrIHVwZGF0ZSBmYWlsZWQnLCBlcnIpO1xuICAgIH1cbiAgfTtcblxuICBjb25zdCBoYW5kbGVCdWxrRGVsZXRlID0gYXN5bmMgKCkgPT4ge1xuICAgIGlmIChzZWxlY3RlZFRhc2tJZHMuc2l6ZSA9PT0gMCkgcmV0dXJuO1xuICAgIGlmICghd2luZG93LmNvbmZpcm0oYEFyZSB5b3Ugc3VyZSB5b3Ugd2FudCB0byBkZWxldGUgJHtzZWxlY3RlZFRhc2tJZHMuc2l6ZX0gdGFza3M/YCkpIHJldHVybjtcbiAgICB0cnkge1xuICAgICAgYXdhaXQgUHJvbWlzZS5hbGwoQXJyYXkuZnJvbShzZWxlY3RlZFRhc2tJZHMpLm1hcChpZCA9PiBcbiAgICAgICAgZmV0Y2goYC9hcGkvdGFza3MvJHtpZH1gLCB7XG4gICAgICAgICAgbWV0aG9kOiAnREVMRVRFJyxcbiAgICAgICAgICBoZWFkZXJzOiB7IEF1dGhvcml6YXRpb246IGBCZWFyZXIgJHt0b2tlbn1gIH1cbiAgICAgICAgfSlcbiAgICAgICkpO1xuICAgICAgc2V0U2VsZWN0ZWRUYXNrSWRzKG5ldyBTZXQoKSk7XG4gICAgICBmZXRjaERhdGEoKTtcbiAgICAgIHN1Y2Nlc3MoJ1Rhc2tzIGRlbGV0ZWQnKTtcbiAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgIGVycm9yKCdCdWxrIGRlbGV0ZSBmYWlsZWQnKTtcbiAgICAgIGNvbnNvbGUuZXJyb3IoJ0J1bGsgZGVsZXRlIGZhaWxlZCcsIGVycik7XG4gICAgfVxuICB9O1xuXG4gIGNvbnN0IGhhbmRsZURlbGV0ZVRhc2sgPSBhc3luYyAodGFza0lkOiBzdHJpbmcpID0+IHtcblxuICAgIHRyeSB7XG4gICAgICBhd2FpdCBmZXRjaChgL2FwaS90YXNrcy8ke3Rhc2tJZH1gLCB7XG4gICAgICAgIG1ldGhvZDogJ0RFTEVURScsXG4gICAgICAgIGhlYWRlcnM6IHsgQXV0aG9yaXphdGlvbjogYEJlYXJlciAke3Rva2VufWAgfVxuICAgICAgfSk7XG4gICAgICBmZXRjaERhdGEoKTtcbiAgICAgIHN1Y2Nlc3MoJ1Rhc2sgZGVsZXRlZCcpO1xuICAgIH0gY2F0Y2ggKGVycikge1xuICAgICAgZXJyb3IoJ0ZhaWxlZCB0byBkZWxldGUgdGFzaycpO1xuICAgICAgY29uc29sZS5lcnJvcihlcnIpO1xuICAgIH1cbiAgfTtcblxuICBpZiAobG9hZGluZykgcmV0dXJuIDxkaXYgY2xhc3NOYW1lPVwicC04IHRleHQtcHJpbWFyeVwiPkxvYWRpbmcgYm9hcmQuLi48L2Rpdj47XG5cbiAgaWYgKCFwcm9qZWN0SWQpIHtcbiAgICBpZiAoYWxsUHJvamVjdHMubGVuZ3RoID09PSAxKSB7XG4gICAgICByZXR1cm4gPE5hdmlnYXRlIHRvPXtgL2JvYXJkP3Byb2plY3RJZD0ke2FsbFByb2plY3RzWzBdLmlkfWB9IHJlcGxhY2UgLz47XG4gICAgfVxuICAgIFxuICAgIHJldHVybiAoXG4gICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXgtMSBmbGV4IGZsZXgtY29sIHAtOCBiZy1wYWdlLWJnIG92ZXJmbG93LXktYXV0b1wiPlxuICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC14bCBmb250LXNlbWlib2xkIHRleHQtc3Ryb25nIHRyYWNraW5nLXRpZ2h0IG9wYWNpdHktOTAgbWItMlwiPlNlbGVjdCBhIFByb2plY3Q8L2gxPlxuICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc3VidGxlIG1iLThcIj5DaG9vc2UgYSBwcm9qZWN0IHRvIHZpZXcgaXRzIHRhc2sgYm9hcmQ8L3A+XG4gICAgICAgIFxuICAgICAgICB7YWxsUHJvamVjdHMubGVuZ3RoID09PSAwID8gKFxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1jZW50ZXIgcC0xMiBiZy1zdXJmYWNlIGJvcmRlciBib3JkZXItYm9yZGVyLXN1YnRsZSByb3VuZGVkLWxnXCI+XG4gICAgICAgICAgICA8aDIgY2xhc3NOYW1lPVwidGV4dC1sZyBmb250LW1lZGl1bSB0ZXh0LXN0cm9uZyBtYi0yXCI+Tm8gcHJvamVjdHMgZm91bmQ8L2gyPlxuICAgICAgICAgICAgPHAgY2xhc3NOYW1lPVwidGV4dC1zbSB0ZXh0LXN1YnRsZSBtYi00XCI+WW91IG5lZWQgdG8gY3JlYXRlIGEgcHJvamVjdCBmaXJzdCBiZWZvcmUgbWFuYWdpbmcgdGFza3MuPC9wPlxuICAgICAgICAgICAgPExpbmsgdG89XCIvcHJvamVjdHNcIiBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgcHgtNCBweS0yIGJnLWJsdWUtNjAwIGhvdmVyOmJnLWJsdWUtNTAwIHRleHQtc3Ryb25nIHRleHQtc20gZm9udC1tZWRpdW0gcm91bmRlZCB0cmFuc2l0aW9uLWNvbG9yc1wiPlxuICAgICAgICAgICAgICBHbyB0byBQcm9qZWN0c1xuICAgICAgICAgICAgPC9MaW5rPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApIDogKFxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZ3JpZCBncmlkLWNvbHMtMSBtZDpncmlkLWNvbHMtMiBsZzpncmlkLWNvbHMtMyBnYXAtNlwiPlxuICAgICAgICAgICAge2FsbFByb2plY3RzLm1hcChwID0+IChcbiAgICAgICAgICAgICAgPExpbmsgXG4gICAgICAgICAgICAgICAga2V5PXtwLmlkfSBcbiAgICAgICAgICAgICAgICB0bz17YC9ib2FyZD9wcm9qZWN0SWQ9JHtwLmlkfWB9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmxvY2sgcC02IGJnLXN1cmZhY2UgYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlIGhvdmVyOmJvcmRlci1ibHVlLTUwMC81MCByb3VuZGVkLWxnIHRyYW5zaXRpb24tYWxsIGhvdmVyOnNoYWRvdy1sZyBncm91cFwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtc3RhcnQganVzdGlmeS1iZXR3ZWVuIG1iLTRcIj5cbiAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicC0yIGJnLWJsdWUtNTAwLzEwIHRleHQtYmx1ZS01MDAgcm91bmRlZCBncm91cC1ob3ZlcjpzY2FsZS0xMTAgdHJhbnNpdGlvbi10cmFuc2Zvcm1cIj5cbiAgICAgICAgICAgICAgICAgICAgPEZvbGRlckthbmJhbiBzaXplPXsyNH0gLz5cbiAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC14cyBmb250LW1vbm8gdGV4dC1tdXRlZCBiZy1zdXJmYWNlLWFjY2VudCBweC0yIHB5LTEgcm91bmRlZFwiPlxuICAgICAgICAgICAgICAgICAgICB7cC5wcm9qZWN0S2V5IHx8ICdQUkonfVxuICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxoMyBjbGFzc05hbWU9XCJ0ZXh0LWxnIGZvbnQtbWVkaXVtIHRleHQtc3Ryb25nIG1iLTIgZ3JvdXAtaG92ZXI6dGV4dC1ibHVlLTQwMCB0cmFuc2l0aW9uLWNvbG9yc1wiPntwLm5hbWV9PC9oMz5cbiAgICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LXNtIHRleHQtc3VidGxlIGxpbmUtY2xhbXAtMlwiPlxuICAgICAgICAgICAgICAgICAge3AuZGVzY3JpcHRpb24gPyBwLmRlc2NyaXB0aW9uIDogJ05vIGRlc2NyaXB0aW9uJ31cbiAgICAgICAgICAgICAgICA8L3A+XG4gICAgICAgICAgICAgIDwvTGluaz5cbiAgICAgICAgICAgICkpfVxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICApfVxuICAgICAgPC9kaXY+XG4gICAgKTtcbiAgfVxuXG4gIHJldHVybiAoXG4gICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgZmxleCBmbGV4LWNvbCBwLTQgbWQ6cC02IG1pbi1oLTAgYmctcGFnZS1iZ1wiPlxuICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0b3VyLWJvYXJkLWhlYWRlciBmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1zdGFydCBsZzppdGVtcy1jZW50ZXIgbWItNiBzaHJpbmstMCBmbGV4LWNvbCBsZzpmbGV4LXJvdyBnYXAtNFwiPlxuICAgICAgICA8ZGl2PlxuICAgICAgICAgIHtwcm9qZWN0ID8gKFxuICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgPGgxIGNsYXNzTmFtZT1cInRleHQteGwgZm9udC1zZW1pYm9sZCB0ZXh0LXN0cm9uZyB0cmFja2luZy10aWdodCBmbGV4IGl0ZW1zLWNlbnRlciBnYXAtMlwiPlxuICAgICAgICAgICAgICAgIDxGb2xkZXJLYW5iYW4gc2l6ZT17MjB9IGNsYXNzTmFtZT1cInRleHQtYmx1ZS01MDBcIiAvPlxuICAgICAgICAgICAgICAgIHtwcm9qZWN0Lm5hbWV9IDxzcGFuIGNsYXNzTmFtZT1cInRleHQtc20gZm9udC1ub3JtYWwgdGV4dC1zdWJ0bGVcIj5Cb2FyZDwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9oMT5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0ZXh0LXhzIHRleHQtc3VidGxlIG10LTEgcHJvc2UgZGFyazpwcm9zZS1pbnZlcnQgcHJvc2Utc20gbGluZS1jbGFtcC0xXCI+XG4gICAgICAgICAgICAgICAge3Byb2plY3QuZGVzY3JpcHRpb24gPyAoXG4gICAgICAgICAgICAgICAgICA8TWFya2Rvd24+e3Byb2plY3QuZGVzY3JpcHRpb259PC9NYXJrZG93bj5cbiAgICAgICAgICAgICAgICApIDogKFxuICAgICAgICAgICAgICAgICAgJ1Byb2plY3QgVGFzayBCb2FyZCdcbiAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvPlxuICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICA8PlxuICAgICAgICAgICAgICA8aDEgY2xhc3NOYW1lPVwidGV4dC1zbSBmb250LXNlbWlib2xkIHRleHQtc3Ryb25nIHRyYWNraW5nLXRpZ2h0IHVwcGVyY2FzZVwiPlRhc2sgQm9hcmQ8L2gxPlxuICAgICAgICAgICAgICA8cCBjbGFzc05hbWU9XCJ0ZXh0LVsxMHB4XSB0ZXh0LXN1YnRsZSB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0IG10LTFcIj5NYW5hZ2UgYWxsIHRhc2tzPC9wPlxuICAgICAgICAgICAgPC8+XG4gICAgICAgICAgKX1cbiAgICAgICAgPC9kaXY+XG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgZ2FwLTMgZmxleC13cmFwXCI+XG4gICAgICAgICAge3Byb2plY3QgJiYgKFxuICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IHNldElzV29ya2xvYWRNb2RhbE9wZW4odHJ1ZSl9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0yIGJnLXN1cmZhY2UgYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlIGhvdmVyOmJvcmRlci1ibHVlLTUwMC81MCB0ZXh0LXByaW1hcnkgaG92ZXI6dGV4dC1zdHJvbmcgcHgtMyBweS0xLjUgcm91bmRlZCB0cmFuc2l0aW9uLWFsbCB0ZXh0LXNtIGZvbnQtbWVkaXVtXCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxBY3Rpdml0eSBzaXplPXsxNH0gY2xhc3NOYW1lPVwidGV4dC1ibHVlLTUwMFwiIC8+XG4gICAgICAgICAgICAgICAgPHNwYW4+VGVhbSBXb3JrbG9hZDwvc3Bhbj5cbiAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXsoKSA9PiBzZXRJc0FjdGl2aXR5TW9kYWxPcGVuKHRydWUpfVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIHNwYWNlLXgtMiBiZy1zdXJmYWNlIGJvcmRlciBib3JkZXItYm9yZGVyLXN1YnRsZSBob3Zlcjpib3JkZXItYmx1ZS01MDAvNTAgdGV4dC1wcmltYXJ5IGhvdmVyOnRleHQtc3Ryb25nIHB4LTMgcHktMS41IHJvdW5kZWQgdHJhbnNpdGlvbi1hbGwgdGV4dC1zbSBmb250LW1lZGl1bVwiXG4gICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICA8Q2xvY2sgc2l6ZT17MTR9IGNsYXNzTmFtZT1cInRleHQtYmx1ZS01MDBcIiAvPlxuICAgICAgICAgICAgICAgIDxzcGFuPlByb2plY3QgQWN0aXZpdHk8L3NwYW4+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICB7Z2l0RW5hYmxlZCAmJiAoXG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gbmF2aWdhdGUoYC9naXQ/cHJvamVjdElkPSR7cHJvamVjdC5pZH1gKX1cbiAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIHNwYWNlLXgtMiBiZy1zdXJmYWNlIGJvcmRlciBib3JkZXItYm9yZGVyLXN1YnRsZSBob3Zlcjpib3JkZXItYW1iZXItNTAwLzUwIHRleHQtcHJpbWFyeSBob3Zlcjp0ZXh0LWFtYmVyLTQwMCBweC0zIHB5LTEuNSByb3VuZGVkIHRyYW5zaXRpb24tYWxsIHRleHQtc20gZm9udC1tZWRpdW1cIlxuICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgIDxHaXRCcmFuY2ggc2l6ZT17MTR9IGNsYXNzTmFtZT1cInRleHQtYW1iZXItNDAwXCIgLz5cbiAgICAgICAgICAgICAgICAgIDxzcGFuPkdpdCBSZXBvPC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICA8TGlua1xuICAgICAgICAgICAgICAgIHRvPXtgL2dyYXBoP3Byb2plY3RJZD0ke3Byb2plY3QuaWR9YH1cbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBzcGFjZS14LTIgYmctaW5kaWdvLTUwMC8xMCBib3JkZXIgYm9yZGVyLWluZGlnby01MDAvMzAgaG92ZXI6Ym9yZGVyLWluZGlnby01MDAgaG92ZXI6YmctaW5kaWdvLTUwMC8yMCB0ZXh0LWluZGlnby00MDAgaG92ZXI6dGV4dC1pbmRpZ28tMzAwIHB4LTMgcHktMS41IHJvdW5kZWQgdHJhbnNpdGlvbi1hbGwgdGV4dC1zbSBmb250LW1lZGl1bSBzaGFkb3ctc20gaG92ZXI6c2NhbGUtMTA1XCJcbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxXb3JrZmxvdyBzaXplPXsxNH0gY2xhc3NOYW1lPVwidGV4dC1pbmRpZ28tNDAwXCIgLz5cbiAgICAgICAgICAgICAgICA8c3Bhbj5UYXNrIEdyYXBoPC9zcGFuPlxuICAgICAgICAgICAgICA8L0xpbms+XG4gICAgICAgICAgICA8Lz5cbiAgICAgICAgICApfVxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0yIGJnLXN1cmZhY2UgYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlIHJvdW5kZWQgcHgtMyBweS0xLjUgdGV4dC1bMTBweF1cIj5cbiAgICAgICAgICAgIDxTZWFyY2ggc2l6ZT17MTR9IGNsYXNzTmFtZT1cInRleHQtc3VidGxlIHNocmluay0wXCIgLz5cbiAgICAgICAgICAgIDxpbnB1dCBcbiAgICAgICAgICAgICAgdHlwZT1cInRleHRcIiBcbiAgICAgICAgICAgICAgcGxhY2Vob2xkZXI9XCJTRUFSQ0ggVEFTS1MuLi5cIiBcbiAgICAgICAgICAgICAgdmFsdWU9e3NlYXJjaFF1ZXJ5fVxuICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldFNlYXJjaFF1ZXJ5KGUudGFyZ2V0LnZhbHVlKX1cbiAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctdHJhbnNwYXJlbnQgdGV4dC1zdHJvbmcgdXBwZXJjYXNlIGZvbnQtYm9sZCB0cmFja2luZy13aWRlc3Qgb3V0bGluZS1ub25lIHctMzIgbWQ6dy00OCBwbGFjZWhvbGRlci1tdXRlZFwiXG4gICAgICAgICAgICAvPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0zIGJnLXN1cmZhY2UgYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlIHJvdW5kZWQgcHgtMyBweS0xLjUgdGV4dC1bMTBweF0gZmxleC13cmFwXCI+XG4gICAgICAgICAgICA8RmlsdGVyIHNpemU9ezEyfSBjbGFzc05hbWU9XCJ0ZXh0LXN1YnRsZSBzaHJpbmstMFwiIC8+XG4gICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi13LTI4XCI+XG4gICAgICAgICAgICAgIDxDdXN0b21TZWxlY3RcbiAgICAgICAgICAgICAgICB2YWx1ZT17ZmlsdGVyQXNzaWduZWV9XG4gICAgICAgICAgICAgICAgb25DaGFuZ2U9e3NldEZpbHRlckFzc2lnbmVlfVxuICAgICAgICAgICAgICAgIG9wdGlvbnM9e1tcbiAgICAgICAgICAgICAgICAgIHsgdmFsdWU6ICdhbGwnLCBsYWJlbDogJ0FMTCBVU0VSUycgfSxcbiAgICAgICAgICAgICAgICAgIC4uLih1c2VyID8gW3sgdmFsdWU6IHVzZXIuaWQsIGxhYmVsOiAnQVNTSUdORUQgVE8gTUUnIH1dIDogW10pLFxuICAgICAgICAgICAgICAgICAgLi4udXNlcnMuZmlsdGVyKHUgPT4gdS5pZCAhPT0gdXNlcj8uaWQpLm1hcCh1ID0+ICh7IHZhbHVlOiB1LmlkLCBsYWJlbDogdS5uYW1lLnRvVXBwZXJDYXNlKCkgfSkpXG4gICAgICAgICAgICAgICAgXX1cbiAgICAgICAgICAgICAgICB2YXJpYW50PVwiYm9yZGVybGVzc1wiXG4gICAgICAgICAgICAgICAgc2l6ZT1cInhzXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ib3JkZXItc3Ryb25nIHB4LTFcIj58PC9zcGFuPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtaW4tdy0zMlwiPlxuICAgICAgICAgICAgICA8Q3VzdG9tU2VsZWN0XG4gICAgICAgICAgICAgICAgdmFsdWU9e2ZpbHRlclByaW9yaXR5fVxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXtzZXRGaWx0ZXJQcmlvcml0eX1cbiAgICAgICAgICAgICAgICBvcHRpb25zPXtbXG4gICAgICAgICAgICAgICAgICB7IHZhbHVlOiAnYWxsJywgbGFiZWw6ICdBTEwgUFJJT1JJVElFUycgfSxcbiAgICAgICAgICAgICAgICAgIHsgdmFsdWU6ICd1cmdlbnQnLCBsYWJlbDogJ1VSR0VOVCcgfSxcbiAgICAgICAgICAgICAgICAgIHsgdmFsdWU6ICdoaWdoJywgbGFiZWw6ICdISUdIJyB9LFxuICAgICAgICAgICAgICAgICAgeyB2YWx1ZTogJ21lZGl1bScsIGxhYmVsOiAnTUVESVVNJyB9LFxuICAgICAgICAgICAgICAgICAgeyB2YWx1ZTogJ2xvdycsIGxhYmVsOiAnTE9XJyB9XG4gICAgICAgICAgICAgICAgXX1cbiAgICAgICAgICAgICAgICB2YXJpYW50PVwiYm9yZGVybGVzc1wiXG4gICAgICAgICAgICAgICAgc2l6ZT1cInhzXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwidGV4dC1ib3JkZXItc3Ryb25nIHB4LTFcIj58PC9zcGFuPlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtaW4tdy0zMlwiPlxuICAgICAgICAgICAgICA8Q3VzdG9tU2VsZWN0XG4gICAgICAgICAgICAgICAgdmFsdWU9e2ZpbHRlclN0YXR1c31cbiAgICAgICAgICAgICAgICBvbkNoYW5nZT17c2V0RmlsdGVyU3RhdHVzfVxuICAgICAgICAgICAgICAgIG9wdGlvbnM9e1tcbiAgICAgICAgICAgICAgICAgIHsgdmFsdWU6ICdhbGwnLCBsYWJlbDogJ0FMTCBTVEFUVVNFUycgfSxcbiAgICAgICAgICAgICAgICAgIC4uLmNvbHVtbnMubWFwKGMgPT4gKHsgdmFsdWU6IGMuaWQsIGxhYmVsOiBjLnRpdGxlLnRvVXBwZXJDYXNlKCkgfSkpXG4gICAgICAgICAgICAgICAgXX1cbiAgICAgICAgICAgICAgICB2YXJpYW50PVwiYm9yZGVybGVzc1wiXG4gICAgICAgICAgICAgICAgc2l6ZT1cInhzXCJcbiAgICAgICAgICAgICAgLz5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0yIGJnLXN1cmZhY2UgYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlIHJvdW5kZWQgcHgtMyBweS0xLjUgdGV4dC1bMTBweF1cIj5cbiAgICAgICAgICAgICA8QXJyb3dVcERvd24gc2l6ZT17MTJ9IGNsYXNzTmFtZT1cInRleHQtc3VidGxlXCIgLz5cbiAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXN1YnRsZSBmb250LWJvbGQgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVzdCBib3JkZXItciBib3JkZXItYm9yZGVyLXN1YnRsZSBwci0yXCI+U09SVCBCWTwvc3Bhbj5cbiAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm1pbi13LTQwXCI+XG4gICAgICAgICAgICAgICA8Q3VzdG9tU2VsZWN0XG4gICAgICAgICAgICAgICAgIHZhbHVlPXtgJHtzb3J0Qnl9LSR7c29ydERpcn1gfVxuICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KHZhbCkgPT4ge1xuICAgICAgICAgICAgICAgICAgIGNvbnN0IFtieSwgZGlyXSA9IHZhbC5zcGxpdCgnLScpO1xuICAgICAgICAgICAgICAgICAgIHNldFNvcnRCeShieSBhcyBTb3J0T3B0aW9uKTtcbiAgICAgICAgICAgICAgICAgICBzZXRTb3J0RGlyKGRpciBhcyBTb3J0RGlyZWN0aW9uKTtcbiAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgb3B0aW9ucz17W1xuICAgICAgICAgICAgICAgICAgIHsgdmFsdWU6ICdjdXN0b20tYXNjJywgbGFiZWw6ICdDVVNUT00gKERSQUcgJiBEUk9QKScgfSxcbiAgICAgICAgICAgICAgICAgICB7IHZhbHVlOiAncHJpb3JpdHktZGVzYycsIGxhYmVsOiAnSElHSEVTVCBQUklPUklUWScgfSxcbiAgICAgICAgICAgICAgICAgICB7IHZhbHVlOiAncHJpb3JpdHktYXNjJywgbGFiZWw6ICdMT1dFU1QgUFJJT1JJVFknIH0sXG4gICAgICAgICAgICAgICAgICAgeyB2YWx1ZTogJ2RlYWRsaW5lLWFzYycsIGxhYmVsOiAnTkVBUkVTVCBERUFETElORScgfSxcbiAgICAgICAgICAgICAgICAgICB7IHZhbHVlOiAnZGVhZGxpbmUtZGVzYycsIGxhYmVsOiAnRlVSVEhFU1QgREVBRExJTkUnIH0sXG4gICAgICAgICAgICAgICAgICAgeyB2YWx1ZTogJ2NyZWF0ZWRBdC1kZXNjJywgbGFiZWw6ICdORVdFU1QgRklSU1QnIH0sXG4gICAgICAgICAgICAgICAgICAgeyB2YWx1ZTogJ2NyZWF0ZWRBdC1hc2MnLCBsYWJlbDogJ09MREVTVCBGSVJTVCcgfVxuICAgICAgICAgICAgICAgICBdfVxuICAgICAgICAgICAgICAgICB2YXJpYW50PVwiYm9yZGVybGVzc1wiXG4gICAgICAgICAgICAgICAgIHNpemU9XCJ4c1wiXG4gICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicmVsYXRpdmVcIj5cbiAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0SXNFeHBvcnRNZW51T3BlbighaXNFeHBvcnRNZW51T3Blbil9XG4gICAgICAgICAgICAgIGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIHNwYWNlLXgtMiBiZy1zdXJmYWNlIHRleHQtc3VidGxlIGJvcmRlciBib3JkZXItYm9yZGVyLXN1YnRsZSBob3Zlcjpib3JkZXItYmx1ZS01MDAvNTAgaG92ZXI6dGV4dC1zdHJvbmcgcHgtMyBweS0xLjUgcm91bmRlZCB0cmFuc2l0aW9uLWFsbCB0ZXh0LXhzIGZvbnQtYm9sZCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0XCJcbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPERvd25sb2FkIHNpemU9ezE0fSAvPlxuICAgICAgICAgICAgICA8c3Bhbj5FWFBPUlQ8L3NwYW4+XG4gICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgIHtpc0V4cG9ydE1lbnVPcGVuICYmIChcbiAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZpeGVkIGluc2V0LTAgei00MFwiIG9uQ2xpY2s9eygpID0+IHNldElzRXhwb3J0TWVudU9wZW4oZmFsc2UpfSAvPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiYWJzb2x1dGUgcmlnaHQtMCBtdC0yIHotNTAgdy0zNiBiZy1zdXJmYWNlLWRpbSBib3JkZXIgYm9yZGVyLWJvcmRlci1zdWJ0bGUgcm91bmRlZC1tZCBzaGFkb3cteGwgcHktMVwiPlxuICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgb25DbGljaz17aGFuZGxlRXhwb3J0Q1NWfVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgdGV4dC1sZWZ0IHB4LTQgcHktMiB0ZXh0LXhzIGZvbnQtYm9sZCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0IHRleHQtc3VidGxlIGhvdmVyOmJnLXN1cmZhY2UgaG92ZXI6dGV4dC1zdHJvbmdcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICBDU1YgRmlsZVxuICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVFeHBvcnRKU09OfVxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ3LWZ1bGwgdGV4dC1sZWZ0IHB4LTQgcHktMiB0ZXh0LXhzIGZvbnQtYm9sZCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0IHRleHQtc3VidGxlIGhvdmVyOmJnLXN1cmZhY2UgaG92ZXI6dGV4dC1zdHJvbmdcIlxuICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICBKU09OIEZpbGVcbiAgICAgICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICA8Lz5cbiAgICAgICAgICAgICl9XG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAge3VzZXI/LnJvbGUgIT09ICdkZXZlbG9wZXInICYmIChcbiAgICAgICAgICAgIDxUb29sdGlwIGNvbnRlbnQ9XCJDcmVhdGUgYSBuZXcgdGFzayB3aXRoIGtleWJvYXJkIHNob3J0Y3V0OiBjXCIgcG9zaXRpb249XCJib3R0b21cIj5cbiAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e2hhbmRsZUNyZWF0ZVRhc2t9XG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidG91ci1uZXctdGFzayBweC0zIHB5LTEuNSBiZy1ibHVlLTYwMCBob3ZlcjpiZy1ibHVlLTUwMCB0ZXh0LXdoaXRlIHRleHQteHMgZm9udC1ib2xkIHJvdW5kZWQgc2hhZG93IGhvdmVyOnNjYWxlLTEwNSB0cmFuc2l0aW9uLWFsbCBmbGV4IGl0ZW1zLWNlbnRlciBzcGFjZS14LTJcIlxuICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgPFBsdXMgc2l6ZT17MTR9IC8+XG4gICAgICAgICAgICAgICAgPHNwYW4+TkVXIFRBU0s8L3NwYW4+XG4gICAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICAgICAgPC9Ub29sdGlwPlxuICAgICAgICAgICl9XG4gICAgICAgIDwvZGl2PlxuICAgICAgPC9kaXY+XG5cbiAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleC0xIGZsZXggc3BhY2UteC00IG1kOnNwYWNlLXgtNiBvdmVyZmxvdy14LWF1dG8gb3ZlcmZsb3cteS1oaWRkZW4gcGItNCBzY3JvbGxiYXItdGhpbiBzbmFwLXggc25hcC1tYW5kYXRvcnkgc2Nyb2xsLXNtb290aFwiPlxuICAgICAgICAgIHtjb2x1bW5zLm1hcChjb2x1bW4gPT4ge1xuICAgICAgICAgICAgY29uc3QgcGFyZW50VGFza3MgPSBmaWx0ZXJlZFRhc2tzLmZpbHRlcih0ID0+ICF0LnBhcmVudElkKTtcbiAgICAgICAgICAgIGNvbnN0IGNvbHVtblRhc2tzID0gcGFyZW50VGFza3MuZmlsdGVyKHQgPT4gdC5zdGF0dXMgPT09IGNvbHVtbi5pZCk7XG4gICAgICAgICAgcmV0dXJuIChcbiAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgIGtleT17Y29sdW1uLmlkfSBcbiAgICAgICAgICAgICAgY2xhc3NOYW1lPXtgdy1bMjkwcHhdIHNtOnctODAgc25hcC1jZW50ZXIgZmxleC1zaHJpbmstMCBmbGV4IGZsZXgtY29sIGJnLXN1cmZhY2UgYm9yZGVyIHJvdW5kZWQtbGcgdHJhbnNpdGlvbi1jb2xvcnMgZHVyYXRpb24tMjAwICR7ZHJhZ2dpbmdDb2x1bW5JZCA9PT0gY29sdW1uLmlkID8gJ29wYWNpdHktNTAgYm9yZGVyLWRhc2hlZCBib3JkZXItYmx1ZS01MDAnIDogJ2JvcmRlci1ib3JkZXItc3VidGxlJ30gYH1cbiAgICAgICAgICAgICAgb25EcmFnRW50ZXI9eyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKGRyYWdnaW5nQ29sdW1uSWQpIHtcbiAgICAgICAgICAgICAgICAgIGhhbmRsZUNvbHVtbkRyYWdFbnRlcihjb2x1bW4uaWQpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgb25EcmFnT3Zlcj17KGUpID0+IHtcbiAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdtb3ZlJztcbiAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuY2xhc3NMaXN0LmFkZCgnYm9yZGVyLWJsdWUtNTAwLzUwJyk7XG4gICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgIG9uRHJhZ0xlYXZlPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgIGUuY3VycmVudFRhcmdldC5jbGFzc0xpc3QucmVtb3ZlKCdib3JkZXItYmx1ZS01MDAvNTAnKTtcbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgb25Ecm9wPXthc3luYyAoZSkgPT4ge1xuICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuY2xhc3NMaXN0LnJlbW92ZSgnYm9yZGVyLWJsdWUtNTAwLzUwJyk7XG4gICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgY29uc3QgY29sdW1uSWQgPSBlLmRhdGFUcmFuc2Zlci5nZXREYXRhKCdjb2x1bW5JZCcpO1xuICAgICAgICAgICAgICAgIGNvbnN0IHRhc2tJZCA9IGUuZGF0YVRyYW5zZmVyLmdldERhdGEoJ3Rhc2tJZCcpO1xuICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgIGlmIChjb2x1bW5JZCAmJiBjb2x1bW5JZCAhPT0gY29sdW1uLmlkKSB7XG4gICAgICAgICAgICAgICAgICAvLyBIYW5kbGUgY29sdW1uIHJlb3JkZXJcbiAgICAgICAgICAgICAgICAgIHNldENvbHVtbnMocHJldiA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IG5ld0NvbHVtbnMgPSBbLi4ucHJldl07XG4gICAgICAgICAgICAgICAgICAgIGNvbnN0IHNvdXJjZUlkeCA9IG5ld0NvbHVtbnMuZmluZEluZGV4KGMgPT4gYy5pZCA9PT0gY29sdW1uSWQpO1xuICAgICAgICAgICAgICAgICAgICBjb25zdCB0YXJnZXRJZHggPSBuZXdDb2x1bW5zLmZpbmRJbmRleChjID0+IGMuaWQgPT09IGNvbHVtbi5pZCk7XG4gICAgICAgICAgICAgICAgICAgIGlmIChzb3VyY2VJZHggIT09IC0xICYmIHRhcmdldElkeCAhPT0gLTEpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IFtkcmFnZ2VkXSA9IG5ld0NvbHVtbnMuc3BsaWNlKHNvdXJjZUlkeCwgMSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBuZXdDb2x1bW5zLnNwbGljZSh0YXJnZXRJZHgsIDAsIGRyYWdnZWQpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXdDb2x1bW5zO1xuICAgICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICh0YXNrSWQpIHtcbiAgICAgICAgICAgICAgICAgIGhhbmRsZURyb3BUYXNrKHRhc2tJZCwgY29sdW1uLmlkKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgc2V0RHJhZ2dpbmdDb2x1bW5JZChudWxsKTtcbiAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJweC00IHB5LTMgZmxleCBqdXN0aWZ5LWJldHdlZW4gaXRlbXMtY2VudGVyIGJvcmRlci1iIGJvcmRlci1ib3JkZXItc3VidGxlIGdyb3VwIGN1cnNvci1tb3ZlXCJcbiAgICAgICAgICAgICAgICBkcmFnZ2FibGVcbiAgICAgICAgICAgICAgICBvbkRyYWdTdGFydD17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgIGUuZGF0YVRyYW5zZmVyLmVmZmVjdEFsbG93ZWQgPSAnbW92ZSc7XG4gICAgICAgICAgICAgICAgICBlLmRhdGFUcmFuc2Zlci5zZXREYXRhKCdjb2x1bW5JZCcsIGNvbHVtbi5pZCk7XG4gICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHNldERyYWdnaW5nQ29sdW1uSWQoY29sdW1uLmlkKSwgMCk7XG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICBvbkRyYWdFbmQ9eygpID0+IHtcbiAgICAgICAgICAgICAgICAgIHNldERyYWdnaW5nQ29sdW1uSWQobnVsbCk7XG4gICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0yIGZsZXgtMVwiPlxuICAgICAgICAgICAgICAgICAge2VkaXRpbmdDb2x1bW5JZCA9PT0gY29sdW1uLmlkID8gKFxuICAgICAgICAgICAgICAgICAgICA8aW5wdXRcbiAgICAgICAgICAgICAgICAgICAgICB0eXBlPVwidGV4dFwiXG4gICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC14cyBmb250LWJvbGQgdGV4dC1zdHJvbmcgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVzdCBiZy10cmFuc3BhcmVudCBib3JkZXItYiBib3JkZXItYmx1ZS01MDAgb3V0bGluZS1ub25lIHctZnVsbFwiXG4gICAgICAgICAgICAgICAgICAgICAgdmFsdWU9e2VkaXRpbmdDb2x1bW5UaXRsZX1cbiAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHNldEVkaXRpbmdDb2x1bW5UaXRsZShlLnRhcmdldC52YWx1ZSl9XG4gICAgICAgICAgICAgICAgICAgICAgb25CbHVyPXsoKSA9PiBoYW5kbGVVcGRhdGVDb2x1bW5UaXRsZShjb2x1bW4uaWQpfVxuICAgICAgICAgICAgICAgICAgICAgIG9uS2V5RG93bj17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlLmtleSA9PT0gJ0VudGVyJykgaGFuZGxlVXBkYXRlQ29sdW1uVGl0bGUoY29sdW1uLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlLmtleSA9PT0gJ0VzY2FwZScpIHNldEVkaXRpbmdDb2x1bW5JZChudWxsKTtcbiAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgIGF1dG9Gb2N1c1xuICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgPGgzIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1ib2xkIHRleHQtc3Ryb25nIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3QgY3Vyc29yLXBvaW50ZXJcIiBvbkRvdWJsZUNsaWNrPXsoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgc2V0RWRpdGluZ0NvbHVtbklkKGNvbHVtbi5pZCk7XG4gICAgICAgICAgICAgICAgICAgICAgc2V0RWRpdGluZ0NvbHVtblRpdGxlKGNvbHVtbi50aXRsZSk7XG4gICAgICAgICAgICAgICAgICAgIH19PlxuICAgICAgICAgICAgICAgICAgICAgIHtjb2x1bW4udGl0bGV9XG4gICAgICAgICAgICAgICAgICAgIDwvaDM+XG4gICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgPHNwYW4gY2xhc3NOYW1lPVwiYmctc3VyZmFjZS1hY2NlbnQgdGV4dC1zdHJvbmcgcHgtMiBweS0wLjUgcm91bmRlZCB0ZXh0LVsxMHB4XSBmb250LW1lZGl1bVwiPlxuICAgICAgICAgICAgICAgICAgICB7Y29sdW1uVGFza3MubGVuZ3RofVxuICAgICAgICAgICAgICAgICAgPC9zcGFuPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBmbGV4LXJvdyBpdGVtcy1jZW50ZXIgc3BhY2UteC0xIG9wYWNpdHktMCBncm91cC1ob3ZlcjpvcGFjaXR5LTEwMCB0cmFuc2l0aW9uLW9wYWNpdHlcIj5cbiAgICAgICAgICAgICAgICAgIHt1c2VyPy5yb2xlICE9PSAnZGV2ZWxvcGVyJyAmJiAoXG4gICAgICAgICAgICAgICAgICAgIDxUb29sdGlwIGNvbnRlbnQ9e2BBZGQgVGFzayB0byAke2NvbHVtbi50aXRsZX1gfSBwb3NpdGlvbj1cInRvcFwiPlxuICAgICAgICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IGhhbmRsZUNyZWF0ZVRhc2tJbkNvbHVtbihjb2x1bW4uaWQpfVxuICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctYmx1ZS01MDAvMTAgdGV4dC1ibHVlLTUwMCBob3ZlcjpiZy1ibHVlLTUwMCBob3Zlcjp0ZXh0LXdoaXRlIHAtMSByb3VuZGVkIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICA8UGx1cyBzaXplPXsxNn0gLz5cbiAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgPC9Ub29sdGlwPlxuICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgIDxUb29sdGlwIGNvbnRlbnQ9e2BEZWxldGUgJHtjb2x1bW4udGl0bGV9YH0gcG9zaXRpb249XCJ0b3BcIj5cbiAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IGhhbmRsZURlbGV0ZUNvbHVtbihjb2x1bW4uaWQpfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtc3VidGxlIGhvdmVyOnRleHQtcmVkLTQwMFwiXG4gICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICA8VHJhc2gyIHNpemU9ezE0fSAvPlxuICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgIDwvVG9vbHRpcD5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgPC9kaXY+XG5cbiAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4LTEgb3ZlcmZsb3cteS1hdXRvIHAtNCBzcGFjZS15LTNcIj5cbiAgICAgICAgICAgICAgICB7Y29sdW1uVGFza3MubWFwKHRhc2sgPT4ge1xuICAgICAgICAgICAgICAgICAgY29uc3QgYXNzaWduZWUgPSB1c2Vycy5maW5kKHUgPT4gdS5pZCA9PT0gdGFzay5hc3NpZ25lZUlkKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IHN1YnRhc2tzID0gZmlsdGVyZWRUYXNrcy5maWx0ZXIodCA9PiB0LnBhcmVudElkID09PSB0YXNrLmlkKTtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGNvbXBsZXRlZFN1YnRhc2tzID0gc3VidGFza3MuZmlsdGVyKHQgPT4gdC5zdGF0dXMgPT09ICdkb25lJykubGVuZ3RoO1xuXG4gICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICA8ZGl2XG4gICAgICAgICAgICAgICAgICAgICAga2V5PXt0YXNrLmlkfVxuICAgICAgICAgICAgICAgICAgICAgIGRyYWdnYWJsZVxuICAgICAgICAgICAgICAgICAgICAgIG9uRHJhZ1N0YXJ0PXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5kYXRhVHJhbnNmZXIuZWZmZWN0QWxsb3dlZCA9ICdtb3ZlJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuZGF0YVRyYW5zZmVyLnNldERhdGEoJ3Rhc2tJZCcsIHRhc2suaWQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgc2V0VGltZW91dCgoKSA9PiBzZXREcmFnZ2luZ1Rhc2tJZCh0YXNrLmlkKSwgMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgIG9uRHJhZ0VuZD17KCkgPT4gc2V0RHJhZ2dpbmdUYXNrSWQobnVsbCl9XG4gICAgICAgICAgICAgICAgICAgICAgb25EcmFnT3Zlcj17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChlLmRhdGFUcmFuc2Zlci50eXBlcy5pbmNsdWRlcygnY29sdW1uaWQnKSB8fCBlLmRhdGFUcmFuc2Zlci50eXBlcy5pbmNsdWRlcygnY29sdW1uSWQnKSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5kYXRhVHJhbnNmZXIuZHJvcEVmZmVjdCA9ICdtb3ZlJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3QgPSBlLmN1cnJlbnRUYXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCB5ID0gZS5jbGllbnRZIC0gcmVjdC50b3A7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoeSA8IHJlY3QuaGVpZ2h0IC8gMikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYm9yZGVyVG9wQ29sb3IgPSAnIzNiODJmNic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS5ib3JkZXJCb3R0b21Db2xvciA9ICcjMmQzMTM5JztcbiAgICAgICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS5ib3JkZXJUb3BDb2xvciA9ICcjMmQzMTM5JztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJvcmRlckJvdHRvbUNvbG9yID0gJyMzYjgyZjYnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgb25EcmFnTGVhdmU9eyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYm9yZGVyVG9wQ29sb3IgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS5ib3JkZXJCb3R0b21Db2xvciA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgb25Ecm9wPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgZHJhZ2dlZENvbHVtbklkID0gZS5kYXRhVHJhbnNmZXIuZ2V0RGF0YSgnY29sdW1uSWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChkcmFnZ2VkQ29sdW1uSWQpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gQWxsb3cgaXQgdG8gYnViYmxlIHVwIHRvIHRoZSBjb2x1bW4gY29udGFpbmVyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgIFxuICAgICAgICAgICAgICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS5ib3JkZXJUb3BDb2xvciA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJvcmRlckJvdHRvbUNvbG9yID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkcmFnZ2VkVGFza0lkID0gZS5kYXRhVHJhbnNmZXIuZ2V0RGF0YSgndGFza0lkJyk7XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYWdnZWRUYXNrSWQgfHwgZHJhZ2dlZFRhc2tJZCA9PT0gdGFzay5pZCkgcmV0dXJuO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWN0ID0gZS5jdXJyZW50VGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zaXRpb24gPSB5IDwgcmVjdC5oZWlnaHQgLyAyID8gJ2JlZm9yZScgOiAnYWZ0ZXInO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBoYW5kbGVEcm9wVGFzayhkcmFnZ2VkVGFza0lkLCBjb2x1bW4uaWQsIHRhc2suaWQsIHBvc2l0aW9uKTtcbiAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eygpID0+IGhhbmRsZUVkaXRUYXNrKHRhc2spfVxuICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAgICAgICBcInRhc2stY2FyZCBwLTMgYmctc3VyZmFjZS1kaW0gYm9yZGVyIHJvdW5kZWQgY3Vyc29yLXBvaW50ZXIgaG92ZXI6Ym9yZGVyLWJsdWUtNTAwIHRyYW5zaXRpb24tY29sb3JzIGdyb3VwIGZsZXggZmxleC1jb2xcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIGRyYWdnaW5nVGFza0lkID09PSB0YXNrLmlkICYmIFwib3BhY2l0eS00MFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgdGFzay5wcmlvcml0eSA9PT0gJ3VyZ2VudCcgPyAnYm9yZGVyLXJlZC01MDAvNDAnIDpcbiAgICAgICAgICAgICAgICAgICAgICAgIHRhc2sucHJpb3JpdHkgPT09ICdoaWdoJyA/ICdib3JkZXItYW1iZXItNTAwLzQwJyA6XG4gICAgICAgICAgICAgICAgICAgICAgICB0YXNrLnByaW9yaXR5ID09PSAnbWVkaXVtJyA/ICdib3JkZXItYmx1ZS01MDAvNDAnIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICdib3JkZXItYm9yZGVyLXN1YnRsZSdcbiAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGp1c3RpZnktYmV0d2VlbiBpdGVtcy1zdGFydCBtYi0yXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIHNwYWNlLXgtMlwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcIm9wYWNpdHktMCB0cmFuc2l0aW9uLW9wYWNpdHkgZmxleCBpdGVtcy1jZW50ZXIganVzdGlmeS1jZW50ZXIgY3Vyc29yLXBvaW50ZXIgcC0wLjUgbGc6Z3JvdXAtaG92ZXI6b3BhY2l0eS0xMDBcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIChzZWxlY3RlZFRhc2tJZHMuaGFzKHRhc2suaWQpIHx8IHNlbGVjdGVkVGFza0lkcy5zaXplID4gMCkgJiYgXCJvcGFjaXR5LTEwMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvZ2dsZVNlbGVjdGlvbih0YXNrLmlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGlucHV0IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdHlwZT1cImNoZWNrYm94XCIgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZWFkT25seSBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNoZWNrZWQ9e3NlbGVjdGVkVGFza0lkcy5oYXModGFzay5pZCl9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwidy0zIGgtMyBjdXJzb3ItcG9pbnRlciBhY2NlbnQtYmx1ZS01MDBcIiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0xIHB4LTEuNSBweS0wLjUgcm91bmRlZCB0ZXh0LVs5cHhdIGZvbnQtYm9sZCB1cHBlcmNhc2Ugc2hyaW5rLTBcIixcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXNrLnByaW9yaXR5ID09PSAndXJnZW50JyA/ICdiZy1yZWQtNTAwLzEwIHRleHQtcmVkLTQwMCBib3JkZXIgYm9yZGVyLXJlZC01MDAvMjAnIDpcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0YXNrLnByaW9yaXR5ID09PSAnaGlnaCcgPyAnYmctYW1iZXItNTAwLzEwIHRleHQtYW1iZXItNDAwIGJvcmRlciBib3JkZXItYW1iZXItNTAwLzIwJyA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFzay5wcmlvcml0eSA9PT0gJ21lZGl1bScgPyAnYmctYmx1ZS01MDAvMTAgdGV4dC1ibHVlLTQwMCBib3JkZXIgYm9yZGVyLWJsdWUtNTAwLzIwJyA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2JnLXN1cmZhY2UtYWNjZW50IHRleHQtbXV0ZWQgYm9yZGVyIGJvcmRlci1ib3JkZXItc3Ryb25nJ1xuICAgICAgICAgICAgICAgICAgICAgICAgICApfT5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7dGFzay5wcmlvcml0eSA9PT0gJ3VyZ2VudCcgJiYgPEFsZXJ0Q2lyY2xlIHNpemU9ezEwfSAvPn1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7dGFzay5wcmlvcml0eSA9PT0gJ2hpZ2gnICYmIDxDaGV2cm9uVXAgc2l6ZT17MTB9IC8+fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt0YXNrLnByaW9yaXR5ID09PSAnbWVkaXVtJyAmJiA8TWludXMgc2l6ZT17MTB9IC8+fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt0YXNrLnByaW9yaXR5ID09PSAnbG93JyAmJiA8Q2hldnJvbkRvd24gc2l6ZT17MTB9IC8+fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuPnt0YXNrLnByaW9yaXR5fTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0xIG9wYWNpdHktMCBncm91cC1ob3ZlcjpvcGFjaXR5LTEwMCB0cmFuc2l0aW9uLW9wYWNpdHlcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LXN1YnRsZSBob3Zlcjp0ZXh0LWJsdWUtNDAwIHAtMSByb3VuZGVkIGhvdmVyOmJnLWJsdWUtNTAwLzEwXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aXRsZT1cIkVkaXQgVGFza1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgaGFuZGxlRWRpdFRhc2sodGFzayk7IH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8UGVuY2lsIHNpemU9ezE0fSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJ0ZXh0LXN1YnRsZSBob3Zlcjp0ZXh0LXJlZC00MDAgcC0xIHJvdW5kZWQgaG92ZXI6YmctcmVkLTUwMC8xMFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJEZWxldGUgVGFza1wiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IHsgZS5zdG9wUHJvcGFnYXRpb24oKTsgZS5wcmV2ZW50RGVmYXVsdCgpOyBoYW5kbGVEZWxldGVUYXNrKHRhc2suaWQpOyB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPFRyYXNoMiBzaXplPXsxNH0gLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9idXR0b24+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cblxuICAgICAgICAgICAgICAgICAgICAgIDxoNCBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtYm9sZCB0ZXh0LXN0cm9uZyBtYi0xIGxlYWRpbmctc251Z1wiPnt0YXNrLnRpdGxlfTwvaDQ+XG4gICAgICAgICAgICAgICAgICAgICAge2dpdEVuYWJsZWQgJiYgdGFzay5icmFuY2hOYW1lID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBzcGFjZS14LTEgbWItMiBmbGV4LXdyYXAgZ2FwLTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHR5cGU9XCJidXR0b25cIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9eyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgbmF2aWdhdG9yLmNsaXBib2FyZC53cml0ZVRleHQoYGdpdCBjaGVja291dCAke3Rhc2suYnJhbmNoTmFtZX1gKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN1Y2Nlc3MoYENvcGllZDogZ2l0IGNoZWNrb3V0ICR7dGFzay5icmFuY2hOYW1lfWApO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJDbGljayB0byBjb3B5OiBnaXQgY2hlY2tvdXQgYnJhbmNoXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0xIHRleHQtWzEwcHhdIGZvbnQtbW9ubyBmb250LWJvbGQgdGV4dC1ibHVlLTQwMCBiZy1ibHVlLTUwMC8xMCBob3ZlcjpiZy1ibHVlLTUwMC8yMCBweC0xLjUgcHktMC41IHJvdW5kZWQgYm9yZGVyIGJvcmRlci1ibHVlLTUwMC8yMCB0cmFuc2l0aW9uLWFsbCB0cnVuY2F0ZSBtYXgtdy1bMTgwcHhdXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxHaXRCcmFuY2ggc2l6ZT17MTB9IGNsYXNzTmFtZT1cInNocmluay0wXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0cnVuY2F0ZVwiPnt0YXNrLmJyYW5jaE5hbWV9PC9zcGFuPlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAge3Rhc2sucHJVcmwgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxhXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBocmVmPXt0YXNrLnByVXJsfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGFyZ2V0PVwiX2JsYW5rXCJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlbD1cIm5vb3BlbmVyIG5vcmVmZXJyZXJcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJpbmxpbmUtZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0wLjUgdGV4dC1bOXB4XSBmb250LWJvbGQgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVyIHRleHQtZW1lcmFsZC00MDAgYmctZW1lcmFsZC01MDAvMTAgaG92ZXI6YmctZW1lcmFsZC01MDAvMjAgcHgtMS41IHB5LTAuNSByb3VuZGVkIGJvcmRlciBib3JkZXItZW1lcmFsZC01MDAvMjAgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGl0bGU9XCJWaWV3IFB1bGwgUmVxdWVzdFwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPEdpdFB1bGxSZXF1ZXN0IHNpemU9ezl9IC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj5QUjwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L2E+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICApIDogbnVsbH1cbiAgICAgICAgICAgICAgICAgICAgICB7dGFzay5taWxlc3RvbmVJZCAmJiAoXG4gICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInRleHQtWzlweF0gZm9udC1ib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3QgdGV4dC1bI2E4NTVmN10gYmctWyNhODU1ZjddLzEwIGJvcmRlciBib3JkZXItWyNhODU1ZjddLzIwIHB4LTEuNSBweS0wLjUgcm91bmRlZCBpbmxpbmUtYmxvY2sgbWItMiBtYXgtdy1mdWxsIHRydW5jYXRlXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIHttaWxlc3RvbmVzLmZpbmQobSA9PiBtLmlkID09PSB0YXNrLm1pbGVzdG9uZUlkKT8ubmFtZSB8fCAnTWlsZXN0b25lJ31cbiAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgeygoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBhbGxEZXBzID0gdGFzay5kZXBlbmRlbmNpZXMgfHwgW107XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBwZW5kaW5nRGVwcyA9IGFsbERlcHMuZmlsdGVyKGRlcElkID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRlcCA9IGZpbHRlcmVkVGFza3MuZmluZCh0ID0+IHQuaWQgPT09IGRlcElkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBkZXAgJiYgZGVwLnN0YXR1cyAhPT0gJ2RvbmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgfSkubGVuZ3RoO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoYWxsRGVwcy5sZW5ndGggPT09IDApIHJldHVybiBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgXG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT17Y24oXCJ0ZXh0LVs5cHhdIGZvbnQtYm9sZCB1cHBlcmNhc2UgdHJhY2tpbmctd2lkZXN0IGlubGluZS1mbGV4IGl0ZW1zLWNlbnRlciBzcGFjZS14LTEgcHgtMS41IHB5LTAuNSByb3VuZGVkIG1iLTJcIiwgcGVuZGluZ0RlcHMgPiAwID8gXCJiZy1yZWQtNTAwLzEwIHRleHQtcmVkLTQwMFwiIDogXCJiZy1ncmVlbi01MDAvMTAgdGV4dC1ncmVlbi00MDBcIil9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICB7cGVuZGluZ0RlcHMgPiAwID8gKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDw+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8QWxlcnRDaXJjbGUgc2l6ZT17MTB9IC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj57cGVuZGluZ0RlcHN9IEJsb2NrZWQ8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICkgOiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxDaGVja0NpcmNsZTIgc2l6ZT17MTB9IC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3Bhbj5VbmJsb2NrZWQ8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgKTtcbiAgICAgICAgICAgICAgICAgICAgICB9KSgpfVxuXG4gICAgICAgICAgICAgICAgICAgICAge3N1YnRhc2tzLmxlbmd0aCA+IDAgJiYgKFxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJtYi0yIG10LTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gdGV4dC1bOXB4XSBmb250LWJvbGQgdGV4dC1zdWJ0bGUgdXBwZXJjYXNlIHRyYWNraW5nLXdpZGVzdCBtYi0xXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+U3VidGFza3M8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+e2NvbXBsZXRlZFN1YnRhc2tzfS97c3VidGFza3MubGVuZ3RofTwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy1mdWxsIGgtMSBiZy1zdXJmYWNlLWFjY2VudCByb3VuZGVkLWZ1bGwgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFwiaC1mdWxsIHRyYW5zaXRpb24tYWxsIGR1cmF0aW9uLTMwMFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb21wbGV0ZWRTdWJ0YXNrcyA9PT0gc3VidGFza3MubGVuZ3RoID8gXCJiZy1ncmVlbi01MDBcIiA6IFwiYmctYmx1ZS01MDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgKX0gXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzdHlsZT17eyB3aWR0aDogYCR7KGNvbXBsZXRlZFN1YnRhc2tzIC8gc3VidGFza3MubGVuZ3RoKSAqIDEwMH0lYCB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggZmxleC1jb2wgbXQtMiBzcGFjZS15LTEgcGwtMSBib3JkZXItbC0yIGJvcmRlci1ib3JkZXItc3VidGxlLzUwIG1sLTFcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7c3VidGFza3MubWFwKHN0ID0+IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGtleT17c3QuaWR9IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkcmFnZ2FibGVcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25EcmFnU3RhcnQ9eyhlKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLmRhdGFUcmFuc2Zlci5lZmZlY3RBbGxvd2VkID0gJ21vdmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUuZGF0YVRyYW5zZmVyLnNldERhdGEoJ3Rhc2tJZCcsIHN0LmlkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHNldERyYWdnaW5nVGFza0lkKHN0LmlkKSwgMCk7XG5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25EcmFnRW5kPXsoKSA9PiBzZXREcmFnZ2luZ1Rhc2tJZChudWxsKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25EcmFnT3Zlcj17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnByZXZlbnREZWZhdWx0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLmRhdGFUcmFuc2Zlci5kcm9wRWZmZWN0ID0gJ21vdmUnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IHJlY3QgPSBlLmN1cnJlbnRUYXJnZXQuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmICh5IDwgcmVjdC5oZWlnaHQgLyAyKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYm9yZGVyVG9wQ29sb3IgPSAnIzNiODJmNic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYm9yZGVyQm90dG9tQ29sb3IgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5jdXJyZW50VGFyZ2V0LnN0eWxlLmJvcmRlclRvcENvbG9yID0gJyc7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYm9yZGVyQm90dG9tQ29sb3IgPSAnIzNiODJmNic7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkRyYWdMZWF2ZT17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYm9yZGVyVG9wQ29sb3IgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLmN1cnJlbnRUYXJnZXQuc3R5bGUuYm9yZGVyQm90dG9tQ29sb3IgPSAnJztcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25Ecm9wPXsoZSkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUucHJldmVudERlZmF1bHQoKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlLnN0b3BQcm9wYWdhdGlvbigpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS5ib3JkZXJUb3BDb2xvciA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGUuY3VycmVudFRhcmdldC5zdHlsZS5ib3JkZXJCb3R0b21Db2xvciA9ICcnO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGNvbnN0IGRyYWdnZWRUYXNrSWQgPSBlLmRhdGFUcmFuc2Zlci5nZXREYXRhKCd0YXNrSWQnKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYWdnZWRUYXNrSWQgfHwgZHJhZ2dlZFRhc2tJZCA9PT0gc3QuaWQpIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCBkcmFnZ2VkVGFzayA9IHRhc2tzLmZpbmQodCA9PiB0LmlkID09PSBkcmFnZ2VkVGFza0lkKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoIWRyYWdnZWRUYXNrKSByZXR1cm47XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgLy8gRm9yIHN1YnRhc2tzLCBvbmx5IGFsbG93IGlmIHNhbWUgcGFyZW50SWQgKHNvIHdlIGRvbid0IGFjY2lkZW50YWxseSBtb3ZlIHBhcmVudHMgaW50byBzdWJ0YXNrcylcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBpZiAoZHJhZ2dlZFRhc2sucGFyZW50SWQgPT09IHN0LnBhcmVudElkKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb25zdCByZWN0ID0gZS5jdXJyZW50VGFyZ2V0LmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgeSA9IGUuY2xpZW50WSAtIHJlY3QudG9wO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgcG9zaXRpb24gPSB5IDwgcmVjdC5oZWlnaHQgLyAyID8gJ2JlZm9yZScgOiAnYWZ0ZXInO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlRHJvcFRhc2soZHJhZ2dlZFRhc2tJZCwgY29sdW1uLmlkLCBzdC5pZCwgcG9zaXRpb24pO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjbihcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBcImZsZXgganVzdGlmeS1iZXR3ZWVuIGl0ZW1zLWNlbnRlciBiZy1zdXJmYWNlIHAtMS41IHJvdW5kZWQgY3Vyc29yLXBvaW50ZXIgaG92ZXI6Ymctc3VyZmFjZS1kaW0gYm9yZGVyIGJvcmRlci10cmFuc3BhcmVudCBob3Zlcjpib3JkZXItYm9yZGVyLXN1YnRsZVwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRyYWdnaW5nVGFza0lkID09PSBzdC5pZCAmJiBcIm9wYWNpdHktNDBcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXsoZSkgPT4geyBlLnN0b3BQcm9wYWdhdGlvbigpOyBoYW5kbGVFZGl0VGFzayhzdCk7IH19XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0xLjUgb3ZlcmZsb3ctaGlkZGVuXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPENvcm5lckRvd25SaWdodCBzaXplPXsxMH0gY2xhc3NOYW1lPVwidGV4dC1ib3JkZXItc3Ryb25nIHNocmluay0wXCIgLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9e2NuKFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ0ZXh0LVsxMHB4XSB0cnVuY2F0ZSBtYXgtdy1bMTUwcHhdXCIsIFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc3Quc3RhdHVzID09PSAnZG9uZScgPyBcImxpbmUtdGhyb3VnaCB0ZXh0LXN1YnRsZSBvcGFjaXR5LTUwXCIgOiBcInRleHQtbXV0ZWRcIlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICl9PlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAge3N0LnRpdGxlfVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDwvc3Bhbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT17Y24oXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgXCJ3LTIgaC0yIHJvdW5kZWQtZnVsbFwiLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0LnN0YXR1cyA9PT0gJ2RvbmUnID8gJ2JnLWdyZWVuLTUwMCcgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0LnN0YXR1cyA9PT0gJ2luX3Byb2dyZXNzJyA/ICdiZy1ibHVlLTUwMCcgOlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHN0LnN0YXR1cyA9PT0gJ3JldmlldycgPyAnYmctYW1iZXItNTAwJyA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ2JnLXN1cmZhY2UtYWNjZW50J1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICApfSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICBcbiAgICAgICAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cIm10LWF1dG8gcHQtMiBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWJldHdlZW4gdGV4dC1bMTBweF0gdGV4dC1tdXRlZCBib3JkZXItdCBib3JkZXItYm9yZGVyLXN1YnRsZVwiPlxuICAgICAgICAgICAgICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBzcGFjZS14LTEgZm9udC1tb25vXCI+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxDYWxlbmRhciBzaXplPXsxMn0gLz5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPHNwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAge3NhZmVGb3JtYXREYXRlKHRhc2suZGVhZGxpbmUsICdNTU0gZGQnLCAnTk8gREVBRExJTkUnKS50b1VwcGVyQ2FzZSgpfVxuICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NwYW4+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZmxleCBpdGVtcy1jZW50ZXIgc3BhY2UteC0yIHJlbGF0aXZlIGdyb3VwL2Fzc2lnbmVlXCIgdGl0bGU9e2Fzc2lnbmVlID8gYXNzaWduZWUubmFtZSA6ICdVbmFzc2lnbmVkJ30+XG4gICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiY3Vyc29yLXBvaW50ZXIgaW5saW5lLWZsZXggcmVsYXRpdmVcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB7YXNzaWduZWUgPyAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8VXNlckF2YXRhciB1c2VyPXthc3NpZ25lZX0gY2xhc3NOYW1lPVwidy01IGgtNSB0ZXh0LVs5cHhdIHJvdW5kZWRcIiBzaG93VG9vbHRpcD17ZmFsc2V9IC8+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKSA6IChcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidy01IGgtNSByb3VuZGVkIGJvcmRlciBib3JkZXItZGFzaGVkIGJvcmRlci1ib3JkZXItc3Ryb25nIGZsZXggaXRlbXMtY2VudGVyIGp1c3RpZnktY2VudGVyIHRleHQtbXV0ZWQgZ3JvdXAtaG92ZXI6Ym9yZGVyLWJsdWUtNTAwLzUwIGdyb3VwLWhvdmVyOnRleHQtYmx1ZS00MDAgdHJhbnNpdGlvbi1jb2xvcnMgYmctc3VyZmFjZS1kaW0gZ3JvdXAtaG92ZXI6YmctYmx1ZS01MDAvMTBcIj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPFVzZXJQbHVzIHNpemU9ezEwfSAvPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8c2VsZWN0IFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYWJzb2x1dGUgaW5zZXQtMCB3LWZ1bGwgaC1mdWxsIG9wYWNpdHktMCBjdXJzb3ItcG9pbnRlclwiXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZT17dGFzay5hc3NpZ25lZUlkIHx8IFwiXCJ9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgY29uc3QgbmV3QXNzaWduZWVJZCA9IGUudGFyZ2V0LnZhbHVlIHx8IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHNldFRhc2tzKHRhc2tzLm1hcCh0ID0+IHQuaWQgPT09IHRhc2suaWQgPyB7IC4uLnQsIGFzc2lnbmVlSWQ6IG5ld0Fzc2lnbmVlSWQgfSA6IHQpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgaGFuZGxlVXBkYXRlVGFzayh0YXNrLmlkLCB0YXNrLCB7IGFzc2lnbmVlSWQ6IG5ld0Fzc2lnbmVlSWQgfSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICB9fVxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb25DbGljaz17KGUpID0+IGUuc3RvcFByb3BhZ2F0aW9uKCl9XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlwiPlVuYXNzaWduZWQ8L29wdGlvbj5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHt1c2Vycy5tYXAodSA9PiAoXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA8b3B0aW9uIGtleT17dS5pZH0gdmFsdWU9e3UuaWR9Pnt1Lm5hbWV9PC9vcHRpb24+XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICApKX1cbiAgICAgICAgICAgICAgICAgICAgICAgICAgICA8L3NlbGVjdD5cbiAgICAgICAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgIH0pfVxuICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICk7XG4gICAgICAgIH0pfVxuICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctODAgZmxleC1zaHJpbmstMCBmbGV4IGl0ZW1zLWNlbnRlciBqdXN0aWZ5LWNlbnRlciBib3JkZXIgYm9yZGVyLWRhc2hlZCBib3JkZXItYm9yZGVyLXN1YnRsZSBob3Zlcjpib3JkZXItYmx1ZS01MDAgaG92ZXI6YmctYmx1ZS01MDAvNSByb3VuZGVkLWxnIGJnLXN1cmZhY2UtZGltIHRyYW5zaXRpb24tY29sb3JzIGN1cnNvci1wb2ludGVyIGdyb3VwXCIgb25DbGljaz17aGFuZGxlQWRkQ29sdW1ufT5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cImZsZXggaXRlbXMtY2VudGVyIHNwYWNlLXgtMiB0ZXh0LXN1YnRsZSBncm91cC1ob3Zlcjp0ZXh0LWJsdWUtNTAwIHRyYW5zaXRpb24tY29sb3JzXCI+XG4gICAgICAgICAgICA8UGx1cyBzaXplPXsxNn0gLz5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cInRleHQteHMgZm9udC1ib2xkIHVwcGVyY2FzZSB0cmFja2luZy13aWRlc3RcIj5OZXcgQ29sdW1uPC9zcGFuPlxuICAgICAgICAgIDwvZGl2PlxuICAgICAgICA8L2Rpdj5cbiAgICAgIDwvZGl2PlxuXG4gICAgICB7aXNNb2RhbE9wZW4gJiYgKFxuICAgICAgICA8VGFza01vZGFsXG4gICAgICAgICAgdGFzaz17ZWRpdGluZ1Rhc2t9XG4gICAgICAgICAgdXNlcnM9e3VzZXJzfVxuICAgICAgICAgIHRhc2tzPXt0YXNrc31cbiAgICAgICAgICBjb2x1bW5zPXtjb2x1bW5zfVxuICAgICAgICAgIHBhcmVudElkPXtzZWxlY3RlZFBhcmVudElkfVxuICAgICAgICAgIHByb2plY3RJZD17cHJvamVjdElkfVxuICAgICAgICAgIG9uQ2xvc2U9eygpID0+IHNldElzTW9kYWxPcGVuKGZhbHNlKX1cbiAgICAgICAgICBvblNhdmU9e2hhbmRsZVNhdmVUYXNrfVxuICAgICAgICAgIG9uVXBkYXRlVGFzaz17aGFuZGxlVXBkYXRlVGFza31cbiAgICAgICAgICBvbkRlbGV0ZVRhc2s9e2hhbmRsZURlbGV0ZVRhc2t9XG4gICAgICAgICAgb25DcmVhdGVTdWJ0YXNrPXtoYW5kbGVDcmVhdGVTdWJ0YXNrfVxuICAgICAgICAvPlxuICAgICAgKX1cblxuICAgICAge3NlbGVjdGVkVGFza0lkcy5zaXplID4gMCAmJiAoXG4gICAgICAgIDxkaXYgY2xhc3NOYW1lPVwiZml4ZWQgYm90dG9tLTYgbGVmdC0xLzIgLXRyYW5zbGF0ZS14LTEvMiB6LTQwIGJnLXN1cmZhY2UgYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlIHNoYWRvdy0yeGwgcm91bmRlZC1mdWxsIHB4LTYgcHktMyBmbGV4IGl0ZW1zLWNlbnRlciBzcGFjZS14LTYgdGV4dC1zbVwiPlxuICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwidGV4dC1zdHJvbmcgZm9udC1ib2xkXCI+XG4gICAgICAgICAgICB7c2VsZWN0ZWRUYXNrSWRzLnNpemV9IHRhc2t7c2VsZWN0ZWRUYXNrSWRzLnNpemUgPiAxID8gJ3MnIDogJyd9IHNlbGVjdGVkXG4gICAgICAgICAgPC9kaXY+XG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LXB4IGgtNiBiZy1zdXJmYWNlLWFjY2VudFwiIC8+XG4gICAgICAgICAgXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJmbGV4IGl0ZW1zLWNlbnRlciBzcGFjZS14LTNcIj5cbiAgICAgICAgICAgICA8c2VsZWN0IFxuICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctc3VyZmFjZS1kaW0gYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlIHJvdW5kZWQgcHgtMyBweS0xLjUgdGV4dC14cyB0ZXh0LXN0cm9uZyB1cHBlcmNhc2UgZm9udC1tZWRpdW0gaG92ZXI6Ym9yZGVyLWJvcmRlci1zdHJvbmcgZm9jdXM6b3V0bGluZS1ub25lIGN1cnNvci1wb2ludGVyIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gaGFuZGxlQnVsa1VwZGF0ZSh7IHN0YXR1czogZS50YXJnZXQudmFsdWUgYXMgYW55IH0pfVxuICAgICAgICAgICAgICAgdmFsdWU9XCJcIlxuICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJcIiBkaXNhYmxlZCBoaWRkZW4+Q2hhbmdlIFN0YXR1cy4uLjwvb3B0aW9uPlxuICAgICAgICAgICAgICAge2NvbHVtbnMubWFwKGMgPT4gKFxuICAgICAgICAgICAgICAgICA8b3B0aW9uIGtleT17Yy5pZH0gdmFsdWU9e2MuaWR9PntjLnRpdGxlfTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgKSl9XG4gICAgICAgICAgICAgPC9zZWxlY3Q+XG5cbiAgICAgICAgICAgICA8c2VsZWN0IFxuICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwiYmctc3VyZmFjZS1kaW0gYm9yZGVyIGJvcmRlci1ib3JkZXItc3VidGxlIHJvdW5kZWQgcHgtMyBweS0xLjUgdGV4dC14cyB0ZXh0LXN0cm9uZyB1cHBlcmNhc2UgZm9udC1tZWRpdW0gaG92ZXI6Ym9yZGVyLWJvcmRlci1zdHJvbmcgZm9jdXM6b3V0bGluZS1ub25lIGN1cnNvci1wb2ludGVyIHRyYW5zaXRpb24tY29sb3JzXCJcbiAgICAgICAgICAgICAgIG9uQ2hhbmdlPXsoZSkgPT4gaGFuZGxlQnVsa1VwZGF0ZSh7IHByaW9yaXR5OiBlLnRhcmdldC52YWx1ZSBhcyBhbnkgfSl9XG4gICAgICAgICAgICAgICB2YWx1ZT1cIlwiXG4gICAgICAgICAgICAgPlxuICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIlwiIGRpc2FibGVkIGhpZGRlbj5DaGFuZ2UgUHJpb3JpdHkuLi48L29wdGlvbj5cbiAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJ1cmdlbnRcIj5VcmdlbnQ8L29wdGlvbj5cbiAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJoaWdoXCI+SGlnaDwvb3B0aW9uPlxuICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cIm1lZGl1bVwiPk1lZGl1bTwvb3B0aW9uPlxuICAgICAgICAgICAgICAgPG9wdGlvbiB2YWx1ZT1cImxvd1wiPkxvdzwvb3B0aW9uPlxuICAgICAgICAgICAgIDwvc2VsZWN0PlxuXG4gICAgICAgICAgICAgPHNlbGVjdCBcbiAgICAgICAgICAgICAgIGNsYXNzTmFtZT1cImJnLXN1cmZhY2UtZGltIGJvcmRlciBib3JkZXItYm9yZGVyLXN1YnRsZSByb3VuZGVkIHB4LTMgcHktMS41IHRleHQteHMgdGV4dC1zdHJvbmcgdXBwZXJjYXNlIGZvbnQtbWVkaXVtIGhvdmVyOmJvcmRlci1ib3JkZXItc3Ryb25nIGZvY3VzOm91dGxpbmUtbm9uZSBjdXJzb3ItcG9pbnRlciB0cmFuc2l0aW9uLWNvbG9yc1wiXG4gICAgICAgICAgICAgICBvbkNoYW5nZT17KGUpID0+IGhhbmRsZUJ1bGtVcGRhdGUoeyBhc3NpZ25lZUlkOiBlLnRhcmdldC52YWx1ZSB8fCBudWxsIH0pfVxuICAgICAgICAgICAgICAgdmFsdWU9XCJcIlxuICAgICAgICAgICAgID5cbiAgICAgICAgICAgICAgIDxvcHRpb24gdmFsdWU9XCJcIiBkaXNhYmxlZCBoaWRkZW4+QXNzaWduIFRvLi4uPC9vcHRpb24+XG4gICAgICAgICAgICAgICA8b3B0aW9uIHZhbHVlPVwiXCI+VW5hc3NpZ25lZDwvb3B0aW9uPlxuICAgICAgICAgICAgICAge3VzZXJzLm1hcCh1ID0+IDxvcHRpb24ga2V5PXt1LmlkfSB2YWx1ZT17dS5pZH0+e3UubmFtZX08L29wdGlvbj4pfVxuICAgICAgICAgICAgIDwvc2VsZWN0PlxuICAgICAgICAgIDwvZGl2PlxuXG4gICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ3LXB4IGgtNiBiZy1zdXJmYWNlLWFjY2VudFwiIC8+XG4gICAgICAgICAgXG4gICAgICAgICAgPGJ1dHRvbiBcbiAgICAgICAgICAgIGNsYXNzTmFtZT1cInRleHQtcmVkLTUwMCBob3Zlcjp0ZXh0LXJlZC00MDAgaG92ZXI6YmctcmVkLTUwMC8xMCBweC0zIHB5LTEuNSByb3VuZGVkIHRyYW5zaXRpb24tY29sb3JzIGZsZXggaXRlbXMtY2VudGVyIHNwYWNlLXgtMlwiXG4gICAgICAgICAgICBvbkNsaWNrPXtoYW5kbGVCdWxrRGVsZXRlfVxuICAgICAgICAgICAgdGl0bGU9XCJEZWxldGUgU2VsZWN0ZWRcIlxuICAgICAgICAgID5cbiAgICAgICAgICAgIDxUcmFzaDIgc2l6ZT17MTZ9IC8+XG4gICAgICAgICAgICA8c3BhbiBjbGFzc05hbWU9XCJ0ZXh0LXhzIGZvbnQtbWVkaXVtIHVwcGVyY2FzZSBmb250LWJvbGRcIj5EZWxldGU8L3NwYW4+XG4gICAgICAgICAgPC9idXR0b24+XG5cbiAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInctcHggaC02IGJnLXN1cmZhY2UtYWNjZW50XCIgLz5cbiAgICAgICAgICBcbiAgICAgICAgICA8YnV0dG9uIFxuICAgICAgICAgICAgY2xhc3NOYW1lPVwidGV4dC1tdXRlZCBob3Zlcjp0ZXh0LXN0cm9uZyBob3ZlcjpiZy1zdXJmYWNlLWFjY2VudCBwLTEuNSByb3VuZGVkLWZ1bGwgdHJhbnNpdGlvbi1jb2xvcnNcIlxuICAgICAgICAgICAgb25DbGljaz17KCkgPT4gc2V0U2VsZWN0ZWRUYXNrSWRzKG5ldyBTZXQoKSl9XG4gICAgICAgICAgICB0aXRsZT1cIkNsZWFyIFNlbGVjdGlvblwiXG4gICAgICAgICAgPlxuICAgICAgICAgICAgPFggc2l6ZT17MTZ9IC8+XG4gICAgICAgICAgPC9idXR0b24+XG4gICAgICAgIDwvZGl2PlxuICAgICAgKX1cbiAgICAgIHtpc1dvcmtsb2FkTW9kYWxPcGVuICYmIHByb2plY3QgJiYgKFxuICAgICAgICA8V29ya2xvYWRNb2RhbFxuICAgICAgICAgIHByb2plY3RJZD17cHJvamVjdC5pZH1cbiAgICAgICAgICBwcm9qZWN0TmFtZT17cHJvamVjdC5uYW1lfVxuICAgICAgICAgIG9uQ2xvc2U9eygpID0+IHNldElzV29ya2xvYWRNb2RhbE9wZW4oZmFsc2UpfVxuICAgICAgICAvPlxuICAgICAgKX1cbiAgICAgIHtpc0FjdGl2aXR5TW9kYWxPcGVuICYmIHByb2plY3QgJiYgKFxuICAgICAgICA8UHJvamVjdEFjdGl2aXR5TW9kYWxcbiAgICAgICAgICBwcm9qZWN0SWQ9e3Byb2plY3QuaWR9XG4gICAgICAgICAgcHJvamVjdE5hbWU9e3Byb2plY3QubmFtZX1cbiAgICAgICAgICB1c2Vycz17dXNlcnN9XG4gICAgICAgICAgb25DbG9zZT17KCkgPT4gc2V0SXNBY3Rpdml0eU1vZGFsT3BlbihmYWxzZSl9XG4gICAgICAgIC8+XG4gICAgICApfVxuICAgIDwvZGl2PlxuICApO1xufVxuIl0sIm1hcHBpbmdzIjoiQUFtZXNCLFNBcURWLFVBckRVO0FBbmV0QixTQUFnQixVQUFVLFdBQVcsZUFBZTtBQUNwRCxT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
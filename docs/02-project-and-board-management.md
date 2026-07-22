# 📋 Project & Board Management

This document explains how to create and organize projects, manage task workflows using the Kanban board, edit detailed task items, and search through items.

---

## 1. Creating and Managing Projects

1. Navigate to the **Projects** page (`/projects`).
2. Click **"New Project"**.
3. Fill in the project details:
   - **Project Name** and **Identifier Key** (e.g., `PROJ` for task keys like `PROJ-101`).
   - **Description**: Overview of project goals.
   - **Status**: Planning, Active, On Hold, or Completed.
   - **Visibility**: Public (all team members) or Private (assigned teams only).
4. Click **"Create Project"**.

### Managing Project Members & Teams
- Open the project card menu and select **"Manage Teams"** or **"Manage Members"**.
- Assign entire functional teams (e.g., Frontend, Backend, QA) or individual members with specific permissions.

---

## 2. Interactive Kanban Board (`/board`)

The Kanban board provides a visual representation of task progress.

### Board Features:
- **Project Filter Selector**: Filter tasks by a specific project or view tasks across all active projects.
- **Workflow Columns**:
  - `Backlog`
  - `To Do`
  - `In Progress`
  - `In Review`
  - `Done`
- **Drag-and-Drop Column Reordering**: Grab any task card and drop it into another column to update its status instantly.
- **Task Card Details**: Shows task identifier key, title, priority badge, assignees avatars, subtask progress indicator, and linked Git branch badges.

---

## 3. Detailed Task Modal (`TaskModal.tsx`)

Clicking any task card opens the rich Task Details Modal:

### Core Fields:
- **Title & Description**: Supports rich text formatting.
- **Status & Priority**: Set priority level (Low, Medium, High, Urgent).
- **Assignees**: Assign one or multiple team members to a task.
- **Milestone / Sprint**: Link the task to an active sprint or roadmap milestone.
- **Due Date**: Set completion target date.

### Advanced Sub-components:
- **Subtasks Checklist**: Add nested items with checkable progress state.
- **Blockers & Dependencies**: Mark other tasks that block or are blocked by this task.
- **Git Branch Integration**:
  - View linked remote Git branches.
  - Click **"Create Git Branch"** to auto-generate a remote feature/fix branch directly on GitHub/GitLab.
  - View Pull Request / Merge Request links associated with the branch.
- **Comments & Activity Stream**: Post comments, mention teammates, and review historical audit logs of task changes.

---

## 4. Global Search & Filters

Press `Cmd + K` or `Ctrl + K` anywhere in the app to open the **Global Search**:
- Type task keys (e.g. `PROJ-12`), task titles, project names, or document titles.
- Filter search results by type (Tasks, Projects, Documents, Users).
- Use keyboard arrows to highlight and press `Enter` to jump directly to any item.

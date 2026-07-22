# 🗺️ Planning, Timeline & Task Graph

DevTeam Task Manager includes powerful visualization engines for high-level roadmap planning, sprint management, timeline tracking, and dependency graphing.

---

## 1. Roadmap & Sprint Planning (`/planning`)

The **Planning View** allows product managers and engineering leads to organize work into structured releases and sprints.

### Core Features:
- **Milestone Management**: Create milestones with start dates, target completion dates, and roadmap goals (e.g., *v1.0 Launch*, *Q3 Infrastructure Upgrade*).
- **Sprint Buckets**: Group tasks into active or upcoming sprints.
- **Unassigned Task Backlog**: Drag or assign loose tasks into active sprints.
- **Sprint Capacity Overview**: View total estimated points or hours allocated vs. team capacity.

---

## 2. Interactive Timeline D3 Chart (`TaskTimelineD3.tsx`)

The **Timeline View** presents a Gantt-style timeline chart powered by D3.js.

### How to Use the Timeline:
1. Select the project or milestone you wish to inspect.
2. The interactive chart plots tasks along a calendar axis based on start and due dates.
3. **Bar Colors**: Indicate status (e.g., Green for Done, Blue for In Progress, Amber for In Review, Gray for To Do).
4. **Hover Details**: Hover over any timeline bar to view task assignees, exact date ranges, and completion percentage.
5. **Zoom & Pan**: Drag horizontally or scroll to navigate forward and backward in time across months and quarters.

---

## 3. Visual Dependency Task Graph (`/graph`)

The **Graph View** renders an interactive node-and-edge graph using **React Flow** and the **Dagre** hierarchical layout algorithm.

### Key Capabilities:
- **Automatic Auto-Layout**: Tasks are structured as node blocks; dependency relationships are drawn as directional connecting lines (edges).
- **Dependency Tracking**:
  - **Blocker Edges**: Direct arrows indicating Task A blocks Task B.
  - **Subtask Edges**: Parent to child relationships.
- **Interactive Controls**:
  - **Node Selection**: Click a node to highlight its upstream blockers and downstream dependent tasks.
  - **Quick Edit**: Double click a task node to open its Task Modal directly.
  - **Pan & Zoom**: Drag canvas to pan, scroll wheel to zoom in/out, or click fit-view control buttons.
- **Layout Direction Toggle**: Switch layout direction between Top-to-Bottom (TB) and Left-to-Right (LR).

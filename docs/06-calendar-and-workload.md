# 📅 Calendar & Workload Analytics

This guide explains how to track task deadlines and monitor team member workload distribution.

---

## 1. Calendar View (`/calendar`)

The **Calendar View** maps tasks, milestones, and project deadlines onto a monthly calendar grid.

### Features:
- **Month / Week View Toggle**: Switch between a full-month grid or a detailed weekly schedule.
- **Project Filter**: View deadlines for all projects or narrow down to a single selected project.
- **Task Event Badges**:
  - Color-coded by priority (Urgent = Red, High = Amber, Medium = Blue, Low = Gray).
  - Hover or click on any task badge on the calendar to view a preview popup or launch the full Task Modal.
- **Drag-and-Drop Rescheduling**: Move tasks from one date cell to another on the calendar to update their due dates automatically.

---

## 2. Team Workload Modal & Capacity Tracking (`WorkloadModal.tsx`)

The **Workload Analytics** component helps team managers balance task distribution across team members.

### Metrics & Visualization:
- **Active Task Count per Member**: Bar chart showing total open tasks assigned to each team member.
- **Over-allocation Warnings**: Highlights team members assigned more tasks than their defined max capacity (e.g., > 5 high-priority tasks in a single sprint).
- **Task Reassignment**: Easily reassign tasks from overloaded members to available teammates directly from the workload modal.

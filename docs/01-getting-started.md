# 🚀 Getting Started & Authentication

This guide covers getting started with DevTeam Task Manager, navigating the application, authenticating accounts, and understanding role permissions.

---

## 1. Account Registration & Login

When accessing DevTeam Task Manager for the first time:
1. Navigate to the `/login` screen.
2. If you do not have an account, click **"Sign Up"** or visit `/register`.
3. Provide your Full Name, Email, Password, and select your primary role/department if prompted.
4. **First Account Admin Elevation**: The first registered user in the database is automatically granted the **Admin** role. Subsequent users receive default **Member** permissions until promoted by an Admin.

---

## 2. Social & OAuth Integrations

You can sign in using third-party identity providers if configured in the environment:
- **Google Sign-In**: Click "Continue with Google".
- **GitHub**: Authenticate via GitHub OAuth.
- **GitLab**: Authenticate via GitLab OAuth.

> *Note for Administrators*: To activate OAuth buttons, configure `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, and `GITLAB_CLIENT_ID` in your `.env` file along with their respective secrets.

---

## 3. Role-Based Access Control (RBAC)

The application enforces three distinct user access tiers:

| Role | Permissions & Capabilities |
| :--- | :--- |
| **Admin** | Full system administration. Can manage users, alter user roles, configure system settings, view all projects, perform database backup/restores, and delete records. |
| **Manager** | Can create projects, edit team configurations, manage milestones and sprints, assign tasks, and trigger remote Git branch creation. |
| **Member** | Can view assigned projects and tasks, move tasks across Kanban columns, add subtasks and comments, create remote branches, and edit documents. |

---

## 4. UI Layout & Navigation

### Left Navigation Sidebar
- **Expand / Collapse Toggle**: Click the sidebar collapse button or icon to collapse the sidebar into a compact view (80px width) or expand it (256px width) for maximum screen real estate.
- **Main Navigation Items**:
  - **Dashboard**: High-level overview of active projects, metrics, recent tasks, and activity feed.
  - **Projects**: Central directory of all team projects.
  - **Board**: Interactive Kanban board for tracking task statuses.
  - **Planning**: Sprint roadmap and milestone planning.
  - **Graph**: Visual task dependency graph powered by Dagre and React Flow.
  - **Calendar**: Deadlines and milestone timeline view.
  - **Documents**: Central wiki for PRDs, architectural guides, and meeting notes.
  - **Teams**: Manage team structures, domains, and member memberships.
  - **Users Admin** *(Admin Only)*: User account directory and access control.

### Top Header Bar
- **Global Search (`Cmd/Ctrl + K`)**: Instant search across tasks, projects, documents, and users.
- **Notifications Bell**: Dropdown feed showing task assignments, status changes, and mentions.
- **Theme Toggle**: Switch between Light Mode, Dark Mode, and High Contrast theme settings.
- **User Avatar Menu**: Quick access to your User Profile and sign-out option.

# 🌿 Git & Branch Management

DevTeam Task Manager features deep integration with **GitHub** and **GitLab** repositories, enabling developers to create remote branches, inspect pull/merge requests, and copy terminal checkout commands without leaving the app.

---

## 1. Connecting a Project to a Git Repository

To enable Git integrations for a project:

1. Open the **Projects** page (`/projects`).
2. Click the Git icon on a project card or open the project options and select **"Repository Settings"**.
3. Configure the following fields:
   - **Provider**: Select **GitHub** or **GitLab**.
   - **Repository URL**: E.g. `https://github.com/my-org/my-repo` or `https://gitlab.com/my-org/my-repo`.
   - **Default Base Branch**: E.g. `main` or `master`.
   - **Personal Access Token (PAT)**: Provide a token with repository write access (`repo` scope for GitHub, `api` scope for GitLab).

---

## 2. Remote Branch Operations

### Creating a Branch from a Task:
1. Open any task card in the Kanban Board or Task List.
2. In the task modal under the **Git Branches** section, click **"Create Remote Branch"**.
3. Choose the branch prefix (`feature/`, `fix/`, `chore/`, `refactor/`).
4. The system automatically formats a clean, standardized branch name (e.g. `feature/PROJ-14-add-jwt-auth`).
5. Select the base branch (defaults to project base branch).
6. Click **"Confirm Creation"**. The app makes an API request to GitHub/GitLab to create the branch remotely.

### One-Click Terminal Checkout:
Next to any linked branch badge, click the **Copy Terminal Command** button.
This copies a ready-to-paste command to your clipboard:
```bash
git fetch origin && git checkout feature/PROJ-14-add-jwt-auth
```

---

## 3. Pull Request & Merge Request Automation

- **Creating PRs / MRs**: Click **"Create Pull Request"** (GitHub) or **"Create Merge Request"** (GitLab) on a branch item.
- **Auto-generated Metadata**: Pre-fills PR title with the task key and title, and includes a link back to the task in the description.
- **Direct Link**: Once created, a direct PR badge appears on the task card for quick code review navigation.

---

## 4. Repository Management Page (`/git-repository`)

Navigate to `/git-repository` to view repository-wide insights:
- **Active Branches List**: Overview of all active remote branches across projects.
- **Commit History**: View short commit SHAs, commit messages, authors, and timestamps.
- **Protected Branch Safeguards**: Identifies protected branches (`main`, `production`, `staging`).

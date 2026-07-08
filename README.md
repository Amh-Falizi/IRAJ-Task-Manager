# DevTeam Task Manager

A comprehensive full-stack task management and progress tracking application designed for software development teams, featuring Git branch generation and role-based permissions.

## Features

- **Project Management**: Track and manage issues, tasks, and features using a dynamic Kanban board.
- **Milestone Planning**: Define roadmaps, track active sprints, and visualize goals with Planning Mode and Timeline views.
- **Task Graph Visualization**: Interactively view blockers, sub-tasks, and complex task dependencies.
- **Product Documentation**: Write, edit, and safely store project PRDs, meeting notes, and architecture decisions with rich Markdown support.
- **Git Branch Generation**: Automatically generate git branch names based on task contexts and project keys, allowing smooth development sync.
- **Calendar & Workload**: View important deadlines and monitor team workload distributed out by month or week.
- **Multi-Provider Authentication**: Secure local authentication paired with dynamic OAuth integrations for Google, GitHub, and GitLab with beautiful, custom-branded buttons and smooth transition states.
- **Team Access Control**: Establish secure team domains, custom roles (Admin, Manager, Member), and strict project visibility permissions.

## Tech Stack

- **Frontend**: React (v19) + Vite, TypeScript, Tailwind CSS, Lucide React (for UI design)
- **Visuals & Charts**: React Flow (`@xyflow/react`), Dagre, Recharts
- **Backend Application**: Node.js + Express.js API
- **Database Architecture**: PostgreSQL (via `pg`) with seamless fallback to local SQLite (`sqlite3`) for zero-config development.
- **AI Tooling**: Google Gemini (`@google/genai`) for intelligent string and branch generation features

## Development Requirements 

To get up and running, ensure you have the following installed:
- Node.js (v20+ recommended)

## Installation Guide

1. **Install Packages**  
   Download all dependencies defined in `package.json`:
   ```bash
   npm install
   ```

2. **Setup your Environment**  
   Create a `.env` file at the root of the project with the following configuration:
   ```env
   # GEMINI_API_KEY: Required for AI generation features
   GEMINI_API_KEY="YOUR_API_KEY"

   # APP_URL: URL where the app is hosted (used for callbacks and links)
   APP_URL="http://localhost:3000"

   # DATABASE_URL: Connect to a PostgreSQL instance (falls back to SQLite if omitted)
   DATABASE_URL="postgres://user:password@localhost:5432/dbname"

   # Google OAuth Integration
   GOOGLE_CLIENT_ID="YOUR_GOOGLE_CLIENT_ID"
   GOOGLE_CLIENT_SECRET="YOUR_GOOGLE_CLIENT_SECRET"

   # GitHub OAuth Integration
   GITHUB_CLIENT_ID="YOUR_GITHUB_CLIENT_ID"
   GITHUB_CLIENT_SECRET="YOUR_GITHUB_CLIENT_SECRET"

   # GitLab OAuth Integration
   GITLAB_CLIENT_ID="YOUR_GITLAB_CLIENT_ID"
   GITLAB_CLIENT_SECRET="YOUR_GITLAB_CLIENT_SECRET"

   # Local Docker Postgres Configuration (Optional: for docker-compose)
   POSTGRES_USER="user"
   POSTGRES_PASSWORD="password"
   POSTGRES_DB="dbname"
   ```

3. **Start the Development Server**
   Start both the Vite SPA and Express backend server smoothly using `tsx`:
   ```bash
   npm run dev
   ```
   *The server operates safely behind port 3000.*

4. **Build for Production**
   Compiles code via ESbuild for backend routing and Vite build for bundled static assets:
   ```bash
   npm run build
   ```
   Once built, start the robust production build:
   ```bash
   npm start
   ```

## License

This software is provided under the MIT License.

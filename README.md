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

## Database Backup & Restore

The application comes with high-fidelity database backup and restore utilities. These are available both as a clean, interactive GUI inside the app and as a flexible Command Line Interface (CLI) tool.

### 1. In-App User Interface
Navigate to your **Profile** page and switch to the **Backup & Restore** tab:
- **Database Status**: Instantly monitor the active database engine (SQLite or PostgreSQL), file size, and complete table statistics (counts of Users, Tasks, Projects, Teams, and Documents).
- **Export Backups**:
  - **SQLite binary (`.sqlite`)**: High-fidelity full database file download.
  - **Portable JSON schema (`.json`)**: Export database tables in clear, readable JSON. This portable format can be used to transfer data between SQLite and PostgreSQL backends!
- **Restore Backups**: Upload a previously exported SQLite binary or portable JSON backup file to instantly restore your workspace data. *Warning: This replaces all active records.*

### 2. Command Line Interface (CLI) Utility
You can manage backups directly via terminal scripts. Run the utility with:
```bash
npm run db-cli <command> [arguments]
```
Or run directly with `npx tsx`:
```bash
npx tsx scripts/db-cli.ts <command> [arguments]
```

#### Available Commands:
* **`stats` / `status`**: Shows the active database file, path, exact size, and lists row counts for every schema table.
* **`backup [target-file]`**: Backs up the SQLite database file. If no target path is supplied, it generates a timestamped snapshot under the `./backups/` directory (e.g., `./backups/backup-2026-07-14-140025.sqlite`).
* **`restore <source-file>`**: Safely restores the active database using a binary `.sqlite` file. It automatically creates an emergency `.rollback` backup of your current database first.
* **`export-json [target-file]`**: Exports all workspace tables and records into a portable, formatted JSON backup file under `./backups/`.
* **`import-json <source-file>`**: Purges all existing tables and populates them with rows from the specified portable JSON backup file (runs inside a database transaction). It creates an emergency `.rollback-json` backup of your current database before starting.

---

## Self-Hosting & SQLite Persistence (VPS)

If you wish to host the application on your own **Virtual Private Server (VPS)** without setting up PostgreSQL or external databases, you can safely use the built-in SQLite engine with standard persistent storage.

### 1. Raw Node.js Deployment
If running directly on the host system:
1. Clone the repository onto your VPS.
2. Install dependencies: `npm install --production`.
3. Create a production `.env` file containing your production settings (e.g. `PORT=3003`, `APP_URL`, etc.). Ensure `DATABASE_URL` is omitted so the app automatically defaults to SQLite.
4. Build the application: `npm run build`.
5. Run the application in the background using a process manager like **PM2**:
   ```bash
   npm install -g pm2
   pm2 start dist/server.cjs --name "devteam-taskmanager"
   ```
   *Your `database.sqlite` file will persist reliably in the application root directory across service restarts.*

### 2. Docker Deployment with Persistent Volume
If deploying via Docker, the active SQLite file (`database.sqlite`) is written inside the container's working directory (`/app`). To prevent data loss when the container is rebuilt or restarted, you must mount a persistent volume for the database file:

#### Option A: Docker Run (Single Volume Mount)
Initialize and run the container by mounting a directory from your VPS host to the database file path:
```bash
docker run -d \
  -p 3003:3003 \
  -v /var/lib/devteam-taskmanager/database.sqlite:/app/database.sqlite \
  -e PORT=3003 \
  -e GEMINI_API_KEY="your_gemini_key" \
  -e APP_URL="https://yourdomain.com" \
  --name taskmanager \
  your-docker-image
```

#### Option B: Docker Compose
Create a `docker-compose.yml` file on your VPS:
```yaml
version: '3.8'

services:
  app:
    image: your-docker-image
    ports:
      - "3003:3003"
    environment:
      - PORT=3003
      - GEMINI_API_KEY=your_gemini_key
      - APP_URL=https://yourdomain.com
    volumes:
      # Mounts the local host directory containing the sqlite db file to /app inside the container
      - ./data/database.sqlite:/app/database.sqlite
    restart: always
```

*By mounting `./data/database.sqlite` (or a named docker volume), all of your project, task, and user data will remain perfectly safe and persistent.*

---

## License

This software is provided under the MIT License.

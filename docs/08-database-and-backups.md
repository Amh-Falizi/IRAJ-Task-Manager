# 💾 Database Operations & Backups

DevTeam Task Manager supports zero-config local **SQLite** development and high-performance **PostgreSQL** production environments, accompanied by in-app and CLI backup utilities.

---

## 1. Dual Engine Architecture (SQLite & PostgreSQL)

The application automatically selects its database driver based on environment variables:

- **SQLite Engine** *(Default)*: Activated when `DATABASE_URL` is omitted. Stores data locally in `database.sqlite` inside the root folder. Ideal for local dev, rapid testing, and VPS single-node deployments.
- **PostgreSQL Engine**: Activated when `DATABASE_URL` is set (e.g., `DATABASE_URL=postgres://user:pass@localhost:5432/dbname`). Ideal for production deployments and multi-container scaling.

---

## 2. In-App Backup & Restore UI

Admins can manage database backups directly from the **Profile -> Backup & Restore** section:

### Exporting Options:
- **Binary SQLite Download (`.sqlite`)**: Direct binary copy of the active SQLite database file.
- **Portable JSON Backup (`.json`)**: Formatted JSON representation of all tables and records. Portable between SQLite and PostgreSQL backends!

### Restoring Data:
- Click **"Restore Database"** and select a `.sqlite` or `.json` backup file.
- The system validates the schema, replaces active records inside a single transaction, and automatically creates a `.rollback` backup before completing.

---

## 3. Command Line Interface Utility (`scripts/db-cli.ts`)

You can run database maintenance tasks from the server terminal:

### Command Syntax:
```bash
npm run db-cli <command> [args]
# or
npx tsx scripts/db-cli.ts <command> [args]
```

### Supported Commands:

#### 1. `stats` / `status`
Displays database status, active file path, storage size, and table row counts.
```bash
npm run db-cli stats
```

#### 2. `backup [target-file]`
Creates a binary snapshot of the SQLite database file in `./backups/`.
```bash
npm run db-cli backup
# Output: Backup saved to ./backups/backup-2026-07-22-013000.sqlite
```

#### 3. `restore <source-file>`
Restores database from a binary `.sqlite` file. Automatically creates an emergency `.rollback` file first.
```bash
npm run db-cli restore ./backups/backup-2026-07-22-013000.sqlite
```

#### 4. `export-json [target-file]`
Exports all database tables into a portable JSON file.
```bash
npm run db-cli export-json ./backups/data-export.json
```

#### 5. `import-json <source-file>`
Imports tables from a portable JSON backup file inside a single transaction.
```bash
npm run db-cli import-json ./backups/data-export.json
```

---

## 4. Production VPS & Docker Deployment

### Docker Compose Quickstart:
```bash
# 1. Start Postgres + Node.js App container
docker compose up -d --build

# 2. Inspect logs
docker compose logs -f app
```

### Self-Hosting on VPS with PM2 (SQLite Mode):
```bash
npm install --production
npm run build
npm install -g pm2
pm2 start dist/server.cjs --name "devteam-taskmanager"
```

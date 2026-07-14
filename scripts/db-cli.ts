#!/usr/bin/env npx tsx
import fs from "fs";
import path from "path";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

const DB_FILE = path.join(process.cwd(), "database.sqlite");

// Help instructions
function printHelp() {
  console.log(`
\x1b[1m\x1b[34mDatabase CLI Utility - Backup & Restore\x1b[0m
=========================================
Usage:
  \x1b[32mnpm run db-cli <command> [arguments]\x1b[0m
  or: \x1b[32mnpx tsx scripts/db-cli.ts <command> [arguments]\x1b[0m

Commands:
  \x1b[36mstatus / stats\x1b[0m
    Display database size, table counts, and schema details.

  \x1b[36mbackup [target-file]\x1b[0m
    Backup the active SQLite database to a target file.
    Default: ./backups/backup-YYYY-MM-DD-HHMMSS.sqlite

  \x1b[36mrestore <source-file>\x1b[0m
    Restore the database by replacing it with a .sqlite database file.

  \x1b[36mexport-json [target-file]\x1b[0m
    Export all table data into a portable JSON backup file.
    Default: ./backups/backup-YYYY-MM-DD-HHMMSS.json

  \x1b[36mimport-json <source-file>\x1b[0m
    Clear all current tables and import records from a portable JSON backup file.

  \x1b[36mhelp\x1b[0m
    Show this help message.
`);
}

async function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    console.log(`\x1b[33mWarning: Database file not found at ${DB_FILE}. A new one will be created.\x1b[0m`);
  }
  return await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });
}

// Format bytes helper
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Ensure backup folder exists
function ensureBackupDir(): string {
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

// Generate timestamped filename
function getTimestampedFilename(extension: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `backup-${dateStr}-${timeStr}.${extension}`;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  if (!command || command === "help" || command === "-h" || command === "--help") {
    printHelp();
    process.exit(0);
  }

  try {
    switch (command) {
      case "status":
      case "stats": {
        console.log("\x1b[1m\x1b[34mChecking Database Status...\x1b[0m");
        if (!fs.existsSync(DB_FILE)) {
          console.log(`\x1b[31mDatabase file does not exist at ${DB_FILE}\x1b[0m`);
          process.exit(1);
        }

        const size = fs.statSync(DB_FILE).size;
        console.log(`Database File: \x1b[32m${DB_FILE}\x1b[0m`);
        console.log(`File Size:     \x1b[32m${formatBytes(size)}\x1b[0m`);

        const db = await getDb();
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        
        console.log("\n\x1b[1mTable Statistics:\x1b[0m");
        console.log("-----------------------------------------");
        for (const t of tables) {
          try {
            const countRes = await db.get(`SELECT COUNT(*) as count FROM ${t.name}`);
            console.log(`  - \x1b[36m${t.name.padEnd(20)}\x1b[0m : ${countRes.count} records`);
          } catch (e: any) {
            console.log(`  - \x1b[31m${t.name.padEnd(20)}\x1b[0m : Error reading (${e.message})`);
          }
        }
        console.log("-----------------------------------------");
        await db.close();
        break;
      }

      case "backup": {
        const backupDir = ensureBackupDir();
        let targetFile = args[1];
        if (!targetFile) {
          targetFile = path.join(backupDir, getTimestampedFilename("sqlite"));
        } else {
          targetFile = path.resolve(targetFile);
        }

        console.log(`\x1b[1m\x1b[34mBacking up database...\x1b[0m`);
        if (!fs.existsSync(DB_FILE)) {
          console.log(`\x1b[31mError: Database file does not exist at ${DB_FILE}\x1b[0m`);
          process.exit(1);
        }

        fs.copyFileSync(DB_FILE, targetFile);
        console.log(`\x1b[32m✔ Database backed up successfully!\x1b[0m`);
        console.log(`Saved to: \x1b[36m${targetFile}\x1b[0m (${formatBytes(fs.statSync(targetFile).size)})`);
        break;
      }

      case "restore": {
        const sourceFile = args[1];
        if (!sourceFile) {
          console.log("\x1b[31mError: Missing source file path. Usage: npm run db-cli restore <file>\x1b[0m");
          process.exit(1);
        }

        const resolvedSource = path.resolve(sourceFile);
        if (!fs.existsSync(resolvedSource)) {
          console.log(`\x1b[31mError: Backup file not found at ${resolvedSource}\x1b[0m`);
          process.exit(1);
        }

        console.log(`\x1b[1m\x1b[31m⚠ WARNING: This will replace your active database at ${DB_FILE}.\x1b[0m`);
        console.log(`Source backup: \x1b[36m${resolvedSource}\x1b[0m`);
        
        // Direct overwrite
        // Create emergency rollback backup first
        if (fs.existsSync(DB_FILE)) {
          const rollbackPath = DB_FILE + ".rollback";
          fs.copyFileSync(DB_FILE, rollbackPath);
          console.log(`Created rollback backup at: \x1b[33m${rollbackPath}\x1b[0m`);
        }

        fs.copyFileSync(resolvedSource, DB_FILE);
        console.log(`\x1b[32m✔ Database restored successfully from SQLite file!\x1b[0m`);
        break;
      }

      case "export-json": {
        const backupDir = ensureBackupDir();
        let targetFile = args[1];
        if (!targetFile) {
          targetFile = path.join(backupDir, getTimestampedFilename("json"));
        } else {
          targetFile = path.resolve(targetFile);
        }

        console.log(`\x1b[1m\x1b[34mExporting database to portable JSON format...\x1b[0m`);
        const db = await getDb();
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        
        const backupData: Record<string, any[]> = {};
        for (const t of tables) {
          try {
            const rows = await db.all(`SELECT * FROM ${t.name}`);
            backupData[t.name] = rows;
            console.log(`  - Exported \x1b[36m${t.name}\x1b[0m: ${rows.length} rows`);
          } catch (e: any) {
            console.log(`  - \x1b[31mError exporting table ${t.name}:\x1b[0m ${e.message}`);
          }
        }

        fs.writeFileSync(targetFile, JSON.stringify(backupData, null, 2));
        await db.close();

        console.log(`\x1b[32m✔ Database exported successfully to JSON!\x1b[0m`);
        console.log(`Saved to: \x1b[36m${targetFile}\x1b[0m (${formatBytes(fs.statSync(targetFile).size)})`);
        break;
      }

      case "import-json": {
        const sourceFile = args[1];
        if (!sourceFile) {
          console.log("\x1b[31mError: Missing JSON backup file. Usage: npm run db-cli import-json <file>\x1b[0m");
          process.exit(1);
        }

        const resolvedSource = path.resolve(sourceFile);
        if (!fs.existsSync(resolvedSource)) {
          console.log(`\x1b[31mError: Backup file not found at ${resolvedSource}\x1b[0m`);
          process.exit(1);
        }

        console.log(`\x1b[1m\x1b[31m⚠ WARNING: Importing JSON backup will clear ALL existing records in matching tables.\x1b[0m`);
        console.log(`Source JSON: \x1b[36m${resolvedSource}\x1b[0m`);

        const content = fs.readFileSync(resolvedSource, "utf-8");
        const backupData = JSON.parse(content);

        if (!backupData || typeof backupData !== "object") {
          console.log("\x1b[31mError: Invalid JSON backup file format.\x1b[0m");
          process.exit(1);
        }

        // Backup SQLite first
        if (fs.existsSync(DB_FILE)) {
          const rollbackPath = DB_FILE + ".rollback-json";
          fs.copyFileSync(DB_FILE, rollbackPath);
          console.log(`Created rollback backup of current SQLite database at: \x1b[33m${rollbackPath}\x1b[0m`);
        }

        const db = await getDb();
        
        // Import in transaction
        await db.run("BEGIN TRANSACTION;");
        try {
          const tablesToImport = Object.keys(backupData);
          for (const table of tablesToImport) {
            // Verify if table exists
            const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", table);
            if (!tableExists) {
              console.log(`\x1b[33mSkipping table ${table}: does not exist in target database schema.\x1b[0m`);
              continue;
            }

            // Clear table
            await db.run(`DELETE FROM ${table};`);
            
            const rows = backupData[table];
            if (!Array.isArray(rows) || rows.length === 0) {
              console.log(`  - \x1b[36m${table}\x1b[0m: Cleared (0 rows to import)`);
              continue;
            }

            const firstRow = rows[0];
            const columns = Object.keys(firstRow);
            const placeholders = columns.map(() => "?").join(", ");
            const insertSql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;

            for (const row of rows) {
              const params = columns.map(col => row[col]);
              await db.run(insertSql, params);
            }
            console.log(`  - \x1b[32m✔ Imported ${table}\x1b[0m: ${rows.length} rows`);
          }

          await db.run("COMMIT;");
          console.log(`\x1b[32m✔ Database restored successfully from JSON backup file!\x1b[0m`);
        } catch (err: any) {
          await db.run("ROLLBACK;");
          console.log(`\x1b[31m❌ Error during JSON import. Changes rolled back. Error: ${err.message}\x1b[0m`);
        } finally {
          await db.close();
        }
        break;
      }

      default: {
        console.log(`\x1b[31mUnknown command: ${command}\x1b[0m`);
        printHelp();
        process.exit(1);
      }
    }
  } catch (err: any) {
    console.error(`\x1b[31mAn unexpected error occurred:\x1b[0m`, err);
    process.exit(1);
  }
}

main();

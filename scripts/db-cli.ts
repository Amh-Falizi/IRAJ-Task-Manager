#!/usr/bin/env npx tsx
/**
 * @file db-cli.ts
 * @description A comprehensive command-line interface (CLI) tool for SQLite database backup, restore, 
 * status checking, and portable JSON format migration in local and dev environments.
 * @author Amir Hossein Falizi
 */

import fs from "fs";
import path from "path";
import { open } from "sqlite";
import sqlite3 from "sqlite3";

/**
 * Path to the active workspace SQLite database file.
 */
const DB_FILE = path.join(process.cwd(), "database.sqlite");

/**
 * Prints the interactive help menu to the console, demonstrating all supported
 * backup, restore, stats, and JSON import/export commands with color-coded examples.
 */
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

/**
 * Initializes and establishes an asynchronous connection to the SQLite database.
 * If the database file is not present, prints a friendly warning.
 * 
 * @returns {Promise<import("sqlite").Database>} The opened sqlite connection instance.
 */
async function getDb() {
  if (!fs.existsSync(DB_FILE)) {
    console.log(`\x1b[33mWarning: Database file not found at ${DB_FILE}. A new one will be created.\x1b[0m`);
  }
  return await open({
    filename: DB_FILE,
    driver: sqlite3.Database
  });
}

/**
 * Converts a raw byte count into a human-readable string (e.g., KB, MB, GB).
 * 
 * @param {number} bytes - The size in bytes to convert.
 * @returns {string} Human-readable file size with unit.
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Assures the existence of the backup repository directory (`./backups`).
 * Creates the directory recursively if it does not yet exist.
 * 
 * @returns {string} The absolute path of the verified backups directory.
 */
function ensureBackupDir(): string {
  const backupDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

/**
 * Generates an elegant and chronological timestamped filename for exports.
 * Format: backup-YYYY-MM-DD-HHMMSS.ext
 * 
 * @param {string} extension - The target file extension (e.g., 'sqlite', 'json').
 * @returns {string} Timestamped filename.
 */
function getTimestampedFilename(extension: string): string {
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '');
  return `backup-${dateStr}-${timeStr}.${extension}`;
}

/**
 * The primary execution context for the CLI utility. Handles argument parsing,
 * orchestrates the requested command workflow, manages backup files, and carries
 * out transactional imports to preserve data integrity.
 */
async function main() {
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();

  // Show help instructions if no command is specified or help flag is requested
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

        // Output basic SQLite file metadata
        const size = fs.statSync(DB_FILE).size;
        console.log(`Database File: \x1b[32m${DB_FILE}\x1b[0m`);
        console.log(`File Size:     \x1b[32m${formatBytes(size)}\x1b[0m`);

        const db = await getDb();
        // Query list of user-created tables, filtering out SQLite internal system metadata
        const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
        
        console.log("\n\x1b[1mTable Statistics:\x1b[0m");
        console.log("-----------------------------------------");
        for (const t of tables) {
          try {
            // Retrieve exact count of active records per table
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
        // Default to autogenerated timestamped filename under backups/ if custom path isn't provided
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

        // Perform standard synchronous file replication for full fidelity backup
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
        
        // Create emergency rollback backup file first in case anything goes wrong during restoration
        if (fs.existsSync(DB_FILE)) {
          const rollbackPath = DB_FILE + ".rollback";
          fs.copyFileSync(DB_FILE, rollbackPath);
          console.log(`Created rollback backup at: \x1b[33m${rollbackPath}\x1b[0m`);
        }

        // Overwrite the live SQLite database file
        fs.copyFileSync(resolvedSource, DB_FILE);
        console.log(`\x1b[32m✔ Database restored successfully from SQLite file!\x1b[0m`);
        break;
      }

      case "export-json": {
        const backupDir = ensureBackupDir();
        let targetFile = args[1];
        // Default to a timestamped .json filename if no destination is supplied
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
            // Fetch all records for the current table and map them to standard serializable objects
            const rows = await db.all(`SELECT * FROM ${t.name}`);
            backupData[t.name] = rows;
            console.log(`  - Exported \x1b[36m${t.name}\x1b[0m: ${rows.length} rows`);
          } catch (e: any) {
            console.log(`  - \x1b[31mError exporting table ${t.name}:\x1b[0m ${e.message}`);
          }
        }

        // Format and save the tables as a beautiful, indented JSON structure
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

        // Keep a copy of the current database state for rollback in case of data structure conflict
        if (fs.existsSync(DB_FILE)) {
          const rollbackPath = DB_FILE + ".rollback-json";
          fs.copyFileSync(DB_FILE, rollbackPath);
          console.log(`Created rollback backup of current SQLite database at: \x1b[33m${rollbackPath}\x1b[0m`);
        }

        const db = await getDb();
        
        // Execute the entire import process inside an atomic SQL transaction to prevent partial/corrupt state
        await db.run("BEGIN TRANSACTION;");
        try {
          const tablesToImport = Object.keys(backupData);
          for (const table of tablesToImport) {
            // Verify if table exists in active schema first
            const tableExists = await db.get("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", table);
            if (!tableExists) {
              console.log(`\x1b[33mSkipping table ${table}: does not exist in target database schema.\x1b[0m`);
              continue;
            }

            // Clear active data inside the table
            await db.run(`DELETE FROM ${table};`);
            
            const rows = backupData[table];
            if (!Array.isArray(rows) || rows.length === 0) {
              console.log(`  - \x1b[36m${table}\x1b[0m: Cleared (0 rows to import)`);
              continue;
            }

            // Construct secure parameterized insert statement dynamically
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
          // Rollback the transaction on any constraint failures or execution errors
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

// Fire CLI Execution
main();

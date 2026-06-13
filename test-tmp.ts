import { open } from "sqlite";
import sqlite3 from "sqlite3";
import fs from "fs";

async function run() {
  try {
    let DB_FILE = "/tmp/database.sqlite";
    console.log("Stats mode:", fs.statSync(DB_FILE).mode.toString(8));
    
    const sqliteDb = await open({
      filename: DB_FILE,
      driver: sqlite3.Database
    });
    
    await sqliteDb.exec("CREATE TABLE IF NOT EXISTS _sqlite_write_test (id INTEGER PRIMARY KEY);");
    await sqliteDb.run("INSERT INTO _sqlite_write_test (id) VALUES (NULL);");
    const rows = await sqliteDb.all("SELECT * FROM _sqlite_write_test");
    console.log("tmp success! Rows:", rows);
  } catch (e) {
    console.error("tmp Error:", e);
  }
}
run();

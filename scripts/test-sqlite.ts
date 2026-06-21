import { open } from "sqlite";
import sqlite3 from "sqlite3";
import fs from "fs";

async function run() {
  try {
    const db = await open({
      filename: process.cwd() + "/database.sqlite",
      driver: sqlite3.Database
    });
    
    await db.exec("CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY);");
    await db.run("INSERT INTO test (id) VALUES (NULL)");
    const rows = await db.all("SELECT * FROM test");
    console.log("Success! Rows:", rows);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();

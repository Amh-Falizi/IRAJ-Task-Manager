import sqlite3 from "sqlite3";
import { open } from "sqlite";
import fs from "fs";

async function run() {
  const db = await open({
    filename: process.cwd() + "/database.sqlite",
    driver: sqlite3.Database
  });
  const users = await db.all("SELECT * FROM users");
  console.log("Users:", users);
  
  const testUsers = await db.all("SELECT * FROM _sqlite_write_test");
  console.log("Tests:", testUsers);
}
run();

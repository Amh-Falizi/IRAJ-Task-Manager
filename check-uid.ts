console.log("UID:", process.getuid());
console.log("GID:", process.getgid());
import fs from "fs";
const stats = fs.statSync(process.cwd() + "/database.sqlite");
console.log("File UID:", stats.uid);
console.log("File GID:", stats.gid);

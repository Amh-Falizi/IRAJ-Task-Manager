import fs from "fs";
const dirs = fs.readdirSync("/proc");
for (const pid of dirs) {
  if (isNaN(parseInt(pid))) continue;
  try {
    const cmd = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8');
    if (cmd.includes("server.ts") || cmd.includes("npm")) {
      console.log("PID:", pid, "CMD:", cmd.replace(/\0/g, ' '));
      process.kill(parseInt(pid), 'SIGKILL');
    }
  } catch(e) {}
}

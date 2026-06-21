import fs from "fs";
const dirs = fs.readdirSync("/proc");
for (const pid of dirs) {
  if (isNaN(parseInt(pid))) continue;
  try {
    const fds = fs.readdirSync('/proc/' + pid + '/fd');
    for (const fd of fds) {
      try {
        const link = fs.readlinkSync('/proc/' + pid + '/fd/' + fd);
        if (link.includes("socket:[3144]")) {
          const cmd = fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8');
          console.log("PID:", pid, "CMD:", cmd.replace(/\0/g, ' '));
        }
      } catch (e) {}
    }
  } catch (e) {}
}

try {
  process.kill(2248, "SIGKILL");
  console.log("Killed 2248");
} catch(e) {
  console.log("Failed to kill", e);
}

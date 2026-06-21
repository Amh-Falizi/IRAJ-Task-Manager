import fs from "fs";
async function run() {
  const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6ImVhZWM2YjgxLTkxODItNDFjZS1hZjQyLTZjNWQ1MmJlZmEzNCIsInJvbGUiOiJkZXZlbG9wZXIiLCJpYXQiOjE3ODEzMzAxMDgsImV4cCI6MTc4MTkzNDkwOH0.ralECKir-S5bAomrja-q0x3ymmfywPwyiKxozSU3x70";
  const res = await fetch("http://127.0.0.1:3000/api/auth/me", {
    headers: { "Authorization": "Bearer " + token }
  });
  console.log("Status:", res.status);
  console.log("Body:", await res.text());
}
run();

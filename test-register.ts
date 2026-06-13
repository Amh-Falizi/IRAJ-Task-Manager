import { v4 as uuidv4 } from "uuid";
async function run() {
  try {
    const res = await fetch("http://127.0.0.1:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", email: "test" + Date.now() + "@test.com", password: "pwd", role: "developer" })
    });
    const data = await res.json();
    console.log("Register response:", data);
  } catch(e) {
    console.log("Error:", e);
  }
}
run();

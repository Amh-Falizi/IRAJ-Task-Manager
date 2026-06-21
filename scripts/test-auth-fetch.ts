import fs from "fs";
import { v4 as uuidv4 } from "uuid";

(async () => {
    try {
        const res1 = await fetch("http://localhost:3000/api/auth/register", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "User", email: "user@example.com", password: "password" })
        });
        const data1 = await res1.json();
        const token = data1.token;

        const res2 = await fetch("http://localhost:3000/api/tasks", {
            headers: { Authorization: "Bearer " + token }
        });
        console.log("Status:", res2.status, res2.ok);
        const text = await res2.text();
        console.log("Body:", text.substring(0, 100));
    } catch(e) {
        console.error(e);
    }
})();

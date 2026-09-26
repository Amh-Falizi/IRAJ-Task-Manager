import { v4 as uuidv4 } from "uuid";
import { dbPromise, purgeStaleUnverifiedUsers } from "../db.js";
import { decryptSecret } from "../config.js";

export async function runBackgroundPrSync() {
  console.log("[Background Sync] Starting automatic pull request sync...");
  try {
    const db = await dbPromise;
    // Get all projects with Git configured
    const projects = await db.all(
      "SELECT * FROM projects WHERE repoOwner IS NOT NULL AND repoName IS NOT NULL AND repoToken IS NOT NULL"
    );
    if (!projects || projects.length === 0) {
      console.log("[Background Sync] No projects configured with Git. Skipping.");
      return;
    }

    for (const project of projects) {
      const provider = project.repoProvider || "github";
      const owner = project.repoOwner;
      const name = project.repoName;
      const token = decryptSecret(project.repoToken);

      const tasks = await db.all(
        "SELECT id, title, prUrl, prStatus, status FROM tasks WHERE projectId = ? AND prUrl IS NOT NULL AND prUrl != '' AND prStatus != 'merged' AND prStatus != 'closed'",
        [project.id]
      );

      if (!tasks || tasks.length === 0) continue;

      for (const task of tasks) {
        try {
          let prNumber: string | null = null;
          if (provider === "github") {
            const match = task.prUrl.match(/\/pull\/(\d+)/);
            if (match) prNumber = match[1];
          } else if (provider === "gitlab") {
            const match = task.prUrl.match(/\/merge_requests\/(\d+)/);
            if (match) prNumber = match[1];
          }

          if (!prNumber) continue;

          let remotePrStatus = task.prStatus || "open";
          let remoteMerged = false;

          if (provider === "github") {
            const headers: Record<string, string> = {
              "User-Agent": "devteam-taskmanager",
              Accept: "application/vnd.github.v3+json",
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            };
            const ghRes = await fetch(
              `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${prNumber}`,
              {
                headers,
                signal: AbortSignal.timeout(8000)
              }
            );
            if (ghRes.ok) {
              const ghData = (await ghRes.json()) as any;
              remoteMerged = ghData.merged || false;
              remotePrStatus = ghData.state; // 'open' or 'closed'
              if (remoteMerged) {
                remotePrStatus = "merged";
              }
            }
          } else if (provider === "gitlab") {
            const gitlabUrl = process.env.GITLAB_URL || "https://gitlab.com";
            const encodedProjectPath = encodeURIComponent(`${owner}/${name}`);
            const headers: Record<string, string> = token ? { "PRIVATE-TOKEN": token } : {};
            const glRes = await fetch(
              `${gitlabUrl}/api/v4/projects/${encodedProjectPath}/merge_requests/${prNumber}`,
              {
                headers,
                signal: AbortSignal.timeout(8000)
              }
            );
            if (glRes.ok) {
              const glData = (await glRes.json()) as any;
              const glState = glData.state; // 'opened', 'closed', 'merged', 'locked'
              if (glState === "opened") {
                remotePrStatus = "open";
              } else if (glState === "merged") {
                remotePrStatus = "merged";
                remoteMerged = true;
              } else if (glState === "closed") {
                remotePrStatus = "closed";
              }
            }
          }

          if (remotePrStatus !== task.prStatus) {
            let nextTaskStatus = task.status;
            if (remotePrStatus === "merged" && task.status !== "done") {
              nextTaskStatus = "done";
            } else if (
              remotePrStatus === "open" &&
              (task.status === "todo" || task.status === "backlog")
            ) {
              nextTaskStatus = "review";
            }

            await db.run("UPDATE tasks SET prStatus = ?, status = ? WHERE id = ?", [
              remotePrStatus,
              nextTaskStatus,
              task.id
            ]);

            // Add activity under system action
            const activityId = uuidv4();
            await db.run(
              "INSERT INTO task_activities (id, taskId, userId, action, createdAt) VALUES (?, ?, ?, ?, ?)",
              [
                activityId,
                task.id,
                "system",
                `automatically synchronized PR status: updated PR to '${remotePrStatus}' and Board Status to '${nextTaskStatus}'`,
                new Date().toISOString()
              ]
            );

            console.log(
              `[Background Sync] Updated task "${task.title}" to ${nextTaskStatus} (PR ${remotePrStatus})`
            );
          }
        } catch (taskErr: any) {
          console.error(`[Background Sync] Error syncing task ${task.id}:`, taskErr.message);
        }
      }
    }
  } catch (err: any) {
    console.error("[Background Sync] Error running background PR sync:", err.message);
  }
}

export function startBackgroundJobs() {
  const syncInterval = setInterval(runBackgroundPrSync, 5 * 60 * 1000);
  const initialTimeout = setTimeout(runBackgroundPrSync, 5000);

  const purgeInterval = setInterval(async () => {
    try {
      const db = await dbPromise;
      await purgeStaleUnverifiedUsers(db);

      // Retention cleanup: purge notifications older than 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.run("DELETE FROM notifications WHERE createdAt < ?", [thirtyDaysAgo]);

      // Retention cleanup: purge webhook deliveries older than 14 days
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      await db.run("DELETE FROM webhook_deliveries WHERE createdAt < ?", [fourteenDaysAgo]);
    } catch (e: any) {
      console.error("[Background Jobs] Retention cleanup error:", e.message);
    }
  }, 60 * 60 * 1000);

  const noncePurgeInterval = setInterval(async () => {
    try {
      const db = await dbPromise;
      await db.run("DELETE FROM oauth_nonces WHERE timestamp < ?", Date.now() - 20 * 60 * 1000);
    } catch (e) {}
  }, 10 * 60 * 1000);

  return function stopBackgroundJobs() {
    clearInterval(syncInterval);
    clearTimeout(initialTimeout);
    clearInterval(purgeInterval);
    clearInterval(noncePurgeInterval);
  };
}

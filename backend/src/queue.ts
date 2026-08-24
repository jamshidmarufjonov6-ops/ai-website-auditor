import { config } from "./config.js";
import { getDb } from "./db.js";

const MAX_CONCURRENT = Math.max(1, config.maxConcurrentAudits);
const MAX_QUEUE = MAX_CONCURRENT + 4;

let active = 0;
const pending: string[] = [];
let running = false;

function pump(): void {
  if (running) return;
  running = true;
  void (async () => {
    while (pending.length > 0 && active < MAX_CONCURRENT) {
      const auditId = pending.shift();
      if (!auditId) continue;
      active += 1;
      void runOne(auditId).finally(() => {
        active -= 1;
        pump();
      });
    }
    running = false;
  })();
}

async function runOne(auditId: string): Promise<void> {
  try {
    const { runAudit } = await import("./services/auditRunner.js");
    await runAudit(auditId);
  } catch (err) {
    console.error("Unhandled error in audit worker for audit", auditId, err);
    try {
      await getDb()
        .collection("audits")
        .updateOne(
          { _id: new (await import("mongodb")).ObjectId(auditId) },
          {
            $set: {
              status: "failed",
              errorCode: "internal_error",
              errorMessage: "Something went wrong during the audit. Please try again.",
              completedAt: new Date(),
            },
          }
        );
    } catch (innerErr) {
      console.error("Could not mark audit as failed", auditId, innerErr);
    }
  }
}

export function enqueueAudit(auditId: string): boolean {
  if (pending.length + active >= MAX_QUEUE) return false;
  pending.push(auditId);
  pump();
  return true;
}

export function queueDepth(): number {
  return pending.length + active;
}

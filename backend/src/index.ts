import { app } from "./app.js";
import { config } from "./config.js";
import { connectDb, ensureIndexes } from "./db.js";

async function main(): Promise<void> {
  await connectDb();
  await ensureIndexes();
  app.listen(config.port, () => {
    console.log(`AI Website Auditor API listening on http://localhost:${config.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start backend:", err);
  process.exit(1);
});

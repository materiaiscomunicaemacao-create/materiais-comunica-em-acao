import { migrate } from "../server/migrations.js";
import { closePool } from "../server/db.js";

try {
  const result = await migrate();
  process.stdout.write(`migration ${result.applied ? "applied" : "already-complete"} v${result.version}\n`);
} catch (error) {
  process.stderr.write(`migration failed: ${error?.code || "unknown"}\n`);
  process.exitCode = 1;
} finally {
  await closePool();
}

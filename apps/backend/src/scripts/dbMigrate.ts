import { runDbMigrations } from "../db/migrations.js";
import { logger } from "../utils/logger.js";

runDbMigrations()
  .then(() => {
    logger.info("[db:migrate] complete");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("[db:migrate] failed", { error });
    process.exit(1);
  });

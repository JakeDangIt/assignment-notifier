/**
 * Applies pending SQL migrations from ./drizzle.
 *
 * Usage: npm run db:migrate
 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { connect } from "./db-connect";

async function main() {
  const { db, pool } = connect();

  try {
    await migrate(db, { migrationsFolder: "./drizzle" });
    console.log("migrations applied");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

// Switches the Prisma schema from SQLite (local development) to PostgreSQL.
// Run during the Docker build, before `prisma generate`.
import { readFileSync, writeFileSync } from "node:fs";

const path = new URL("../prisma/schema.prisma", import.meta.url);
const schema = readFileSync(path, "utf8");
const updated = schema.replace(/provider\s*=\s*"sqlite"/, 'provider = "postgresql"');
if (updated === schema && !schema.includes('provider = "postgresql"')) {
  console.error("Could not find the sqlite provider in prisma/schema.prisma");
  process.exit(1);
}
writeFileSync(path, updated);
console.log("Prisma schema now targets PostgreSQL.");

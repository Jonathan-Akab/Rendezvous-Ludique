// Case-insensitive "contains" that works on both databases: SQLite's LIKE is already
// case-insensitive, PostgreSQL needs mode: "insensitive" (which SQLite rejects).
const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");

export function ilike(value: string) {
  return (isPostgres ? { contains: value, mode: "insensitive" } : { contains: value }) as { contains: string };
}

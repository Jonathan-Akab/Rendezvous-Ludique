import "server-only";
import { db } from "@/lib/db";
import { FOLD, foldText } from "@/lib/fold";

// Accent-insensitive, case-insensitive search that works on SQLite (local) and PostgreSQL (production):
// "montreal", "Montréal" and "MONTRÉAL" all find each other, and so for every other accent.
//
// Neither database can do that with a plain "contains", so the column is folded inside the query
// (accented letters replaced by plain ones, then lower-cased) and compared with the folded search text.
// `matchIds` returns the ids of the matching rows; callers filter with `{ id: { in: ids } }`.

const isPostgres = (process.env.DATABASE_URL ?? "").startsWith("postgres");

/** SQL for the same folding applied to a column. */
function foldSql(column: string) {
  return `lower(${FOLD.reduce((expr, [c, p]) => `REPLACE(${expr},'${c}','${p}')`, column)})`;
}
const FOLD_SQL_CACHE = new Map<string, string>();
const foldedColumn = (column: string) => {
  let sql = FOLD_SQL_CACHE.get(column);
  if (!sql) FOLD_SQL_CACHE.set(column, (sql = foldSql(column)));
  return sql;
};

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Ids of the rows of `table` where any of `columns` contains `query` (ignoring case and accents).
 * `scope` limits the search to rows with that column value (e.g. one Kallax's games).
 * Table and column names are constants of the code, never user input.
 */
export async function matchIds(table: string, columns: string[], query: string, scope?: { column: string; value: string }): Promise<string[]> {
  const needle = foldText(query).trim();
  if (!needle) return [];
  if (![table, ...columns, scope?.column ?? "x"].every((n) => IDENT.test(n))) throw new Error("Invalid identifier");

  const like = `%${needle.replace(/[\\%_]/g, "\\$&")}%`;
  const params: string[] = [];
  const ph = (value: string) => {
    if (isPostgres) {
      const i = params.indexOf(value) + 1 || params.push(value);
      return `$${i}`;
    }
    params.push(value);
    return "?";
  };
  const conditions = columns.map((c) => `${foldedColumn(`"${c}"`)} LIKE ${ph(like)} ESCAPE '\\'`).join(" OR ");
  const where = scope ? `(${conditions}) AND "${scope.column}" = ${ph(scope.value)}` : conditions;
  const rows = await db.$queryRawUnsafe<{ id: string }[]>(`SELECT "id" FROM "${table}" WHERE ${where} LIMIT 2000`, ...params);
  return rows.map((r) => r.id);
}

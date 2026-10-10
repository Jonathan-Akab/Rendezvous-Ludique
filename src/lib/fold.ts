// Folding text for searches: lower-case and without accents, so "Montréal", "montreal" and "MONTRÉAL"
// are the same word. Used by the browser (pickers filtering a list) and by lib/search.ts (database queries).

/** Accented letters (Latin-1 and Latin Extended-A) → their plain letter(s), lower-case and upper-case forms. */
export const FOLD: [string, string][] = (() => {
  const pairs: [string, string][] = [];
  const special: Record<string, string> = { ø: "o", đ: "d", ł: "l", ħ: "h", ı: "i", ŧ: "t", œ: "oe", æ: "ae", ß: "ss", ð: "d", þ: "th" };
  for (let cp = 0xc0; cp <= 0x17f; cp++) {
    const ch = String.fromCharCode(cp);
    if (ch === "×" || ch === "÷") continue;
    const lower = ch.toLowerCase();
    const plain = special[lower] ?? lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
    if (plain !== lower && /^[a-z]+$/.test(plain)) pairs.push([ch, plain]);
  }
  return pairs;
})();
const FOLD_LOWER = new Map(FOLD.map(([c, p]) => [c.toLowerCase(), p]));

/** The text as searches compare it: lower-case, no accents. */
export function foldText(text: string) {
  return [...text.toLowerCase()].map((c) => FOLD_LOWER.get(c) ?? c).join("");
}

// Free, local text similarity for short French/English sentences (suggestion titles,
// rules questions). Words are normalised (case, accents, plurals), filler words are
// dropped, and typos are tolerated, so "Ajouter un mode sombre" ≈ "mode sombre svp".

const STOPWORDS = new Set(
  (
    // French
    "a au aux avec ce ces cet cette c ca d de des du dans en et est etre il ils elle elles j je l la le les leur lui " +
    "m ma mais me mes moi mon n ne nos notre nous on ou par pas pour qu que qui s sa se ses si son sur t ta te tes toi " +
    "ton tu un une vos votre vous y faire fait peut peux pouvoir avoir ai as plus tres bien aussi svp stp merci " +
    "ajouter ajout rajouter mettre serait possible option aimerais voudrais veux veut genre " +
    // English
    "an and are as at be by can could do does for from has have how i if in into is it its me my of on or our please " +
    "should so than that the their them then there this to us was we were will with would you your add like want maybe"
  ).split(" "),
);

export function normalizeText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Words that mean the same thing in a rules question, and spelled-out numbers as digits
// ("deux joueurs" = "2 joueurs", "combien d'ouvriers" = "nombre d'ouvriers").
const NUMBERS: Record<string, string> = {
  deux: "2", trois: "3", quatre: "4", cinq: "5", six: "6", sept: "7", huit: "8", neuf: "9", dix: "10",
  two: "2", three: "3", four: "4", five: "5", seven: "7", eight: "8", nine: "9", ten: "10",
  combien: "nombre", nb: "nombre", many: "nombre", number: "nombre",
  depart: "debut", commencement: "debut", start: "debut", beginning: "debut",
};
// Filler in rules questions: every question is about "the game", "each player's turn"…
const FILLER = new Set("partie parties jeu jeux chaque game each".split(" "));

/** Meaningful words of a sentence, with plurals trimmed. `ignore`: extra words to skip (e.g. the game's name). */
export function keywords(text: string, ignore?: Set<string>) {
  const out: string[] = [];
  for (let w of normalizeText(text).split(" ")) {
    w = NUMBERS[w] ?? w;
    if (w.length > 3 && (w.endsWith("s") || w.endsWith("x"))) w = w.slice(0, -1);
    if (!w || STOPWORDS.has(w) || FILLER.has(w) || ignore?.has(w) || (w.length < 2 && !/\d/.test(w))) continue;
    if (!out.includes(w)) out.push(w);
  }
  return out;
}

function levenshteinRatio(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length);
}

/** Same word, same stem ("exporter" / "export") or a typo of it ("sugestion"). */
function sameWord(a: string, b: string) {
  if (a === b) return true;
  if (a.length >= 5 && b.length >= 5 && a.slice(0, 6) === b.slice(0, 6)) return true;
  return a.length >= 5 && b.length >= 5 && levenshteinRatio(a, b) >= 0.8;
}

/** 0 = nothing in common, 1 = same meaningful words (soft Dice coefficient). */
export function textSimilarity(a: string | string[], b: string | string[]) {
  const A = Array.isArray(a) ? a : keywords(a);
  const B = Array.isArray(b) ? b : keywords(b);
  if (!A.length || !B.length) return 0;
  const used = new Set<number>();
  let matches = 0;
  for (const w of A) {
    const j = B.findIndex((x, i) => !used.has(i) && sameWord(w, x));
    if (j >= 0) {
      used.add(j);
      matches++;
    }
  }
  return (2 * matches) / (A.length + B.length);
}

/** Items ranked by similarity to `query`, best first, above `min`. */
export function rankBySimilarity<T>(query: string, items: T[], text: (item: T) => string, min = 0) {
  const q = keywords(query);
  return items
    .map((item) => ({ item, score: textSimilarity(q, text(item)) }))
    .filter((x) => x.score >= min && x.score > 0)
    .sort((x, y) => y.score - x.score);
}

/** Share of the query's words found in `text` (0..1) — for searching longer texts. */
export function coverage(query: string | string[], text: string) {
  const Q = Array.isArray(query) ? query : keywords(query);
  if (!Q.length) return 0;
  const T = keywords(text);
  return Q.filter((w) => T.some((x) => sameWord(w, x))).length / Q.length;
}

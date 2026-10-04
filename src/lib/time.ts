// Date helpers that work in the site's time zone (set by admins), so a server running
// in UTC still reads and shows "Friday 19:00" the way members typed it.

function parts(date: Date, timeZone: string) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => p.find((x) => x.type === type)?.value ?? "00";
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour"), min: get("minute"), s: get("second") };
}

function offsetMs(date: Date, timeZone: string) {
  const x = parts(date, timeZone);
  return Date.UTC(+x.y, +x.m - 1, +x.d, +x.h, +x.min, +x.s) - date.getTime();
}

/** "2026-10-03T19:30" (wall time in `timeZone`) → Date, or null if malformed. */
export function fromLocalInput(value: string, timeZone: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return new Date(guess - offsetMs(new Date(guess), timeZone));
}

/** Date → "2026-10-03T19:30" in `timeZone`, for <input type="datetime-local">. */
export function toLocalInput(date: Date, timeZone: string) {
  const x = parts(date, timeZone);
  return `${x.y}-${x.m}-${x.d}T${x.h}:${x.min}`;
}

/** Date → "2026-10-03" in `timeZone`, for <input type="date">. */
export function toDateInput(date: Date, timeZone: string) {
  return toLocalInput(date, timeZone).slice(0, 10);
}

/**
 * Business days are calendar days in the bakery's operating timezone.
 * Keep this explicit instead of relying on the machine/browser timezone.
 */
export const BUSINESS_TIMEZONE = "Africa/Lagos";

function partsInBusinessTimezone(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
}

/** Return the business date for an instant as YYYY-MM-DD. */
export function businessDateFor(date = new Date()): string {
  const parts = partsInBusinessTimezone(date);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/** Convert a YYYY-MM-DD business date into its exact UTC day boundaries. */
export function businessDateRange(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid business date: ${date}`);
  const [year, month, day] = date.split("-").map(Number);
  const utcGuess = Date.UTC(year, month - 1, day);
  const wall = partsInBusinessTimezone(new Date(utcGuess));
  const offset = utcGuess - Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  const start = new Date(utcGuess - offset);
  const next = new Date(Date.UTC(year, month - 1, day + 1) - offset);
  return { start, end: new Date(next.getTime() - 1) };
}

/** Treat date-only query values as business dates; preserve timestamp queries. */
export function queryDateRange(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? businessDateRange(value)
    : { start: new Date(value), end: new Date(value) };
}
export const BUSINESS_TIMEZONE = "Africa/Lagos";

export function businessDateFor(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function businessDateTimeRange(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  // The API remains authoritative for filtering; this range is used for
  // displaying and labeling the selected business date in the browser.
  return {
    start: `${date}T00:00:00+01:00`,
    end: `${year}-${String(month).padStart(2, "0")}-${String(day + 1).padStart(2, "0")}T00:00:00+01:00`,
  };
}

function dateTimeParts(value: string | Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: BUSINESS_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  return Object.fromEntries(
    parts.filter(part => part.type !== "literal").map(part => [part.type, part.value]),
  );
}

/** Display an instant using the bakery's operating timezone, never the browser timezone. */
export function formatBusinessDateTime(value: string | Date) {
  const parts = dateTimeParts(value);
  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

/** Display an instant as a short business-time value for dashboards and exports. */
export function formatBusinessTime(value: string | Date) {
  const parts = dateTimeParts(value);
  return `${parts.hour}:${parts.minute}`;
}

/** Anchor a date-only production entry safely inside that Lagos business day. */
export function businessDateTimestamp(date: string) {
  return `${date}T12:00:00+01:00`;
}
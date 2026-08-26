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
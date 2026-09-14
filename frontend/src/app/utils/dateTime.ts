/** Combine a YYYY-MM-DD date with the current local clock time, as ISO UTC. */
export function dateWithSystemTime(dateOnly: string): string {
  const now = new Date();
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) {
    return now.toISOString();
  }
  const local = new Date(
    year,
    month - 1,
    day,
    now.getHours(),
    now.getMinutes(),
    now.getSeconds(),
    now.getMilliseconds(),
  );
  return local.toISOString();
}

/** e.g. "14 September 2026, 05:30 AM" in the user's local timezone */
export function formatTransactionDateTime(dateString: string): string {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  const datePart = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const hours24 = date.getHours();
  const minutes = date.getMinutes();
  const hour12 = hours24 % 12 || 12;
  const ampm = hours24 >= 12 ? "AM" : "PM";
  const hh = String(hour12).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");

  return `${datePart}, ${hh}:${mm} ${ampm}`;
}

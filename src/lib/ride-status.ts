/**
 * Compute the dynamic ride status based on start/end dates.
 *
 * Rules:
 * - If the DB status is "cancelled", always return "cancelled" (admin override).
 * - If the current date is before the start date → "upcoming"
 * - If the current date is on or after the start date but before or on the end date → "ongoing"
 * - If the current date is after the end date → "completed"
 */
export function computeRideStatus(
  startDate: Date | string,
  endDate: Date | string,
  dbStatus: string
): "upcoming" | "ongoing" | "completed" | "cancelled" {
  // Cancelled is an admin override — never auto-change it
  if (dbStatus === "cancelled") return "cancelled";

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);

  // Compare using the start of the day for start date, and end of day for end date
  // so that the ride is "ongoing" for the entire start day and "completed" only after the end day
  const startOfStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOfEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

  if (now < startOfStartDay) return "upcoming";
  if (now <= endOfEndDay) return "ongoing";
  return "completed";
}

/**
 * Compute the dynamic ride status based on start/end dates.
 *
 * Rules:
 * - If the DB status is "cancelled", "ongoing", or "completed", return it as-is
 *   (admin override — trust explicit DB values).
 * - If the DB status is "upcoming" (the default state), derive from dates:
 *   - Current date before the start date → "upcoming"
 *   - Current date on/after start date and on/before end date → "ongoing"
 *   - Current date after end date → "completed"
 */
export function computeRideStatus(
  startDate: Date | string,
  endDate: Date | string,
  dbStatus: string
): "upcoming" | "ongoing" | "completed" | "cancelled" {
  // Admin overrides — trust explicit DB values
  if (dbStatus === "cancelled") return "cancelled";
  if (dbStatus === "ongoing") return "ongoing";
  if (dbStatus === "completed") return "completed";

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

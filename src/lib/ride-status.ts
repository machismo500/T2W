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
  if (dbStatus === "completed") return "completed";

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const startOfStartDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endOfEndDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59, 59, 999);

  // Admin "ongoing" override: trust it, unless the ride has been past its end
  // date for > 48h — that usually means an admin forgot to close it out, so
  // fall through to date-based completion rather than holding registration
  // permanently closed.
  if (dbStatus === "ongoing") {
    const staleThreshold = new Date(endOfEndDay.getTime() + 48 * 60 * 60 * 1000);
    if (now > staleThreshold) return "completed";
    return "ongoing";
  }

  if (now < startOfStartDay) return "upcoming";
  if (now <= endOfEndDay) return "ongoing";
  return "completed";
}

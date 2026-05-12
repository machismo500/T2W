/**
 * Batched client-side road-snapping for planned ride routes.
 *
 * Takes user-placed waypoints (which Google Maps draws as straight lines)
 * and returns a dense polyline that follows actual driving roads, together
 * with an accurate kilometer count summed from the per-leg distances.
 *
 * Why batched: Directions API permits at most 25 waypoints per call (origin +
 * destination + 23 intermediate). For a 181-point Ladakh ride we break it
 * into 8 batches and stitch the resulting paths, discarding the duplicate
 * point at each join.
 *
 * Why client-side: we already authenticate the Maps JS API with the existing
 * `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, so no new server key is needed.
 * Directions API must be enabled on that key in Google Cloud Console.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SnapResult {
  path: LatLng[];
  distanceKm: number;
  batches: number;
}

// Directions API limit: origin + destination + 23 intermediate waypoints.
const MAX_WAYPOINTS_PER_REQUEST = 25;

// Minimal subset of the DirectionsService surface we use. Lets us unit-test
// without booting Google Maps JS.
export interface DirectionsServiceLike {
  route(request: {
    origin: LatLng;
    destination: LatLng;
    waypoints?: { location: LatLng; stopover: boolean }[];
    travelMode: "DRIVING";
  }): Promise<{
    routes: {
      legs: { distance: { value: number }; steps: { path: LatLng[] }[] }[];
      overview_path: LatLng[];
    }[];
  }>;
}

export async function snapWaypointsToRoads(
  waypoints: LatLng[],
  directionsService: DirectionsServiceLike
): Promise<SnapResult> {
  if (waypoints.length < 2) {
    throw new Error("Need at least 2 waypoints to snap to roads");
  }

  const batches: LatLng[][] = [];
  // Slide a window of MAX_WAYPOINTS along the array, overlapping by 1 so the
  // end of one batch is the start of the next — that point is then dropped
  // from the joined path so we don't double-count it.
  let cursor = 0;
  while (cursor < waypoints.length - 1) {
    const end = Math.min(cursor + MAX_WAYPOINTS_PER_REQUEST, waypoints.length);
    batches.push(waypoints.slice(cursor, end));
    if (end === waypoints.length) break;
    cursor = end - 1; // re-use last point as origin of next batch
  }

  const fullPath: LatLng[] = [];
  let totalMeters = 0;

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    const origin = batch[0];
    const destination = batch[batch.length - 1];
    const intermediate = batch.slice(1, -1).map((p) => ({
      location: p,
      stopover: false,
    }));

    const result = await directionsService.route({
      origin,
      destination,
      waypoints: intermediate,
      travelMode: "DRIVING",
    });

    if (!result.routes || result.routes.length === 0) {
      throw new Error(
        `Directions API returned no route for batch ${i + 1}/${batches.length}`
      );
    }

    const route = result.routes[0];
    for (const leg of route.legs) {
      totalMeters += leg.distance.value;
    }

    const path = route.overview_path;
    if (i === 0) {
      fullPath.push(...path);
    } else {
      // Drop the first point of subsequent batches to avoid duplicating the
      // join point. If overview_path is empty for some reason, skip.
      fullPath.push(...path.slice(1));
    }
  }

  return {
    path: fullPath,
    distanceKm: Math.round((totalMeters / 1000) * 10) / 10, // 0.1 km precision
    batches: batches.length,
  };
}

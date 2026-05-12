/**
 * Server-side Google Maps integrations used by the post-ride "Smooth & fill
 * gaps" pipeline.
 *
 *  - `snapToRoads(points)` calls the Roads API to align jittery GPS fixes
 *    to actual road segments. The Roads API limit is 100 points per request,
 *    so we batch internally. `interpolate=true` densifies along the road
 *    between snapped points so the resulting polyline looks smooth.
 *
 *  - `getRoadDirections(origin, destination)` calls the Directions API and
 *    returns the decoded driving polyline — used to fill the road segment
 *    across a GPS-loss gap.
 *
 * Both use `GOOGLE_MAPS_SERVER_API_KEY` (the same key already used by the
 * Elevation API). Roads + Directions APIs must be enabled on that key.
 */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface SnappedPoint {
  lat: number;
  lng: number;
  // Index into the original input array. Snapped points returned with
  // `interpolate=true` may have no originalIndex (Roads API omits the field
  // for points it added between user-supplied points), in which case this is
  // undefined and the caller treats the row as synthetic.
  originalIndex?: number;
  placeId?: string;
}

const ROADS_ENDPOINT = "https://roads.googleapis.com/v1/snapToRoads";
const DIRECTIONS_ENDPOINT = "https://maps.googleapis.com/maps/api/directions/json";
const ROADS_MAX_POINTS_PER_REQUEST = 100;

function getKey(): string {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) {
    throw new Error(
      "GOOGLE_MAPS_SERVER_API_KEY is not set. Enable the key and add Roads + Directions APIs."
    );
  }
  return key;
}

export async function snapToRoads(points: LatLng[]): Promise<SnappedPoint[]> {
  if (points.length === 0) return [];
  const key = getKey();
  const out: SnappedPoint[] = [];

  // Walk the input in 100-point chunks. Overlap the chunks by one point so
  // the Roads API has enough context to keep the polyline continuous; drop
  // the duplicate when stitching.
  let cursor = 0;
  let outputOffsetForBatch = 0;
  while (cursor < points.length) {
    const end = Math.min(cursor + ROADS_MAX_POINTS_PER_REQUEST, points.length);
    const slice = points.slice(cursor, end);
    const path = slice.map((p) => `${p.lat},${p.lng}`).join("|");
    const url = new URL(ROADS_ENDPOINT);
    url.searchParams.set("path", path);
    url.searchParams.set("interpolate", "true");
    url.searchParams.set("key", key);

    const res = await fetch(url.toString());
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(
        `Roads API failed (${res.status}) for batch starting at ${cursor}: ${txt.slice(0, 200)}`
      );
    }
    const json = (await res.json()) as {
      snappedPoints?: {
        location: { latitude: number; longitude: number };
        originalIndex?: number;
        placeId?: string;
      }[];
      warningMessage?: string;
    };
    const snapped = json.snappedPoints ?? [];
    for (let i = 0; i < snapped.length; i++) {
      const s = snapped[i];
      // The first snapped point of a non-first batch duplicates the last
      // point of the previous batch — drop it to keep the joined series
      // monotonic.
      if (cursor > 0 && i === 0 && s.originalIndex === 0) continue;
      out.push({
        lat: s.location.latitude,
        lng: s.location.longitude,
        // Translate the per-batch originalIndex back into the global array.
        originalIndex:
          s.originalIndex !== undefined
            ? cursor + s.originalIndex
            : undefined,
        placeId: s.placeId,
      });
    }

    if (end === points.length) break;
    cursor = end - 1; // overlap so the next batch starts on the last sent point
    outputOffsetForBatch = out.length;
  }
  void outputOffsetForBatch; // kept for clarity; not used elsewhere
  return out;
}

export async function getRoadDirections(
  origin: LatLng,
  destination: LatLng
): Promise<LatLng[]> {
  const key = getKey();
  const url = new URL(DIRECTIONS_ENDPOINT);
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString());
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(
      `Directions API failed (${res.status}): ${txt.slice(0, 200)}`
    );
  }
  const json = (await res.json()) as {
    status: string;
    routes?: { overview_polyline?: { points?: string } }[];
  };
  if (json.status !== "OK") {
    throw new Error(`Directions API status: ${json.status}`);
  }
  const encoded = json.routes?.[0]?.overview_polyline?.points;
  if (!encoded) return [];
  return decodePolyline(encoded);
}

// Reference implementation of Google's encoded-polyline format. ~30 lines,
// no dependency. Used so we can decode the overview_polyline string from
// Directions without pulling in `@googlemaps/polyline-codec`.
//
// Algorithm: each lat/lng delta is encoded as a signed 5-bit-chunk varint
// with a fixed 1e-5 scale. The decoder walks the string two values at a
// time, accumulating latitudes and longitudes from the running deltas.
export function decodePolyline(encoded: string): LatLng[] {
  const out: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dLng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    out.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return out;
}

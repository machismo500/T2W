// Minimal GPX 1.1 serialiser + parser. Hand-rolled — no dependency.
// Scope is intentionally small: we only need lat/lng/time/optional elevation
// for ride routes. If we ever need extensions (HR/cadence/power), swap in
// a real lib behind these same function signatures.

export interface GpxPoint {
  lat: number;
  lng: number;
  ele?: number;
  time?: string; // ISO-8601
}

export interface ParsedGpx {
  name?: string;
  points: GpxPoint[];
}

// Reject anything larger than this when parsing — keeps a malformed file from
// pinning a request. Real-world ride GPX files are well under 5 MB.
export const MAX_GPX_BYTES = 5 * 1024 * 1024;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function serializeGpx(input: {
  name?: string;
  trackName?: string;
  points: GpxPoint[];
}): string {
  const name = input.name ? escapeXml(input.name) : "T2W Ride";
  const trackName = escapeXml(input.trackName ?? name);
  const lines: string[] = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="Tales on 2 Wheels" xmlns="http://www.topografix.com/GPX/1/1">',
    `  <metadata><name>${name}</name><time>${new Date().toISOString()}</time></metadata>`,
    "  <trk>",
    `    <name>${trackName}</name>`,
    "    <trkseg>",
  ];
  for (const p of input.points) {
    const lat = p.lat.toFixed(6);
    const lng = p.lng.toFixed(6);
    const parts: string[] = [`      <trkpt lat="${lat}" lon="${lng}">`];
    if (typeof p.ele === "number" && Number.isFinite(p.ele)) {
      parts.push(`        <ele>${p.ele.toFixed(1)}</ele>`);
    }
    if (p.time) {
      parts.push(`        <time>${escapeXml(p.time)}</time>`);
    }
    parts.push("      </trkpt>");
    lines.push(parts.join("\n"));
  }
  lines.push("    </trkseg>", "  </trk>", "</gpx>");
  return lines.join("\n");
}

// Lightweight extractor. Reads <trkpt> and <rtept> nodes. Tolerates whitespace
// and mixed casing on attribute names but not arbitrary XML namespacing — fine
// for the GPX dialects exported by Strava / Garmin / RideWithGPS.
export function parseGpx(input: string | Buffer | ArrayBuffer): ParsedGpx {
  const text =
    typeof input === "string"
      ? input
      : input instanceof ArrayBuffer
        ? new TextDecoder("utf-8").decode(input)
        : input.toString("utf-8");

  if (text.length > MAX_GPX_BYTES) {
    throw new Error("GPX file is too large (max 5 MB)");
  }
  if (!/<gpx[\s>]/i.test(text)) {
    throw new Error("Not a valid GPX document");
  }

  const nameMatch = text.match(/<name>([^<]*)<\/name>/i);
  const name = nameMatch ? decodeEntities(nameMatch[1].trim()) : undefined;

  const points: GpxPoint[] = [];
  const trkptRe =
    /<(?:trkpt|rtept|wpt)\b([^>]*)>([\s\S]*?)<\/(?:trkpt|rtept|wpt)>/gi;
  let match: RegExpExecArray | null;
  while ((match = trkptRe.exec(text)) !== null) {
    const attrs = match[1];
    const inner = match[2];
    const lat = readAttr(attrs, "lat");
    const lon = readAttr(attrs, "lon");
    if (lat === null || lon === null) continue;
    if (!isValidLat(lat) || !isValidLng(lon)) continue;
    const eleMatch = inner.match(/<ele>([^<]+)<\/ele>/i);
    const timeMatch = inner.match(/<time>([^<]+)<\/time>/i);
    const ele = eleMatch ? Number.parseFloat(eleMatch[1]) : undefined;
    const time = timeMatch ? timeMatch[1].trim() : undefined;
    points.push({
      lat,
      lng: lon,
      ...(typeof ele === "number" && Number.isFinite(ele) ? { ele } : {}),
      ...(time ? { time } : {}),
    });
  }

  // Self-closing variant: <trkpt lat="..." lon="..." />
  const selfCloseRe = /<(?:trkpt|rtept|wpt)\b([^>]*)\/>/gi;
  while ((match = selfCloseRe.exec(text)) !== null) {
    const attrs = match[1];
    const lat = readAttr(attrs, "lat");
    const lon = readAttr(attrs, "lon");
    if (lat === null || lon === null) continue;
    if (!isValidLat(lat) || !isValidLng(lon)) continue;
    points.push({ lat, lng: lon });
  }

  return { name, points };
}

function readAttr(attrs: string, key: string): number | null {
  const re = new RegExp(`\\b${key}\\s*=\\s*"([^"]+)"`, "i");
  const m = attrs.match(re);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

function isValidLat(n: number): boolean {
  return n >= -90 && n <= 90;
}

function isValidLng(n: number): boolean {
  return n >= -180 && n <= 180;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// Haversine distance in km, for summarising uploaded GPX.
export function gpxDistanceKm(points: GpxPoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1], points[i]);
  }
  return total;
}

function haversineKm(a: GpxPoint, b: GpxPoint): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

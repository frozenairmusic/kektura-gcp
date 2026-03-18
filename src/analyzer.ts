import * as cheerio from 'cheerio';
import type { ISection } from './types';

// ─── Internal types ───────────────────────────────────────────────────────────

interface IWaypoint {
  lat: number;
  lon: number;
  ele: number;
  name: string;
}

interface ITrackPoint {
  lat: number;
  lon: number;
  ele: number;
}

// ─── Haversine distance ───────────────────────────────────────────────────────

type CheerioRoot = ReturnType<typeof cheerio.load>;

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/**
 * Calculate the great-circle distance between two points in metres.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── GPX parsing helpers ──────────────────────────────────────────────────────

function parseWaypoints($: CheerioRoot): IWaypoint[] {
  const waypoints: IWaypoint[] = [];

  $('wpt').each((_, el) => {
    const lat = parseFloat($(el).attr('lat') ?? '0');
    const lon = parseFloat($(el).attr('lon') ?? '0');
    const ele = parseFloat($(el).find('ele').first().text() || '0');
    const name = $(el).find('name').first().text().trim();

    if (name) {
      waypoints.push({
        lat,
        lon,
        ele,
        name,
      });
    }
  });

  return waypoints;
}

function parseTrackPoints($: CheerioRoot): ITrackPoint[] {
  const points: ITrackPoint[] = [];

  $('trkpt').each((_, el) => {
    points.push({
      lat: parseFloat($(el).attr('lat') ?? '0'),
      lon: parseFloat($(el).attr('lon') ?? '0'),
      ele: parseFloat($(el).find('ele').first().text() || '0'),
    });
  });

  return points;
}

// ─── Core analysis logic ──────────────────────────────────────────────────────

/**
 * For a group of waypoints (same-name stamps), find the index of the closest
 * track point.  "Closest" = minimum distance to *any* waypoint in the group.
 */
function findClosestTrackIndex(
  group: IWaypoint[],
  trackPoints: ITrackPoint[],
): number {
  let bestIndex = 0;
  let bestDist = Infinity;

  for (let i = 0; i < trackPoints.length; i++) {
    const tp = trackPoints[i];

    for (const wp of group) {
      const d = haversineDistance(tp.lat, tp.lon, wp.lat, wp.lon);

      if (d < bestDist) {
        bestDist = d;
        bestIndex = i;
      }
    }
  }

  return bestIndex;
}

/**
 * Walk the track between two indices and compute cumulative distance,
 * elevation gain and elevation loss.
 */
function computeStats(
  trackPoints: ITrackPoint[],
  fromIndex: number,
  toIndex: number,
): { distance_m: number;
  elevation_gain_m: number;
  elevation_loss_m: number } {
  let distance = 0;
  let gain = 0;
  let loss = 0;
  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);

  for (let i = start; i < end; i++) {
    distance += haversineDistance(
      trackPoints[i].lat, trackPoints[i].lon,
      trackPoints[i + 1].lat, trackPoints[i + 1].lon,
    );
    const eleDiff = trackPoints[i + 1].ele - trackPoints[i].ele;

    if (eleDiff > 0) gain += eleDiff;
    else loss += Math.abs(eleDiff);
  }

  return {
    distance_m: distance,
    elevation_gain_m: gain,
    elevation_loss_m: loss,
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a GPX buffer and return the sections between stamp-point groups.
 *
 * Stamp points (waypoints) sharing the same `<name>` are grouped together.
 * For each group the closest track point is found.  Sections are then computed
 * between consecutive groups in track order.
 */
export function analyzeGpx(gpxData: Buffer): ISection[] {
  const $ = cheerio.load(gpxData.toString('utf8'), {
    xml: true,
  });

  const waypoints = parseWaypoints($);
  const trackPoints = parseTrackPoints($);

  if (waypoints.length === 0 || trackPoints.length === 0) {
    return [];
  }

  // Group waypoints by name
  const groups = new Map<string, IWaypoint[]>();

  for (const wp of waypoints) {
    const existing = groups.get(wp.name);

    if (existing) existing.push(wp);
    else groups.set(wp.name, [wp]);
  }

  // Resolve each group to its closest track point index
  const resolved: { name: string;
    trackIndex: number }[] = [];

  for (const [
    name,
    wps,
  ] of groups) {
    resolved.push({
      name,
      trackIndex: findClosestTrackIndex(wps, trackPoints),
    });
  }

  // Sort by position along the track
  resolved.sort((a, b) => a.trackIndex - b.trackIndex);

  // Pin the first and last groups to exact track endpoints
  resolved[0].trackIndex = 0;
  resolved[resolved.length - 1].trackIndex = trackPoints.length - 1;

  // Compute sections between consecutive boundary points
  const sections: ISection[] = [];

  for (let i = 0; i < resolved.length - 1; i++) {
    const stats = computeStats(
      trackPoints, resolved[i].trackIndex, resolved[i + 1].trackIndex,
    );
    sections.push({
      from: resolved[i].name,
      to: resolved[i + 1].name,
      distance_km: Math.round(stats.distance_m / 10) / 100,
      elevation_gain_m: Math.round(stats.elevation_gain_m),
      elevation_loss_m: Math.round(stats.elevation_loss_m),
    });
  }

  return sections;
}

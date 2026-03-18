// ─── Module mocks ─────────────────────────────────────────────────────────────
jest.mock('@google-cloud/storage');

// ─── Imports ──────────────────────────────────────────────────────────────────
import { analyzeGpx, haversineDistance } from '../src/analyzer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wpt(lat: number, lon: number, ele: number, name: string): string {
  return `<wpt lat="${lat}" lon="${lon}"><ele>${ele}</ele><name>${name}</name></wpt>`;
}

function trkpt(lat: number, lon: number, ele: number): string {
  return `<trkpt lat="${lat}" lon="${lon}"><ele>${ele}</ele></trkpt>`;
}

function makeGpx(waypoints: string, trackpoints: string): Buffer {
  return Buffer.from(
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">' +
    waypoints +
    `<trk><trkseg>${trackpoints}</trkseg></trk>` +
    '</gpx>',
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// haversineDistance
// ═════════════════════════════════════════════════════════════════════════════
describe('haversineDistance', () => {
  test('returns 0 for identical points', () => {
    expect(haversineDistance(47.0, 17.0, 47.0, 17.0)).toBe(0);
  });

  test('returns approximately correct distance for known city pair', () => {
    // Budapest (47.4979, 19.0402) → Vienna (48.2082, 16.3738) ≈ 214 km
    const d = haversineDistance(47.4979, 19.0402, 48.2082, 16.3738);
    expect(d).toBeGreaterThan(210_000);
    expect(d).toBeLessThan(220_000);
  });

  test('is symmetric', () => {
    const ab = haversineDistance(47.0, 17.0, 48.0, 18.0);
    const ba = haversineDistance(48.0, 18.0, 47.0, 17.0);
    expect(ab).toBeCloseTo(ba, 6);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// analyzeGpx
// ═════════════════════════════════════════════════════════════════════════════
describe('analyzeGpx', () => {
  test('returns empty array for GPX with no waypoints', () => {
    const gpx = makeGpx('', trkpt(47, 17, 100));
    expect(analyzeGpx(gpx)).toEqual([]);
  });

  test('returns empty array for GPX with no track points', () => {
    const gpx = makeGpx(wpt(47, 17, 100, 'Start'), '');
    expect(analyzeGpx(gpx)).toEqual([]);
  });

  test('returns empty array for a single waypoint group', () => {
    const gpx = makeGpx(
      wpt(47, 17, 100, 'Only'),
      trkpt(47, 17, 100) + trkpt(47.01, 17.01, 200),
    );
    expect(analyzeGpx(gpx)).toEqual([]);
  });

  test('returns empty array for completely empty GPX', () => {
    const gpx = Buffer.from('<gpx/>');
    expect(analyzeGpx(gpx)).toEqual([]);
  });

  test('computes one section between two waypoint groups', () => {
    const gpx = makeGpx(
      wpt(47.0, 17.0, 100, 'Start') + wpt(47.1, 17.1, 150, 'End'),
      [
        trkpt(47.0, 17.0, 100),
        trkpt(47.05, 17.05, 200),
        trkpt(47.1, 17.1, 150),
      ].join(''),
    );

    const sections = analyzeGpx(gpx);
    expect(sections).toHaveLength(1);
    expect(sections[0].from).toBe('Start');
    expect(sections[0].to).toBe('End');
    expect(sections[0].distance_km).toBeGreaterThan(0);
    expect(sections[0].elevation_gain_m).toBe(100); // 100 → 200
    expect(sections[0].elevation_loss_m).toBe(50);  // 200 → 150
  });

  test('groups waypoints by name and orders sections by track position', () => {
    // Two stamps named "CityA" (first group → pinned to track start),
    // two "CityB" in middle (nearest match), one "CityC" at end (last group → pinned to track end).
    const gpx = makeGpx(
      wpt(47.0, 17.0, 100, 'CityA') +
      wpt(47.001, 17.001, 105, 'CityA') +
      wpt(47.05, 17.05, 200, 'CityB') +
      wpt(47.051, 17.051, 205, 'CityB') +
      wpt(47.1, 17.1, 300, 'CityC'),
      [
        trkpt(47.0, 17.0, 100),
        trkpt(47.025, 17.025, 150),
        trkpt(47.05, 17.05, 200),
        trkpt(47.075, 17.075, 250),
        trkpt(47.1, 17.1, 300),
      ].join(''),
    );

    const sections = analyzeGpx(gpx);
    expect(sections).toHaveLength(2);
    expect(sections[0].from).toBe('CityA');
    expect(sections[0].to).toBe('CityB');
    expect(sections[1].from).toBe('CityB');
    expect(sections[1].to).toBe('CityC');
  });

  test('pins first stamp group to track start and last to track end', () => {
    // Three groups — all waypoints placed at the same lat/lon near the middle
    // of the track.  After nearest-match all three would resolve to index 2.
    // But after sorting, the first and last groups are pinned to track
    // endpoints so sections cover the full track.
    const gpx = makeGpx(
      wpt(47.04, 17.04, 200, 'Near-start') +
      wpt(47.05, 17.05, 200, 'Middle') +
      wpt(47.06, 17.06, 200, 'Near-end'),
      [
        trkpt(47.0, 17.0, 100),
        trkpt(47.025, 17.025, 150),
        trkpt(47.05, 17.05, 200),
        trkpt(47.075, 17.075, 250),
        trkpt(47.1, 17.1, 300),
      ].join(''),
    );

    const sections = analyzeGpx(gpx);
    expect(sections).toHaveLength(2);
    // Near-start resolves nearest to ~index 1-2, but after sorting it's first → pinned to 0
    // so section covers from track start (ele 100) up
    expect(sections[0].from).toBe('Near-start');
    expect(sections[0].elevation_gain_m).toBeGreaterThanOrEqual(100);
    // Near-end resolves nearest to ~index 2-3, but after sorting it's last → pinned to 4
    // so section covers up to track end (ele 300)
    expect(sections[1].to).toBe('Near-end');
    expect(sections[1].elevation_gain_m).toBeGreaterThanOrEqual(50);
  });

  test('computes elevation gain and loss correctly across three groups', () => {
    const gpx = makeGpx(
      wpt(47.0, 17.0, 100, 'Start') +
      wpt(47.05, 17.05, 300, 'Peak') +
      wpt(47.1, 17.1, 200, 'End'),
      [
        trkpt(47.0, 17.0, 100),
        trkpt(47.025, 17.025, 200),
        trkpt(47.05, 17.05, 300),
        trkpt(47.075, 17.075, 250),
        trkpt(47.1, 17.1, 200),
      ].join(''),
    );

    const sections = analyzeGpx(gpx);
    expect(sections).toHaveLength(2);

    // Start → Peak: 100 → 200 → 300 = gain 200, loss 0
    expect(sections[0].elevation_gain_m).toBe(200);
    expect(sections[0].elevation_loss_m).toBe(0);

    // Peak → End: 300 → 250 → 200 = gain 0, loss 100
    expect(sections[1].elevation_gain_m).toBe(0);
    expect(sections[1].elevation_loss_m).toBe(100);
  });

  test('distance_km is rounded to 2 decimal places', () => {
    const gpx = makeGpx(
      wpt(47.0, 17.0, 100, 'A') + wpt(47.01, 17.01, 100, 'B'),
      [
        trkpt(47.0, 17.0, 100),
        trkpt(47.005, 17.005, 100),
        trkpt(47.01, 17.01, 100),
      ].join(''),
    );

    const sections = analyzeGpx(gpx);
    expect(sections).toHaveLength(1);
    const km = sections[0].distance_km;
    expect(km).toBe(Math.round(km * 100) / 100);
  });

  test('elevation values are rounded to integers', () => {
    const gpx = makeGpx(
      wpt(47.0, 17.0, 100, 'A') + wpt(47.01, 17.01, 100, 'B'),
      [
        trkpt(47.0, 17.0, 100.7),
        trkpt(47.01, 17.01, 150.3),
      ].join(''),
    );

    const sections = analyzeGpx(gpx);
    expect(sections).toHaveLength(1);
    expect(Number.isInteger(sections[0].elevation_gain_m)).toBe(true);
    expect(Number.isInteger(sections[0].elevation_loss_m)).toBe(true);
  });

  test('works with real-world GPX namespace', () => {
    const gpx = Buffer.from(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<gpx xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'version="1.1">' +
      '<wpt lat="47.0" lon="17.0"><ele>100</ele><name>A</name></wpt>' +
      '<wpt lat="47.1" lon="17.1"><ele>200</ele><name>B</name></wpt>' +
      '<trk><name>Trail</name><trkseg>' +
      '<trkpt lat="47.0" lon="17.0"><ele>100</ele></trkpt>' +
      '<trkpt lat="47.1" lon="17.1"><ele>200</ele></trkpt>' +
      '</trkseg></trk></gpx>',
    );

    const sections = analyzeGpx(gpx);
    expect(sections).toHaveLength(1);
    expect(sections[0].from).toBe('A');
    expect(sections[0].to).toBe('B');
  });
});

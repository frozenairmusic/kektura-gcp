import { SCRAPE_TARGETS, GPX_FILENAME_REGEX } from '../src/config';

// ═════════════════════════════════════════════════════════════════════════════
// SCRAPE_TARGETS
// ═════════════════════════════════════════════════════════════════════════════
describe('SCRAPE_TARGETS', () => {
  test('covers okt, ak, and rpddk', () => {
    const trails = SCRAPE_TARGETS.map(t => t.trail).sort();
    expect(trails).toEqual([
      'ak',
      'okt',
      'rpddk'
    ]);
  });

  test('each target has a non-empty url', () => {
    for (const target of SCRAPE_TARGETS) {
      expect(target.url).toMatch(/^https?:\/\//);
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// GPX_FILENAME_REGEX
// ═════════════════════════════════════════════════════════════════════════════
describe('GPX_FILENAME_REGEX', () => {
  test('matches valid filenames', () => {
    const valid = [
      'okt_01_20251107.gpx',
      'ak_13_20251107.gpx',
      'rpddk_11_20251008.gpx',
      'okt_27_20250919.gpx',
    ];
    for (const name of valid) {
      expect(new RegExp(GPX_FILENAME_REGEX.source, 'gi').test(name)).toBe(true);
    }
  });

  test('does not match invalid filenames', () => {
    const invalid = [
      'unknown_01_20251107.gpx',
      'okt_1_20251107.gpx',
      'okt_01_2025110.gpx',
      'okt_01_20251107.txt',
      'okt01_20251107.gpx',
    ];
    for (const name of invalid) {
      expect(new RegExp(GPX_FILENAME_REGEX.source, 'gi').test(name)).toBe(false);
    }
  });
});

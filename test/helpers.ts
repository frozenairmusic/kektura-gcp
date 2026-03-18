import * as os   from 'os';
import * as fs   from 'fs';
import * as path from 'path';

// ─── HTML builders ────────────────────────────────────────────────────────────

export function htmlWithLinks(...hrefs: string[]): string {
  const tags = hrefs.map(h => `<a href="${h}">link</a>`).join('\n');

  return `<html><body>${tags}</body></html>`;
}

export function htmlWithPlainText(text: string): string {
  return `<html><body><p>${text}</p></body></html>`;
}

interface SegmentPageOptions {
  code: string;
  title: string;
  distance?: string;
  elevation?: string;
  walkingTime?: string;
  stampCount?: string;
  gpxLinks?: string[];
}

/** Build an HTML page mimicking a kektura.hu segment subpage. */
export function htmlWithSegmentPage(opts: SegmentPageOptions): string {
  const links = (opts.gpxLinks ?? []).map(h => `<a href="${h}">link</a>`).join('\n');

  return `<html><body>
    <h1>${opts.code}</h1>
    <div class="szakasz-title">${opts.title}</div>
    <div class="item"><div class="name">táv</div><div class="value">${opts.distance ?? ''}</div></div>
    <div class="item"><div class="name">szint + / -</div><div class="value">${opts.elevation ?? ''}</div></div>
    <div class="item"><div class="name">menetidő</div><div class="value">${opts.walkingTime ?? ''}</div></div>
    <div class="item"><div class="name">bélyegzőhelyek</div><div class="value">${opts.stampCount ?? ''}</div></div>
    ${links}
  </body></html>`;
}

// ─── Temp directory ───────────────────────────────────────────────────────────

/** Create a real temp directory; caller must clean up. */
export function makeTempDir(): string {
  return fs.mkdtempSync(path.join(
    os.tmpdir(), 'kektura-test-',
  ));
}

// ─── HTTP response mock ───────────────────────────────────────────────────────

export interface MockResponse {
  _status: number;
  _body: unknown;
  status: jest.MockedFunction<(code: number) => MockResponse>;
  json: jest.MockedFunction<(body: unknown) => MockResponse>;
}

export function mockReq(): Record<string, never> {
  return {};
}

export function mockRes(): MockResponse {
  const res = {
    _status: 200,
    _body: null,
  } as MockResponse;
  res.status = jest.fn().mockImplementation((code: number) => {
    res._status = code;

    return res;
  });
  res.json   = jest.fn().mockImplementation((body: unknown) => {
    res._body  = body;

    return res;
  });

  return res;
}

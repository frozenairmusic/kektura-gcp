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

// ─── Temp directory ───────────────────────────────────────────────────────────

/** Create a real temp directory; caller must clean up. */
export function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'kektura-test-'));
}

// ─── HTTP response mock ───────────────────────────────────────────────────────

export interface MockResponse {
  _status: number;
  _body:   unknown;
  status:  jest.MockedFunction<(code: number) => MockResponse>;
  json:    jest.MockedFunction<(body: unknown) => MockResponse>;
}

export function mockReq(): Record<string, never> {
  return {};
}

export function mockRes(): MockResponse {
  const res = {
    _status: 200,
    _body: null 
  } as MockResponse;
  res.status = jest.fn().mockImplementation((code: number) => { res._status = code;

    return res; });
  res.json   = jest.fn().mockImplementation((body: unknown) => { res._body  = body;

    return res; });

  return res;
}

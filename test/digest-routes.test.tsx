import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { RigConfig } from '../src/config.js';

const line = (at: string, job: string, status: string, owner: string | null = 'rook') =>
  JSON.stringify({ at, job, status, owner });

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  const nights: Record<string, string> = {
    '2026-01-01': [
      line('2026-01-01T23:00:00+01:00', 'zeta/job', 'ok'),
      line('2026-01-01T23:05:00+01:00', 'alpha/job', 'retry'),
      line('2026-01-01T23:10:00+01:00', 'alpha/job', 'ok'),
      line('2026-01-01T23:15:00+01:00', 'mid/job', 'ok'),
    ].join('\n') + '\n',
    '2026-01-02': '',
    '2026-01-03': [line('2026-01-03T23:00:00+01:00', 'a/job', 'ok'), '{not json', line('2026-01-03T23:01:00+01:00', 'b/job', 'ok')].join('\n') + '\n',
  };
  for (const [night, text] of Object.entries(nights)) writeFileSync(join(dir, `${night}.jsonl`), text);
  const config: RigConfig = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60, runsDir: dir };
  app = createApp(config);
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

type Api = { night: string; badLines: number; rows: { job: string }[] };

describe('digest routes', () => {
  it('serves a normal night as page and JSON', async () => {
    const page = await app.request('/digest/2026-01-01');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('alpha/job');
    const api = await app.request('/api/digest/2026-01-01');
    expect(api.status).toBe(200);
    const body = (await api.json()) as Api;
    expect(body.badLines).toBe(0);
    expect(body.rows).toHaveLength(3);
  });

  it('404s a night with no file, page and JSON', async () => {
    expect((await app.request('/digest/2026-02-02')).status).toBe(404);
    expect((await app.request('/api/digest/2026-02-02')).status).toBe(404);
  });

  it('empty night: page says nothing ran, JSON has no rows', async () => {
    const page = await app.request('/digest/2026-01-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const api = await app.request('/api/digest/2026-01-02');
    expect(api.status).toBe(200);
    expect(((await api.json()) as Api).rows).toEqual([]);
  });

  it('bad line: page shows the note, JSON counts it, other rows intact', async () => {
    const page = await app.request('/digest/2026-01-03');
    expect(page.status).toBe(200);
    const html = await page.text();
    expect(html).toContain('1 unreadable line(s)');
    expect(html).toContain('a/job');
    expect(html).toContain('b/job');
    const body = (await (await app.request('/api/digest/2026-01-03')).json()) as Api;
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['a/job', 'b/job']);
  });

  it('page job order equals JSON job order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as Api;
    const jobs = body.rows.map((r) => r.job);
    const pageJobs = [...html.matchAll(/<td>([a-z]+\/job)<\/td>/g)].map((m) => m[1]);
    expect(pageJobs).toEqual(jobs);
    expect(jobs).toEqual(['alpha/job', 'mid/job', 'zeta/job']);
  });
});

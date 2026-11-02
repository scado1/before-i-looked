import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const night = (name: string, lines: string[]): string => {
  writeFileSync(join(dir, `${name}.jsonl`), lines.join('\n'));
  return name;
};

describe('readNight', () => {
  it('reads the real night of 2026-10-28: 5 jobs, 1 bad line', () => {
    const n = readNight('runs', '2026-10-28');
    expect(n).not.toBeNull();
    expect(n!.badLines).toBe(1);
    expect(n!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    const refresh = n!.rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({ runs: 4, retries: 3, lastStatus: 'ok', lastError: null });
    expect(refresh.first).toBe('2026-10-29T01:30:00+01:00');
    expect(refresh.last).toBe('2026-10-29T01:37:00+01:00');
    expect(n!.rows.find((r) => r.job === 'notes/backup')).toMatchObject({
      lastStatus: 'fail',
      lastError: 'quota exceeded',
    });
  });

  it('keeps a null owner as null', () => {
    const n = readNight(dir, night('2026-01-01', ['{"at":"2026-01-01T01:00:00+01:00","job":"a","status":"ok","owner":null}']));
    expect(n!.rows).toEqual([
      {
        job: 'a',
        owner: null,
        runs: 1,
        retries: 0,
        lastStatus: 'ok',
        lastError: null,
        first: '2026-01-01T01:00:00+01:00',
        last: '2026-01-01T01:00:00+01:00',
      },
    ]);
    expect(n!.badLines).toBe(0);
  });

  it('counts bad lines without throwing and orders runs by time, not file order', () => {
    const n = readNight(
      dir,
      night('2026-01-02', [
        '{"at":"2026-01-02T03:00:01+02:00","job":"a","status":"fail","owner":"x","error":"boom"}',
        'not json',
        '{"at":"2026-01-02T01:00:00Z","job":"a","status":"retry","owner":"x"}',
        '{"at":"2026-01-02T01:00:00Z","job":"b","status":"weird","owner":"x"}',
        '{"at":"2026-01-02T01:00:00Z","job":"b","status":"ok","owner":3}',
        '{"at":"2026-01-02T01:00:00Z","job":"b","status":"ok","owner":"x","error":1}',
        '{"at":"yesterday","job":"b","status":"ok","owner":"x"}',
        '[1,2]',
        '',
        '   ',
      ]),
    );
    expect(n!.badLines).toBe(6);
    // 03:00:01+02:00 is 01:00:01Z: first in the file, but last in time.
    expect(n!.rows).toEqual([
      {
        job: 'a',
        owner: 'x',
        runs: 2,
        retries: 1,
        lastStatus: 'fail',
        lastError: 'boom',
        first: '2026-01-02T01:00:00Z',
        last: '2026-01-02T03:00:01+02:00',
      },
    ]);
  });

  it('reads an empty file as no rows', () => {
    expect(readNight(dir, night('2026-01-03', []))).toEqual({ rows: [], badLines: 0 });
  });

  it('returns null for a missing night', () => {
    expect(readNight(dir, '2026-12-31')).toBeNull();
  });

  it('returns null for a night that is not YYYY-MM-DD', () => {
    writeFileSync(join(dir, 'evil.jsonl'), '{"at":"2026-01-01T00:00:00Z","job":"a","status":"ok","owner":null}');
    for (const bad of ['evil', '../runs/2026-10-28', '2026-1-01', '2026-01-01.jsonl', '']) {
      expect(readNight(dir, bad)).toBeNull();
    }
  });
});

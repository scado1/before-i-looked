import type { Night } from './types.js';

export type NightCounts = { ok: number; retry: number; fail: number };

// ok/fail = jobs whose last status is that; retry = total retried runs across jobs.
export function countNight(night: Night): NightCounts {
  return {
    ok: night.rows.filter((r) => r.lastStatus === 'ok').length,
    fail: night.rows.filter((r) => r.lastStatus === 'fail').length,
    retry: night.rows.reduce((sum, r) => sum + r.retries, 0),
  };
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night, ReadNight } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;

type RunLine = {
  at: string;
  time: number; // epoch ms of `at`, for ordering only; `at` is what gets shown
  job: string;
  status: JobStatus;
  owner: string | null;
  error: string | null;
};

const isStatus = (v: unknown): v is JobStatus => v === 'ok' || v === 'retry' || v === 'fail';

// The edge: one raw line in, a typed RunLine or null out. Never throws.
function parseLine(raw: string): RunLine | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const { at, job, status, owner, error } = o;
  if (typeof at !== 'string' || typeof job !== 'string' || job === '') return null;
  const time = Date.parse(at);
  if (Number.isNaN(time)) return null;
  if (!isStatus(status)) return null;
  if (typeof owner !== 'string' && owner !== null) return null;
  if (error !== undefined && typeof error !== 'string') return null;
  return { at, time, job, status, owner, error: error ?? null };
}

function readText(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (e) {
    if (e instanceof Error && 'code' in e && e.code === 'ENOENT') return null;
    throw e;
  }
}

function toRow(lines: RunLine[]): DigestRow {
  // Stable sort: equal instants keep file order, so the later line counts as last.
  const sorted = [...lines].sort((a, b) => a.time - b.time);
  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  return {
    job: last.job,
    owner: last.owner,
    runs: sorted.length,
    retries: sorted.filter((l) => l.status === 'retry').length,
    lastStatus: last.status,
    lastError: last.error,
    first: first.at,
    last: last.at,
  };
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  const text = readText(join(runsDir, `${night}.jsonl`));
  if (text === null) return null;

  const byJob = new Map<string, RunLine[]>();
  let badLines = 0;
  for (const raw of text.split(/\r?\n/)) {
    if (raw.trim() === '') continue;
    const line = parseLine(raw);
    if (line === null) {
      badLines++;
      continue;
    }
    const list = byJob.get(line.job);
    if (list) list.push(line);
    else byJob.set(line.job, [line]);
  }

  const rows = [...byJob.values()].map(toRow).sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { rows, badLines };
};

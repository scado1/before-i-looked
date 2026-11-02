export type JobStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null; // null when the run log has no owner for the job
  runs: number;
  retries: number; // runs with status 'retry'
  lastStatus: JobStatus;
  lastError: string | null;
  first: string; // raw `at` of the first run, offset kept
  last: string; // raw `at` of the last run, offset kept
};

export type Night = {
  rows: DigestRow[];
  badLines: number; // lines of runs/<night>.jsonl that failed to parse
};

// Returns null when runs/<night>.jsonl does not exist. Implemented in src/digest/read.ts.
export declare function readNight(runsDir: string, night: string): Night | null;
